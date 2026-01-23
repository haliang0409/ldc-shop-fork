'use client'

import { useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CopyButton } from "@/components/copy-button"
import { createPaymentQrOrder } from "@/actions/payment-qr"
import { toast } from "sonner"

export function PaymentQrContent() {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('1.00')
  const [loading, setLoading] = useState(false)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleCreate = async () => {
    setLoading(true)
    try {
      const res = await createPaymentQrOrder({ name, amount: Number(amount) })
      if (!res.ok) {
        toast.error(t(res.error))
        return
      }
      setShareUrl(res.shareUrl)
      toast.success(t('common.success'))
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    } finally {
      setLoading(false)
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
          <Button onClick={handleCreate} disabled={loading}>
            {loading ? t('common.processing') : t('paymentQr.generate')}
          </Button>
        </CardContent>
      </Card>

      {shareUrl && (
        <Card className="tech-card">
          <CardHeader>
            <CardTitle>{t('paymentQr.result')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CopyButton text={shareUrl} label={t('paymentQr.shareUrl')} />
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="rounded-lg border bg-background p-4">
                <img
                  alt={t('paymentQr.qrAlt')}
                  width={220}
                  height={220}
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl)}`}
                />
              </div>
              <div className="text-sm text-muted-foreground space-y-2">
                <p>{t('paymentQr.tip')}</p>
                <a className="text-primary underline underline-offset-4" href={shareUrl} target="_blank" rel="noreferrer">
                  {t('paymentQr.open')}
                </a>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

