import { notFound } from "next/navigation"
import { db } from "@/lib/db"
import { orders } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { generateSign } from "@/lib/crypto"
import { PaymentPayContent } from "@/components/payment-pay-content"
import { cancelExpiredOrders } from "@/lib/db/queries"

export const dynamic = 'force-dynamic'

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
}

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  try {
    await cancelExpiredOrders({ orderId: id })
  } catch {
    // best effort
  }

  const order = await db.query.orders.findFirst({ where: eq(orders.orderId, id) })
  if (!order) return notFound()

  const status = order.status || 'pending'

  const baseUrl = getBaseUrl()
  const payParams: Record<string, any> | null = status === 'pending' ? {
    pid: process.env.MERCHANT_ID!,
    type: 'epay',
    out_trade_no: order.orderId,
    notify_url: `${baseUrl}/api/notify`,
    return_url: `${baseUrl}/pay/${order.orderId}`,
    name: order.productName,
    money: Number(order.amount).toFixed(2),
    sign_type: 'MD5',
  } : null

  if (payParams) {
    payParams.sign = generateSign(payParams, process.env.MERCHANT_KEY!)
  }

  return (
    <PaymentPayContent
      order={{
        orderId: order.orderId,
        name: order.productName,
        amount: Number(order.amount).toFixed(2),
        status,
      }}
      payUrl={process.env.PAY_URL || 'https://credit.linux.do/epay/pay/submit.php'}
      payParams={payParams}
    />
  )
}

