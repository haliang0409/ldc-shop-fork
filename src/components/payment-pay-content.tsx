'use client'

import { useEffect, useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { CopyButton } from "@/components/copy-button"
import { toast } from "sonner"

export function PaymentPayContent(props: {
  order: { orderId: string; name: string; amount: string; status: string }
  payUrl: string
  payParams: Record<string, any> | null
}) {
  const { t } = useI18n()
  const [shareUrl, setShareUrl] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') setShareUrl(window.location.href)
  }, [])

  const status = props.order.status || 'pending'

  const handlePay = async () => {
    if (!props.payParams) return
    setPaying(true)
    try {
      const form = document.createElement('form')
      form.method = 'POST'
      form.action = props.payUrl

      Object.entries(props.payParams).forEach(([k, v]) => {
        const input = document.createElement('input')
        input.type = 'hidden'
        input.name = k
        input.value = String(v)
        form.appendChild(input)
      })

      document.body.appendChild(form)
      form.submit()
    } catch (e: any) {
      toast.error(e?.message || t('common.error'))
    } finally {
      setPaying(false)
    }
  }

  return (
    <main className="container py-10 max-w-2xl">
      <Card className="tech-card overflow-hidden">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-xl">{t('paymentQr.payTitle')}</CardTitle>
              <CardDescription className="font-mono text-xs bg-muted/50 px-2 py-1 rounded inline-block">
                {props.order.orderId}
              </CardDescription>
            </div>
            <Badge variant={status === 'pending' ? 'secondary' : 'default'} className="uppercase text-xs tracking-wider">
              {t(`order.status.${status}`) || status.toUpperCase()}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{t('paymentQr.name')}</div>
            <div className="font-medium">{props.order.name}</div>
          </div>
          <div className="space-y-1">
            <div className="text-sm text-muted-foreground">{t('paymentQr.amount')}</div>
            <div className="text-2xl font-bold font-mono">{props.order.amount}</div>
          </div>

          {shareUrl && (
            <CopyButton text={shareUrl} label={t('paymentQr.shareUrl')} />
          )}

          {status === 'pending' ? (
            <div className="grid gap-4">
              <div className="rounded-lg border bg-background p-4 w-fit">
                <img
                  alt={t('paymentQr.qrAlt')}
                  width={220}
                  height={220}
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareUrl || '')}`}
                />
              </div>
              <Button onClick={handlePay} disabled={paying || !props.payParams}>
                {paying ? t('common.processing') : t('paymentQr.payNow')}
              </Button>
              <p className="text-xs text-muted-foreground">{t('buy.paymentTimeoutNotice')}</p>
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
              {t('paymentQr.paidHint')}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  )
}

