'use server'

import { checkAdmin } from "@/actions/admin"
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { generateOrderId, generateSign } from "@/lib/crypto"
import { eq } from "drizzle-orm"
import { revalidatePath } from "next/cache"

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
}

export async function createPaymentQrOrder(params: { name: string; amount: number }) {
  await checkAdmin()

  const rawName = String(params.name || '').trim()
  const rawAmount = Number(params.amount)

  if (!rawName) return { ok: false as const, error: 'paymentQr.nameRequired' }
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) return { ok: false as const, error: 'paymentQr.amountInvalid' }

  const amount = round2(rawAmount).toFixed(2)
  const orderId = generateOrderId()

  await db.insert(orders).values({
    orderId,
    productId: '__PAYMENT__',
    productName: rawName,
    amount,
    status: 'pending',
    quantity: 1,
  })

  const baseUrl = getBaseUrl()
  const payParams: Record<string, any> = {
    pid: process.env.MERCHANT_ID!,
    type: 'epay',
    out_trade_no: orderId,
    notify_url: `${baseUrl}/api/notify`,
    return_url: `${baseUrl}/pay/${orderId}`,
    name: rawName,
    money: amount,
    sign_type: 'MD5'
  }
  payParams.sign = generateSign(payParams, process.env.MERCHANT_KEY!)

  return {
    ok: true as const,
    orderId,
    payUrl: process.env.PAY_URL || 'https://credit.linux.do/epay/pay/submit.php',
    payParams,
    shareUrl: `${baseUrl}/pay/${orderId}`,
  }
}

export async function cancelPaymentQrOrder(orderId: string) {
  await checkAdmin()
  const id = String(orderId || '').trim()
  if (!id) return { ok: false as const, error: 'common.error' }

  await db.update(orders)
    .set({ status: 'cancelled' })
    .where(eq(orders.orderId, id))

  revalidatePath('/admin/payment-qr')
  return { ok: true as const }
}

export async function deletePaymentQrOrder(orderId: string) {
  await checkAdmin()
  const id = String(orderId || '').trim()
  if (!id) return { ok: false as const, error: 'common.error' }

  await db.delete(orders).where(eq(orders.orderId, id))
  revalidatePath('/admin/payment-qr')
  return { ok: true as const }
}
