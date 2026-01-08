import { db } from "@/lib/db"
import { discountCodes } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"

export function normalizeDiscountCode(raw: string) {
  return String(raw || '').trim().toUpperCase()
}

export async function ensureDiscountCodesTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS discount_codes (
      code TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      value DECIMAL(10, 2) NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      max_uses INTEGER,
      used_count INTEGER DEFAULT 0 NOT NULL,
      min_amount DECIMAL(10, 2),
      starts_at TIMESTAMP,
      ends_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS discount_codes_active_idx ON discount_codes(is_active);
  `)
}

export async function incrementDiscountUseBestEffort(codeRaw: string) {
  const code = normalizeDiscountCode(codeRaw)
  if (!code) return

  try {
    await ensureDiscountCodesTable()
  } catch {
    return
  }

  try {
    await db.update(discountCodes)
      .set({ usedCount: sql`${discountCodes.usedCount} + 1`, updatedAt: new Date() })
      .where(eq(discountCodes.code, code))
  } catch {
    // ignore
  }
}
