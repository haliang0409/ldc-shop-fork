import { db } from "@/lib/db";
import { orders, cards, products } from "@/lib/db/schema";
import { incrementDiscountUseBestEffort } from "@/lib/discounts";
import { md5 } from "@/lib/crypto";
import { eq, sql } from "drizzle-orm";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function processNotify(params: Record<string, any>) {
    console.log("[Notify] Processing params:", JSON.stringify(params));

    // Verify Sign
    const sign = params.sign;
    const sorted = Object.keys(params)
        .filter(k => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] !== null && params[k] !== undefined)
        .sort()
        .map(k => `${k}=${params[k]}`)
        .join('&');

    const mySign = md5(`${sorted}${process.env.MERCHANT_KEY}`);

    console.log("[Notify] Signature check - received:", sign, "computed:", mySign);

    if (sign !== mySign) {
        console.log("[Notify] Signature mismatch!");
        return new Response('fail', { status: 400 });
    }

    console.log("[Notify] Signature verified OK. trade_status:", params.trade_status);

    if (params.trade_status === 'TRADE_SUCCESS') {
        const orderId = params.out_trade_no;
        const tradeNo = params.trade_no;

        console.log("[Notify] Processing order:", orderId);

        // Find Order
        const order = await db.query.orders.findFirst({
            where: eq(orders.orderId, orderId)
        });

        console.log("[Notify] Order found:", order ? "YES" : "NO", "status:", order?.status);

        if (order) {
            // Verify Amount (Prevent penny-dropping)
            const notifyMoney = parseFloat(params.money);
            const orderMoney = parseFloat(order.amount);

            // Allow small float epsilon difference
            if (Math.abs(notifyMoney - orderMoney) > 0.01) {
                console.error(`[Notify] Amount mismatch! Order: ${orderMoney}, Notify: ${notifyMoney}`);
                return new Response('fail', { status: 400 });
            }

            if (order.status === 'pending' || order.status === 'cancelled') {
                await db.transaction(async (tx) => {
                    // Delivery can be multi-quantity and/or reusable single-card
                    const qty = (order as any).quantity ? Number((order as any).quantity) : 1
                    let supportsReservation = true
                    let cardKeys: string[] = []
                    let firstKey: string | undefined
                    // Check product mode
                    const productRow = await tx.query.products.findFirst({ where: eq(products.id, order.productId) })
                    const singleCardOnly = (productRow as any)?.singleCardOnly === true

                    try {
                        if (!singleCardOnly) {
                            const reservedResult = await tx.execute(sql`
                                UPDATE cards
                                SET is_used = true,
                                    used_at = NOW(),
                                    reserved_order_id = NULL,
                                    reserved_at = NULL
                                WHERE reserved_order_id = ${orderId} AND COALESCE(is_used, false) = false
                                RETURNING card_key
                            `)
                            cardKeys = reservedResult.rows.map(r => r.card_key as string)
                            firstKey = cardKeys[0]
                        }
                    } catch (error: any) {
                        const errorString = JSON.stringify(error);
                        if (
                            error?.message?.includes('reserved_order_id') ||
                            error?.message?.includes('reserved_at') ||
                            errorString.includes('42703')
                        ) {
                            supportsReservation = false;
                        } else {
                            throw error;
                        }
                    }

                    if (singleCardOnly) {
                        // Reusable single key: fetch one key and repeat
                        const keyRes = await tx.execute(sql`
                            SELECT card_key FROM cards WHERE product_id = ${order.productId} LIMIT 1
                        `)
                        const reusableKey = keyRes.rows[0]?.card_key as string | undefined
                        if (reusableKey) {
                            cardKeys = Array(qty).fill(reusableKey)
                            firstKey = reusableKey
                        }
                    }

                    if (!singleCardOnly && cardKeys.length < qty) {
                        // Need to claim additional free cards
                        const needed = qty - cardKeys.length
                        if (needed > 0) {
                            const result = await tx.execute(sql`
                                UPDATE cards
                                SET is_used = true,
                                    used_at = NOW(),
                                    reserved_order_id = NULL,
                                    reserved_at = NULL
                                WHERE id IN (
                                    SELECT id FROM cards
                                    WHERE product_id = ${order.productId}
                                      AND COALESCE(is_used, false) = false
                                      AND (reserved_at IS NULL OR reserved_at < NOW() - INTERVAL '1 minute')
                                    LIMIT ${needed}
                                    FOR UPDATE SKIP LOCKED
                                )
                                RETURNING card_key
                            `)
                            const more = result.rows.map(r => r.card_key as string)
                            cardKeys = cardKeys.concat(more)
                            if (!firstKey) firstKey = cardKeys[0]
                        }
                    }

                    console.log("[Notify] Cards claimed:", cardKeys.length)

                    if ((singleCardOnly && firstKey) || (!singleCardOnly && cardKeys.length === qty)) {
                        await tx.update(orders)
                            .set({
                                status: 'delivered',
                                paidAt: new Date(),
                                deliveredAt: new Date(),
                                tradeNo: tradeNo,
                                cardKey: firstKey,
                                cardKeys: JSON.stringify(cardKeys)
                            })
                            .where(eq(orders.orderId, orderId));
                        console.log("[Notify] Order delivered successfully!");

                        if ((order as any).discountCode) {
                            // best effort; don't block delivery
                            await incrementDiscountUseBestEffort((order as any).discountCode as string)
                        }
                    } else {
                        // Paid but no stock
                        await tx.update(orders)
                            .set({ status: 'paid', paidAt: new Date(), tradeNo: tradeNo })
                            .where(eq(orders.orderId, orderId));
                        console.log("[Notify] Order marked as paid (no stock)");

                        if ((order as any).discountCode) {
                            await incrementDiscountUseBestEffort((order as any).discountCode as string)
                        }
                    }
                });
            }
        }
    }

    return new Response('success');
}

// Handle GET requests (Linux DO Credit sends GET)
export async function GET(request: Request) {
    console.log("[Notify] Received GET callback");

    try {
        const url = new URL(request.url);
        const params: Record<string, any> = {};
        url.searchParams.forEach((value, key) => {
            params[key] = value;
        });

        return await processNotify(params);
    } catch (e) {
        console.error("[Notify] Error:", e);
        return new Response('error', { status: 500 });
    }
}

// Also handle POST requests for compatibility
export async function POST(request: Request) {
    console.log("[Notify] Received POST callback");

    try {
        const formData = await request.formData();
        const params: Record<string, any> = {};
        formData.forEach((value, key) => {
            params[key] = value;
        });

        return await processNotify(params);
    } catch (e) {
        console.error("[Notify] Error:", e);
        return new Response('error', { status: 500 });
    }
}
