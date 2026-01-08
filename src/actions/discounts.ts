'use server'

import { db } from "@/lib/db"
import { discountCodes, products } from "@/lib/db/schema"
import { checkAdmin } from "@/actions/admin"
import { eq, desc } from "drizzle-orm"
import { revalidatePath } from "next/cache"
import { ensureDiscountCodesTable, normalizeDiscountCode as normalizeDiscountCodeLib, incrementDiscountUseBestEffort } from "@/lib/discounts"

export type DiscountType = 'amount' | 'percent'

function normalizeCode(raw: string) {
  return normalizeDiscountCodeLib(raw)
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100
}

// ensureDiscountCodesTable imported from lib

export async function previewDiscountForProduct(productId: string, rawCode: string) {
  const code = normalizeCode(rawCode)
  if (!code) return { ok: false as const, error: 'discount.empty' as const }

  await ensureDiscountCodesTable()

  const product = await db.query.products.findFirst({ where: eq(products.id, productId) })
  if (!product) return { ok: false as const, error: 'buy.productNotFound' as const }

  const baseAmount = Number(product.price)
  const now = new Date()

  const row = await db.query.discountCodes.findFirst({ where: eq(discountCodes.code, code) })
  if (!row) return { ok: false as const, error: 'discount.invalid' as const }
  if (row.isActive === false) return { ok: false as const, error: 'discount.inactive' as const }

  if (row.startsAt && now < new Date(row.startsAt)) return { ok: false as const, error: 'discount.notStarted' as const }
  if (row.endsAt && now > new Date(row.endsAt)) return { ok: false as const, error: 'discount.expired' as const }

  if (row.minAmount && baseAmount < Number(row.minAmount)) return { ok: false as const, error: 'discount.minAmount' as const }

  if (row.maxUses != null && row.usedCount != null && row.usedCount >= row.maxUses) {
    return { ok: false as const, error: 'discount.exhausted' as const }
  }

  const type = (row.type as DiscountType)
  const value = Number(row.value)

  let discountAmount = 0
  if (type === 'percent') {
    if (!(value > 0 && value <= 100)) return { ok: false as const, error: 'discount.invalid' as const }
    discountAmount = round2(baseAmount * (value / 100))
  } else {
    if (!(value > 0)) return { ok: false as const, error: 'discount.invalid' as const }
    discountAmount = round2(value)
  }

  discountAmount = Math.min(discountAmount, baseAmount)
  const discountedAmount = round2(Math.max(0, baseAmount - discountAmount))

  return {
    ok: true as const,
    code,
    type,
    value: round2(value),
    baseAmount: round2(baseAmount),
    discountAmount,
    discountedAmount,
  }
}

export async function adminListDiscountCodes() {
  await checkAdmin()
  await ensureDiscountCodesTable()
  const rows = await db.select().from(discountCodes).orderBy(desc(discountCodes.createdAt))
  return rows
}

export async function adminUpsertDiscountCode(input: {
  code: string
  type: DiscountType
  value: string
  isActive: boolean
  maxUses: string
  minAmount: string
  startsAt: string
  endsAt: string
}) {
  await checkAdmin()
  await ensureDiscountCodesTable()

  const code = normalizeCode(input.code)
  if (!code) throw new Error('Code is required')

  const type: DiscountType = input.type === 'percent' ? 'percent' : 'amount'
  const value = round2(Number(input.value))
  if (!(value > 0)) throw new Error('Invalid value')

  const maxUses = String(input.maxUses || '').trim()
  const minAmount = String(input.minAmount || '').trim()

  const startsAt = String(input.startsAt || '').trim()
  const endsAt = String(input.endsAt || '').trim()

  const parseDate = (s: string) => {
    if (!s) return null
    const d = new Date(s)
    return Number.isFinite(d.getTime()) ? d : null
  }

  const starts = parseDate(startsAt)
  const ends = parseDate(endsAt)

  await db.insert(discountCodes).values({
    code,
    type,
    value: value.toFixed(2),
    isActive: !!input.isActive,
    maxUses: maxUses ? (Number.parseInt(maxUses, 10) || 0) : null,
    minAmount: minAmount ? round2(Number(minAmount)).toFixed(2) : null,
    startsAt: starts,
    endsAt: ends,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: discountCodes.code,
    set: {
      type,
      value: value.toFixed(2),
      isActive: !!input.isActive,
      maxUses: maxUses ? (Number.parseInt(maxUses, 10) || 0) : null,
      minAmount: minAmount ? round2(Number(minAmount)).toFixed(2) : null,
      startsAt: starts,
      endsAt: ends,
      updatedAt: new Date(),
    }
  })

  revalidatePath('/admin/discounts')
}

export async function adminDeleteDiscountCode(codeRaw: string) {
  await checkAdmin()
  await ensureDiscountCodesTable()
  const code = normalizeCode(codeRaw)
  if (!code) return
  await db.delete(discountCodes).where(eq(discountCodes.code, code))
  revalidatePath('/admin/discounts')
}

export async function bestEffortIncrementDiscountUse(codeRaw: string) {
  await incrementDiscountUseBestEffort(codeRaw)
}
