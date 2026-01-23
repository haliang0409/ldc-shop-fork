import { checkAdmin } from "@/actions/admin"
import { PaymentQrContent } from "@/components/admin/payment-qr-content"

export default async function AdminPaymentQrPage() {
  await checkAdmin()
  return <PaymentQrContent />
}

