import { checkAdmin } from "@/actions/admin"
import { PaymentQrContent } from "@/components/admin/payment-qr-content"
import { getPaymentQrOrders } from "@/lib/db/queries"

function firstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

function getBaseUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
}

export default async function AdminPaymentQrPage(props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await checkAdmin()
  const sp = await props.searchParams
  const page = Number(firstParam(sp.page)) || 1
  const q = String(firstParam(sp.q) || '')
  const status = String(firstParam(sp.status) || 'all')
  const pageSize = 20

  const data = await getPaymentQrOrders({ page, pageSize, q, status })
  return <PaymentQrContent data={data} baseUrl={getBaseUrl()} />
}
