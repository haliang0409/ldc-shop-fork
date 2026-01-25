'use server'

import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { products, cards, orders, loginUsers } from "@/lib/db/schema"
import { cancelExpiredOrders, isUserBanned } from "@/lib/db/queries"
import { generateOrderId, generateSign } from "@/lib/crypto"
import { eq, sql, and, or } from "drizzle-orm"
import { cookies } from "next/headers"
import { previewDiscountForProduct } from "@/actions/discounts"

async function ensureOrdersPromoColumns() {
    await db.execute(sql`
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10, 2);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_code TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_from DECIMAL(10, 2);
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_by TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_reason TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_at TIMESTAMP;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS note TEXT;
    `)
}

function normalizeDiscountCode(raw: string | undefined) {
    return String(raw || '').trim().toUpperCase()
}

function round2(n: number) {
    return Math.round((n + Number.EPSILON) * 100) / 100
}

export async function createOrder(
    productId: string,
    email?: string,
    usePoints: boolean = false,
    discountCode?: string,
    quantityRaw?: number,
    noteRaw?: string
) {
    const session = await auth()
    const user = session?.user
    if (user?.id) {
        try {
            if (await isUserBanned(user.id)) return { success: false, error: 'auth.banned' }
        } catch {
            // best effort
        }
    }

    // 1. Get Product
    const product = await db.query.products.findFirst({
        where: eq(products.id, productId)
    })
    if (!product) return { success: false, error: 'buy.productNotFound' }

    try {
        await cancelExpiredOrders({ productId })
    } catch {
        // Best effort cleanup
    }

    // Ensure new columns exist (best-effort, for old deployments)
    try {
        await ensureOrdersPromoColumns()
    } catch {
        // best effort
    }

    const baseAmount = Number(product.price)
    const quantity = Math.max(1, Number.isFinite(quantityRaw as number) ? Number(quantityRaw) : 1)
    const normalizedCode = normalizeDiscountCode(discountCode)
    let appliedDiscountCode: string | null = null
    let discountAmount = 0
    let amountAfterDiscount = baseAmount

    if (normalizedCode) {
        try {
            const preview = await previewDiscountForProduct(productId, normalizedCode)
            if (!preview.ok) return { success: false, error: preview.error }
            appliedDiscountCode = preview.code
            discountAmount = preview.discountAmount
            amountAfterDiscount = preview.discountedAmount
        } catch {
            return { success: false, error: 'discount.invalid' }
        }
    }

    // Points Calculation (based on discounted amount)
    let pointsToUse = 0
    let finalAmount = amountAfterDiscount * quantity

    if (usePoints && user?.id) {
        const userRec = await db.query.loginUsers.findFirst({
            where: eq(loginUsers.userId, user.id),
            columns: { points: true }
        })
        const currentPoints = userRec?.points || 0

        if (currentPoints > 0) {
            // Logic: 1 Point = 1 Unit of currency
            pointsToUse = Math.min(currentPoints, Math.ceil(finalAmount))
            finalAmount = Math.max(0, finalAmount - pointsToUse)
        }
    }

    const isZeroPrice = finalAmount <= 0

    const note = (() => {
        const s = String(noteRaw ?? '').trim()
        if (!s) return null
        return s.slice(0, 500)
    })()

    const ensureCardsReservationColumns = async () => {
        await db.execute(sql`
            ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_order_id TEXT;
            ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
        `);
    }

    const ensureCardsIsUsedDefaults = async () => {
        await db.execute(sql`
            ALTER TABLE cards ALTER COLUMN is_used SET DEFAULT FALSE;
            UPDATE cards SET is_used = FALSE WHERE is_used IS NULL;
        `);
    }

    const getAvailableStock = async () => {
        const result = await db.select({ count: sql<number>`count(*)::int` })
            .from(cards)
            .where(sql`
                ${cards.productId} = ${productId}
                AND (COALESCE(${cards.isUsed}, false) = false)
                AND (${cards.reservedAt} IS NULL OR ${cards.reservedAt} < NOW() - INTERVAL '5 minutes')
            `)
        return result[0]?.count || 0
    }

    // 2. Check Stock
    let stock = 0
    try {
        stock = await getAvailableStock()
    } catch (error: any) {
        const errorString = JSON.stringify(error)
        const isMissingColumn =
            error?.message?.includes('reserved_order_id') ||
            error?.message?.includes('reserved_at') ||
            errorString.includes('42703')

        if (isMissingColumn) {
            await ensureCardsReservationColumns()
            stock = await getAvailableStock()
        } else {
            throw error
        }
    }

    if (stock <= 0) {
        try {
            const nullUsed = await db.select({ count: sql<number>`count(*)::int` })
                .from(cards)
                .where(sql`${cards.productId} = ${productId} AND ${cards.isUsed} IS NULL`)
            if ((nullUsed[0]?.count || 0) > 0) {
                await ensureCardsIsUsedDefaults()
                stock = await getAvailableStock()
            }
        } catch {
            // ignore
        }
    }

    // For reusable single-card products: require at least one card key on file, but do not cap by stock
    const singleCardOnly = (product as any).singleCardOnly === true
    if (!singleCardOnly) {
        if (stock <= 0) return { success: false, error: 'buy.outOfStock' }
        if (quantity > stock) return { success: false, error: 'buy.exceedsStock' }
    } else {
        if (stock <= 0) return { success: false, error: 'buy.outOfStock' }
    }

    // 3. Check Purchase Limit
    if (product.purchaseLimit && product.purchaseLimit > 0) {
        const currentUserId = user?.id
        const currentUserEmail = email || user?.email

        if (currentUserId || currentUserEmail) {
            const userConditions = []
            if (currentUserId) userConditions.push(eq(orders.userId, currentUserId))
            if (currentUserEmail) userConditions.push(eq(orders.email, currentUserEmail))

            if (userConditions.length > 0) {
                // Count total purchased quantity (paid or delivered); fallback to 1 when quantity is null
                const countResult = await db.select({
                    total: sql<number>`COALESCE(sum(COALESCE(${orders.quantity}, 1)), 0)::int`
                })
                    .from(orders)
                    .where(and(
                        eq(orders.productId, productId),
                        or(...userConditions),
                        or(eq(orders.status, 'paid'), eq(orders.status, 'delivered'))
                    ))

                const existingQty = countResult[0]?.total || 0
                const remaining = product.purchaseLimit - existingQty
                if (remaining <= 0) {
                    return { success: false, error: 'buy.limitExceeded' }
                }
                if (quantity > remaining) {
                    return { success: false, error: 'buy.limitExceeded' }
                }
            }
        }
    }

    // 4. Create Order + Reserve Stock (5 minutes) OR Deliver Immediately
    const orderId = generateOrderId()

    const reserveAndCreate = async () => {
        await db.transaction(async (tx) => {
            // Verify and Deduct Points inside transaction
            if (pointsToUse > 0) {
                const updatedUser = await tx.update(loginUsers)
                    .set({ points: sql`${loginUsers.points} - ${pointsToUse}` })
                    .where(and(eq(loginUsers.userId, user!.id!), sql`${loginUsers.points} >= ${pointsToUse}`))
                    .returning({ points: loginUsers.points });

                if (!updatedUser.length) {
                    throw new Error('insufficient_points');
                }
            }

            let reservedRows: Array<{ id: number; card_key: string }> = []

            if (!singleCardOnly) {
                const reservedResult = await tx.execute(sql`
                    UPDATE cards
                    SET reserved_order_id = ${orderId}, reserved_at = NOW()
                    WHERE id IN (
                        SELECT id
                        FROM cards
                                    WHERE product_id = ${productId}
                                      AND COALESCE(is_used, false) = false
                                      AND (reserved_at IS NULL OR reserved_at < NOW() - INTERVAL '5 minutes')
                        LIMIT ${quantity}
                        FOR UPDATE SKIP LOCKED
                    )
                    RETURNING id, card_key
                `)

                if (!reservedResult.rows.length || reservedResult.rows.length < quantity) {
                    throw new Error('stock_locked')
                }
                reservedRows = reservedResult.rows.map(r => ({ id: r.id as number, card_key: r.card_key as string }))
            }

            // If Zero Price: Mark card used and order delivered immediately
            if (isZeroPrice) {
                let cardKeys: string[] = []
                let firstKey: string | null = null

                if (singleCardOnly) {
                    // Fetch reusable single key
                    const keyRes = await tx.execute(sql`
                        SELECT card_key FROM cards WHERE product_id = ${productId} LIMIT 1
                    `)
                    const reusableKey = keyRes.rows[0]?.card_key as string | undefined
                    if (!reusableKey) throw new Error('out_of_stock')
                    cardKeys = Array(quantity).fill(reusableKey)
                    firstKey = reusableKey
                } else {
                    // Mark all reserved as used and collect keys
                    const ids = reservedRows.map(r => r.id)
                    if (ids.length) {
                        await tx.execute(sql`
                            UPDATE cards
                            SET is_used = true,
                                used_at = NOW(),
                                reserved_order_id = NULL,
                                reserved_at = NULL
                            WHERE id = ANY(${ids})
                        `)
                        cardKeys = reservedRows.map(r => r.card_key)
                        firstKey = cardKeys[0] || null
                    }
                }

                await tx.insert(orders).values({
                    orderId,
                    productId: product.id,
                    productName: product.name,
                    amount: round2(finalAmount).toFixed(2), // 0.00 or final
                    originalAmount: round2(baseAmount * quantity).toFixed(2),
                    discountCode: appliedDiscountCode,
                    discountAmount: discountAmount ? round2(discountAmount * quantity).toFixed(2) : null,
                    email: email || user?.email || null,
                    userId: user?.id || null,
                    username: user?.username || null,
                    status: 'delivered',
                    quantity: quantity,
                    note,
                    cardKey: firstKey,
                    cardKeys: JSON.stringify(cardKeys),
                    paidAt: new Date(),
                    deliveredAt: new Date(),
                    tradeNo: 'POINTS_REDEMPTION',
                    pointsUsed: pointsToUse
                })

            } else {
                // Normal Pending Order
                await tx.insert(orders).values({
                    orderId,
                    productId: product.id,
                    productName: product.name,
                    amount: round2(finalAmount).toFixed(2),
                    originalAmount: round2(baseAmount * quantity).toFixed(2),
                    discountCode: appliedDiscountCode,
                    discountAmount: discountAmount ? round2(discountAmount * quantity).toFixed(2) : null,
                    email: email || user?.email || null,
                    userId: user?.id || null,
                    username: user?.username || null,
                    status: 'pending',
                    quantity: quantity,
                    note,
                    pointsUsed: pointsToUse
                })
            }
        });
    };

    try {
        await reserveAndCreate();
    } catch (error: any) {
        if (error?.message === 'stock_locked') {
            return { success: false, error: 'buy.stockLocked' };
        }
        if (error?.message === 'insufficient_points') {
            return { success: false, error: 'Points mismatch, please try again.' };
        }

        // Schema retry logic 
        const errorString = JSON.stringify(error);
        const isMissingColumn =
            error?.message?.includes('reserved_order_id') ||
            error?.message?.includes('reserved_at') ||
            errorString.includes('42703');

        if (isMissingColumn) {
            await db.execute(sql`
                ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_order_id TEXT;
                ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
            `);

            try {
                await ensureOrdersPromoColumns()
            } catch {
                // best effort
            }

            try {
                await reserveAndCreate();
            } catch (retryError: any) {
                if (retryError?.message === 'stock_locked') return { success: false, error: 'buy.stockLocked' };
                if (retryError?.message === 'insufficient_points') return { success: false, error: 'Points mismatch' };
                throw retryError;
            }
        } else {
            throw error;
        }
    }

    // If Zero Price, return Success (redirect to order view)
    if (isZeroPrice) {
        return {
            success: true,
            url: `${process.env.NEXT_PUBLIC_APP_URL || ''}/order/${orderId}`,
            isZeroPrice: true
        }
    }

    // Set Pending Cookie
    const cookieStore = await cookies()
    cookieStore.set('ldc_pending_order', orderId, { secure: true, path: '/', sameSite: 'lax' })

    // 4. Generate Pay Params
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const payParams: Record<string, any> = {
        pid: process.env.MERCHANT_ID!,
        type: 'epay',
        out_trade_no: orderId,
        notify_url: `${baseUrl}/api/notify`,
        return_url: `${baseUrl}/callback/${orderId}`,
        name: product.name,
        money: Number(finalAmount).toFixed(2),
        sign_type: 'MD5'
    }

    payParams.sign = generateSign(payParams, process.env.MERCHANT_KEY!)

    return {
        success: true,
        url: process.env.PAY_URL || 'https://credit.linux.do/epay/pay/submit.php',
        params: payParams
    }
}

