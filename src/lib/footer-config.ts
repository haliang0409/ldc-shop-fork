export type FooterRightItem = {
  text: string
  href?: string | null
}

export type FooterConfig = {
  left?: string | null
  right?: FooterRightItem[] | null
}

export function parseFooterConfig(raw: string | null): FooterConfig | null {
  if (!raw) return null
  try {
    const v = JSON.parse(String(raw))
    if (!v || typeof v !== 'object') return null
    return v as FooterConfig
  } catch {
    return null
  }
}

export function normalizeFooterConfig(input: FooterConfig | null | undefined): FooterConfig | null {
  if (!input) return null

  const left = typeof input.left === 'string' ? input.left.trim().slice(0, 1000) : null
  const rightRaw = Array.isArray(input.right) ? input.right : []
  const right = rightRaw
    .map((it: any) => {
      const text = String(it?.text ?? '').trim().slice(0, 120)
      const href = String(it?.href ?? '').trim().slice(0, 2048)
      if (!text) return null
      return { text, href: href ? href : null } as FooterRightItem
    })
    .filter(Boolean) as FooterRightItem[]

  return { left: left || null, right }
}

