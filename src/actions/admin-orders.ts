'use server'

import { db } from "@/lib/db"
import { auth } from "@/lib/auth"
import { cards, orders, refundRequests, loginUsers } from "@/lib/db/schema"
import { and, eq, sql } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { checkAdmin } from "@/actions/admin"

async function ensureOrdersAdminAdjustColumns() {
  await db.execute(sql`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_from DECIMAL(10, 2);
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_by TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_reason TEXT;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_adjusted_at TIMESTAMP;
  `)
}

export async function markOrderPaid(orderId: string) {
  await checkAdmin()
  if (!orderId) throw new Error("Missing order id")

  await db.update(orders).set({
    status: 'paid',
    paidAt: new Date(),
  }).where(eq(orders.orderId, orderId))

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/order/${orderId}`)
}

export async function markOrderDelivered(orderId: string) {
  await checkAdmin()
  if (!orderId) throw new Error("Missing order id")

  const order = await db.query.orders.findFirst({ where: eq(orders.orderId, orderId) })
  if (!order) throw new Error("Order not found")
  if (!order.cardKey) throw new Error("Missing card key; cannot mark delivered")

  await db.update(orders).set({
    status: 'delivered',
    deliveredAt: new Date(),
  }).where(eq(orders.orderId, orderId))

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/order/${orderId}`)
}

export async function cancelOrder(orderId: string) {
  await checkAdmin()
  if (!orderId) throw new Error("Missing order id")

  await db.transaction(async (tx) => {
    // 1. Refund points if used
    const order = await tx.query.orders.findFirst({
      where: eq(orders.orderId, orderId),
      columns: { userId: true, pointsUsed: true }
    })

    if (order?.userId && order.pointsUsed && order.pointsUsed > 0) {
      await tx.update(loginUsers)
        .set({ points: sql`${loginUsers.points} + ${order.pointsUsed}` })
        .where(eq(loginUsers.userId, order.userId))
    }

    await tx.update(orders).set({ status: 'cancelled' }).where(eq(orders.orderId, orderId))
    try {
      await tx.execute(sql`
        ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_order_id TEXT;
        ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
      `)
    } catch {
      // best effort
    }
    await tx.update(cards).set({ reservedOrderId: null, reservedAt: null })
      .where(sql`${cards.reservedOrderId} = ${orderId} AND ${cards.isUsed} = false`)
  })

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/order/${orderId}`)
}

export async function updateOrderEmail(orderId: string, email: string | null) {
  await checkAdmin()
  if (!orderId) throw new Error("Missing order id")
  const next = (email || '').trim()
  await db.update(orders).set({ email: next || null }).where(eq(orders.orderId, orderId))
  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
}

export async function adminUpdatePendingOrderAmount(orderIdRaw: string, newAmountRaw: string, reasonRaw: string) {
  await checkAdmin()
  const orderId = String(orderIdRaw || '').trim()
  if (!orderId) throw new Error("Missing order id")

  const reason = String(reasonRaw || '').trim()
  const nextAmount = Number(String(newAmountRaw || '').trim())
  if (!Number.isFinite(nextAmount) || nextAmount < 0) throw new Error("Invalid amount")

  try {
    await ensureOrdersAdminAdjustColumns()
  } catch {
    // best effort
  }

  const order = await db.query.orders.findFirst({ where: eq(orders.orderId, orderId) })
  if (!order) throw new Error("Order not found")

  const status = order.status || 'pending'
  if (status !== 'pending') throw new Error("Order is not pending")

  const session = await auth()
  const adminUsername = session?.user?.username || null

  await db.update(orders).set({
    amount: nextAmount.toFixed(2),
    adminAdjustedFrom: order.amount,
    adminAdjustedBy: adminUsername,
    adminAdjustedReason: reason || null,
    adminAdjustedAt: new Date(),
  }).where(eq(orders.orderId, orderId))

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
  revalidatePath(`/order/${orderId}`)
}

async function deleteOneOrder(tx: any, orderId: string) {
  const order = await tx.query.orders.findFirst({ where: eq(orders.orderId, orderId) })
  if (!order) return

  // Refund points if used
  if (order.userId && order.pointsUsed && order.pointsUsed > 0) {
    await tx.update(loginUsers)
      .set({ points: sql`${loginUsers.points} + ${order.pointsUsed}` })
      .where(eq(loginUsers.userId, order.userId))
  }

  // Release reserved card if any
  try {
    await tx.execute(sql`
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_order_id TEXT;
      ALTER TABLE cards ADD COLUMN IF NOT EXISTS reserved_at TIMESTAMP;
    `)
  } catch {
    // best effort
  }

  await tx.update(cards).set({ reservedOrderId: null, reservedAt: null })
    .where(sql`${cards.reservedOrderId} = ${orderId} AND ${cards.isUsed} = false`)

  // Delete related refund requests (best effort)
  try {
    await tx.delete(refundRequests).where(eq(refundRequests.orderId, orderId))
  } catch {
    // table may not exist yet
  }

  await tx.delete(orders).where(eq(orders.orderId, orderId))
}

export async function deleteOrder(orderId: string) {
  await checkAdmin()
  if (!orderId) throw new Error("Missing order id")

  await db.transaction(async (tx) => {
    await deleteOneOrder(tx, orderId)
  })

  revalidatePath('/admin/orders')
  revalidatePath(`/admin/orders/${orderId}`)
}

export async function deleteOrders(orderIds: string[]) {
  await checkAdmin()
  const ids = (orderIds || []).map((s) => String(s).trim()).filter(Boolean)
  if (!ids.length) return

  await db.transaction(async (tx) => {
    for (const id of ids) {
      await deleteOneOrder(tx, id)
    }
  })

  revalidatePath('/admin/orders')
}
