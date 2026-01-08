import { adminListDiscountCodes } from "@/actions/discounts"
import { AdminDiscountsContent } from "@/components/admin/discounts-content"

export const dynamic = 'force-dynamic';

export default async function AdminDiscountsPage() {
  const codes = await adminListDiscountCodes()
  return <AdminDiscountsContent codes={codes} />
}