export async function createPaymentForOrder(orderIdRaw: string) {
    const orderId = String(orderIdRaw || '').trim()
    if (!orderId) return { success: false, error: 'common.error' }

    const session = await auth()
    const user = session?.user
    if (user?.id) {
        try {
            if (await isUserBanned(user.id)) return { success: false, error: 'auth.banned' }
        } catch {
            // best effort
        }
    }

    const order = await db.query.orders.findFirst({ where: eq(orders.orderId, orderId) })
    if (!order) return { success: false, error: 'common.error' }

    const status = order.status || 'pending'
    if (status !== 'pending') return { success: false, error: 'order.notPayable' }

    const isOwner = !!(user && (user.id === order.userId || user.username === order.username))
    if (!isOwner) return { success: false, error: 'common.error' }

    const cookieStore = await cookies()
    cookieStore.set('ldc_pending_order', orderId, { secure: true, path: '/', sameSite: 'lax' })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
    const payParams: Record<string, any> = {
        pid: process.env.MERCHANT_ID!,
        type: 'epay',
        out_trade_no: orderId,
        notify_url: `${baseUrl}/api/notify`,
        return_url: `${baseUrl}/callback/${orderId}`,
        name: order.productName,
        money: Number(order.amount).toFixed(2),
        sign_type: 'MD5'
    }

    payParams.sign = generateSign(payParams, process.env.MERCHANT_KEY!)

    return {
        success: true,
        url: process.env.PAY_URL || 'https://credit.linux.do/epay/pay/submit.php',
        params: payParams
    }
}
