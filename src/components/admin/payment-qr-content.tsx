'use client'

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useI18n } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/copy-button"
import { createPaymentQrOrder, cancelPaymentQrOrder, deletePaymentQrOrder } from "@/actions/payment-qr"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type PaymentQrRow = {
  orderId: string
  name: string
  amount: string
  status: string | null
  createdAt: Date | null
  paidAt: Date | null
  deliveredAt: Date | null
}

export function PaymentQrContent(props: {
  baseUrl: string
  data: {
    items: PaymentQrRow[]
    total: number
    page: number
    pageSize: number
    q: string
    status: string
  }
}) {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()

  // Create form state
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('1.00')
  const [creating, setCreating] = useState(false)

  // List controls state (URL-backed; keep local input for typing)
  const [qInput, setQInput] = useState(props.data.q || '')

  const statusOptions = useMemo(() => ([
    { key: 'all', label: t('common.all') },
    { key: 'pending', label: t('order.status.pending') },
    { key: 'paid', label: t('order.status.paid') },
    { key: 'delivered', label: t('order.status.delivered') },
    { key: 'cancelled', label: t('order.status.cancelled') },
    { key: 'refunded', label: t('order.status.refunded') },
  ]), [t])

  const buildUrl = (patch: Record<string, string | number | undefined | null>) => {
    const sp = new URLSearchParams(searchParams)
    Object.entries(patch).forEach(([k, v]) => {
      if (v === undefined || v === null || String(v).trim() === '') sp.delete(k)
      else sp.set(k, String(v))
    })
    if (!sp.get('page')) sp.set('page', '1')
    const qs = sp.toString()
    return qs ? `/admin/payment-qr?${qs}` : '/admin/payment-qr'
  }

  const pageCount = Math.max(1, Math.ceil(props.data.total / props.data.pageSize))

  const handleCreate = async () => {
    setCreating(true)
    try {
      const res = await createPaymentQrOrder({ name, amount: Number(amount) })
      if (!res.ok) {
        toast.error(t(res.error))
        return
      }
      toast.success(t('common.success'))
      setName('')
      setAmount('1.00')
      router.refresh()
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">{t('paymentQr.title')}</h1>

      <Card className="tech-card">
        <CardHeader>
          <CardTitle>{t('paymentQr.create')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="payment-name">{t('paymentQr.name')}</Label>
            <Input
              id="payment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('paymentQr.namePlaceholder')}
              disabled={creating}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="payment-amount">{t('paymentQr.amount')}</Label>
            <Input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={creating}
            />
          </div>
          <Button onClick={handleCreate} disabled={creating}>
            {creating ? t('common.processing') : t('paymentQr.generate')}
          </Button>
        </CardContent>
      </Card>

      <Card className="tech-card">
        <CardHeader>
          <CardTitle>{t('paymentQr.manage')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <form
              className="flex gap-2 md:w-[520px]"
              onSubmit={(e) => {
                e.preventDefault()
                router.push(buildUrl({ q: qInput.trim(), page: 1 }))
              }}
            >
              <Input value={qInput} onChange={(e) => setQInput(e.target.value)} placeholder={t('paymentQr.searchPlaceholder')} />
              <Button type="submit" variant="outline">{t('search.search')}</Button>
            </form>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((s) => (
                <Button
                  key={s.key}
                  type="button"
                  size="sm"
                  variant={props.data.status === s.key ? 'default' : 'outline'}
                  onClick={() => router.push(buildUrl({ status: s.key, page: 1 }))}
                >
                  {s.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="text-sm text-muted-foreground">
            {t('search.resultCount', { total: props.data.total })}
          </div>

          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('paymentQr.orderId')}</TableHead>
                  <TableHead>{t('paymentQr.name')}</TableHead>
                  <TableHead>{t('paymentQr.amount')}</TableHead>
                  <TableHead>{t('admin.orders.status')}</TableHead>
                  <TableHead>{t('admin.orders.createdAt')}</TableHead>
                  <TableHead className="text-right">{t('common.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.data.items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground">
                      {t('paymentQr.noItems')}
                    </TableCell>
                  </TableRow>
                ) : (
                  props.data.items.map((row) => {
                    const status = row.status || 'pending'
                    const payUrl = `${props.baseUrl}/pay/${row.orderId}`
                    return (
                      <TableRow key={row.orderId}>
                        <TableCell className="font-mono text-xs">{row.orderId}</TableCell>
                        <TableCell className="max-w-[280px] truncate">{row.name}</TableCell>
                        <TableCell className="font-mono">{Number(row.amount).toFixed(2)}</TableCell>
                        <TableCell className="uppercase text-xs">{t(`order.status.${status}`) || status}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <CopyButton text={payUrl} iconOnly />
                            <Button asChild variant="outline" size="sm">
                              <Link href={payUrl} target="_blank">{t('paymentQr.open')}</Link>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={status !== 'pending'}
                              onClick={async () => {
                                if (!confirm(t('paymentQr.cancelConfirm'))) return
                                try {
                                  const res = await cancelPaymentQrOrder(row.orderId)
                                  if (!res.ok) {
                                    toast.error(t(res.error))
                                    return
                                  }
                                  toast.success(t('common.success'))
                                  router.refresh()
                                } catch (e: any) {
                                  toast.error(e?.message || t('common.error'))
                                }
                              }}
                            >
                              {t('paymentQr.cancel')}
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={async () => {
                                if (!confirm(t('paymentQr.deleteConfirm'))) return
                                try {
                                  const res = await deletePaymentQrOrder(row.orderId)
                                  if (!res.ok) {
                                    toast.error(t(res.error))
                                    return
                                  }
                                  toast.success(t('common.success'))
                                  router.refresh()
                                } catch (e: any) {
                                  toast.error(e?.message || t('common.error'))
                                }
                              }}
                            >
                              {t('common.delete')}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {pageCount > 1 && (
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                disabled={props.data.page <= 1}
                onClick={() => router.push(buildUrl({ page: props.data.page - 1 }))}
              >
                {t('search.prev')}
              </Button>
              <div className="flex items-center text-sm text-muted-foreground">
                {t('search.page', { page: props.data.page, totalPages: pageCount })}
              </div>
              <Button
                variant="outline"
                disabled={props.data.page >= pageCount}
                onClick={() => router.push(buildUrl({ page: props.data.page + 1 }))}
              >
                {t('search.next')}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

