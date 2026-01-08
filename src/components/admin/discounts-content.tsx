'use client'

import { useMemo, useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { toast } from "sonner"
import { adminDeleteDiscountCode, adminUpsertDiscountCode, type DiscountType } from "@/actions/discounts"

export function AdminDiscountsContent({ codes }: { codes: any[] }) {
  const { t } = useI18n()

  const [code, setCode] = useState('')
  const [type, setType] = useState<DiscountType>('amount')
  const [value, setValue] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [maxUses, setMaxUses] = useState('')
  const [minAmount, setMinAmount] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [saving, setSaving] = useState(false)

  const [genLength, setGenLength] = useState('8')
  const [genUpperCase, setGenUpperCase] = useState(true)
  const [genLowerCase, setGenLowerCase] = useState(true)
  const [genNumbers, setGenNumbers] = useState(true)

  const sorted = useMemo(() => {
    return [...(codes || [])].sort((a, b) => String(a.code).localeCompare(String(b.code)))
  }, [codes])

  const handleCreate = async () => {
    setSaving(true)
    try {
      await adminUpsertDiscountCode({
        code,
        type,
        value,
        isActive,
        maxUses,
        minAmount,
        startsAt,
        endsAt,
      })
      toast.success(t('common.success'))
      setCode('')
      setValue('')
      setMaxUses('')
      setMinAmount('')
      setStartsAt('')
      setEndsAt('')
      setIsActive(true)
      setType('amount')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (code: string) => {
    if (!confirm(t('common.confirm') + '?')) return
    try {
      await adminDeleteDiscountCode(code)
      toast.success(t('common.success'))
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const generateCode = () => {
    const len = Math.max(1, Math.min(50, Number(genLength) || 8))
    let chars = ''
    if (genUpperCase) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    if (genLowerCase) chars += 'abcdefghijklmnopqrstuvwxyz'
    if (genNumbers) chars += '0123456789'
    if (!chars) {
      toast.error('Please select at least one character type')
      return
    }
    let generated = ''
    for (let i = 0; i < len; i++) {
      generated += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    setCode(generated.toUpperCase())
    toast.success('Code generated')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-3xl font-bold tracking-tight">{t('admin.discounts.title')}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.discounts.create')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="grid gap-2">
            <Label htmlFor="dc-code">{t('admin.discounts.code')}</Label>
            <div className="flex gap-2">
              <Input id="dc-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="WELCOME10" />
              <Button type="button" variant="outline" onClick={generateCode}>Generate</Button>
            </div>
          </div>

          <div className="grid gap-2">
            <Label className="text-xs text-muted-foreground">Code Generator Options</Label>
            <div className="space-y-2">
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <Label htmlFor="gen-length" className="text-xs">Length</Label>
                  <Input id="gen-length" type="number" min="1" max="50" value={genLength} onChange={(e) => setGenLength(e.target.value)} />
                </div>
              </div>
              <div className="flex gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <input
                    id="gen-upper"
                    type="checkbox"
                    checked={genUpperCase}
                    onChange={(e) => setGenUpperCase(e.target.checked)}
                    className="h-3 w-3 accent-primary"
                  />
                  <Label htmlFor="gen-upper" className="text-xs cursor-pointer">A-Z</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="gen-lower"
                    type="checkbox"
                    checked={genLowerCase}
                    onChange={(e) => setGenLowerCase(e.target.checked)}
                    className="h-3 w-3 accent-primary"
                  />
                  <Label htmlFor="gen-lower" className="text-xs cursor-pointer">a-z</Label>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    id="gen-numbers"
                    type="checkbox"
                    checked={genNumbers}
                    onChange={(e) => setGenNumbers(e.target.checked)}
                    className="h-3 w-3 accent-primary"
                  />
                  <Label htmlFor="gen-numbers" className="text-xs cursor-pointer">0-9</Label>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dc-type">{t('admin.discounts.type')}</Label>
            <select
              id="dc-type"
              value={type}
              onChange={(e) => setType((e.target.value as DiscountType) || 'amount')}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="amount">{t('admin.discounts.typeAmount')}</option>
              <option value="percent">{t('admin.discounts.typePercent')}</option>
            </select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dc-value">{t('admin.discounts.value')}</Label>
            <Input id="dc-value" value={value} onChange={(e) => setValue(e.target.value)} placeholder={type === 'percent' ? '10' : '5.00'} />
          </div>

          <div className="flex items-center gap-2 pt-7">
            <input
              id="dc-active"
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <Label htmlFor="dc-active" className="cursor-pointer">{t('admin.discounts.active')}</Label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dc-max">{t('admin.discounts.maxUses')}</Label>
            <Input id="dc-max" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} placeholder={t('admin.discounts.optional')} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dc-min">{t('admin.discounts.minAmount')}</Label>
            <Input id="dc-min" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder={t('admin.discounts.optional')} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dc-start">{t('admin.discounts.startsAt')}</Label>
            <Input id="dc-start" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} placeholder="2026-01-08T00:00:00Z" />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="dc-end">{t('admin.discounts.endsAt')}</Label>
            <Input id="dc-end" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} placeholder="2026-02-08T00:00:00Z" />
          </div>

          <div className="md:col-span-2 flex justify-end">
            <Button onClick={handleCreate} disabled={saving || !code.trim() || !value.trim()}>
              {saving ? t('common.processing') : t('common.add')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('admin.discounts.code')}</TableHead>
              <TableHead>{t('admin.discounts.type')}</TableHead>
              <TableHead>{t('admin.discounts.value')}</TableHead>
              <TableHead>{t('admin.discounts.active')}</TableHead>
              <TableHead>{t('admin.discounts.used')}</TableHead>
              <TableHead className="text-right">{t('admin.discounts.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((row) => (
              <TableRow key={row.code}>
                <TableCell className="font-mono text-xs">{row.code}</TableCell>
                <TableCell>{row.type}</TableCell>
                <TableCell>{Number(row.value)}</TableCell>
                <TableCell>{row.isActive ? t('common.yes') : t('common.no')}</TableCell>
                <TableCell>
                  {Number(row.usedCount || 0)}{row.maxUses ? ` / ${Number(row.maxUses)}` : ''}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(row.code)}>
                    {t('common.delete')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
