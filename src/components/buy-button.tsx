'use client'

import { useState, useEffect } from "react"
import { createOrder } from "@/actions/checkout"
import { getUserPoints } from "@/actions/points"
import { previewDiscountForProduct } from "@/actions/discounts"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Loader2, Coins } from "lucide-react"
import { toast } from "sonner"
import { useI18n } from "@/lib/i18n/context"

interface BuyButtonProps {
    productId: string
    price: string | number
    productName: string
    stockCount?: number
    singleCardOnly?: boolean
    purchaseLimit?: number | null
    disabled?: boolean
}

export function BuyButton({ productId, price, productName, stockCount = 0, singleCardOnly = false, purchaseLimit, disabled }: BuyButtonProps) {
    const [loading, setLoading] = useState(false)
    const [open, setOpen] = useState(false)
    const [points, setPoints] = useState(0)
    const [usePoints, setUsePoints] = useState(false)
    const [pointsLoading, setPointsLoading] = useState(false)
    const [discountCode, setDiscountCode] = useState('')
    const [discountApplying, setDiscountApplying] = useState(false)
    const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; discountAmount: number; discountedAmount: number } | null>(null)
    const [quantity, setQuantity] = useState<number>(1)
    const { t } = useI18n()

    const numericalPrice = Number(price)

    const handleInitialClick = async () => {
        if (disabled) return
        setOpen(true)
        setPointsLoading(true)
        try {
            const p = await getUserPoints()
            setPoints(p)
            // Auto-check if points cover full price? Maybe not. Let user decide.
        } catch (e) {
            console.error(e)
        } finally {
            setPointsLoading(false)
        }
    }

    const handleBuy = async () => {
        try {
            setLoading(true)
            const result = await createOrder(productId, undefined, usePoints, appliedDiscount?.code || undefined, quantity)

            if (!result?.success) {
                const message = result?.error ? t(result.error) : t('common.error')
                toast.error(message)
                setLoading(false)
                return
            }

            if (result.isZeroPrice && result.url) {
                toast.success(t('buy.paymentSuccessPoints'))
                window.location.href = result.url
                return
            }

            const { url, params } = result

            if (!params || !url) {
                toast.error(t('common.error'))
                setLoading(false)
                return
            }

            if (params) {
                // Submit Form
                const form = document.createElement('form')
                form.method = 'POST'
                form.action = url as string

                Object.entries(params as Record<string, any>).forEach(([k, v]) => {
                    const input = document.createElement('input')
                    input.type = 'hidden'
                    input.name = k
                    input.value = String(v)
                    form.appendChild(input)
                })

                document.body.appendChild(form)
                form.submit()
            }

        } catch (e: any) {
            toast.error(e.message || "Failed to create order")
            setLoading(false)
        }
    }

    const handleApplyDiscount = async () => {
        const code = (discountCode || '').trim()
        if (!code) {
            setAppliedDiscount(null)
            return
        }
        setDiscountApplying(true)
        try {
            const preview = await previewDiscountForProduct(productId, code)
            if (!preview.ok) {
                setAppliedDiscount(null)
                toast.error(t(preview.error))
                return
            }
            setAppliedDiscount({
                code: preview.code,
                discountAmount: preview.discountAmount,
                discountedAmount: preview.discountedAmount,
            })
            toast.success(t('discount.applied'))
        } catch (e: any) {
            setAppliedDiscount(null)
            toast.error(e?.message || t('discount.invalid'))
        } finally {
            setDiscountApplying(false)
        }
    }

    // Calculation for UI
    const baseForPoints = (appliedDiscount?.discountedAmount ?? numericalPrice) * quantity
    const pointsToUse = usePoints ? Math.min(points, Math.ceil(baseForPoints)) : 0
    const finalPrice = Math.max(0, baseForPoints - pointsToUse)

    return (
        <>
            <Button
                size="lg"
                className="w-full md:w-auto bg-foreground text-background hover:bg-foreground/90"
                onClick={handleInitialClick}
                disabled={disabled}
            >
                {t('common.buyNow')}
            </Button>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{t('common.buyNow')}</DialogTitle>
                        <DialogDescription>{productName}</DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="flex justify-between items-center">
                            <span className="font-medium">{t('buy.modal.price')}</span>
                            <span>{numericalPrice.toFixed(2)}</span>
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="discount-code">{t('discount.code')}</Label>
                            <div className="flex gap-2">
                                <Input
                                    id="discount-code"
                                    value={discountCode}
                                    onChange={(e) => setDiscountCode(e.target.value)}
                                    placeholder={t('discount.placeholder')}
                                    disabled={loading || discountApplying}
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={handleApplyDiscount}
                                    disabled={loading || discountApplying}
                                >
                                    {discountApplying ? t('common.processing') : t('discount.apply')}
                                </Button>
                            </div>
                            {appliedDiscount && (
                                <div className="text-sm text-muted-foreground flex justify-between">
                                    <span>{t('discount.appliedCode', { code: appliedDiscount.code })}</span>
                                    <span>-{appliedDiscount.discountAmount.toFixed(2)}</span>
                                </div>
                            )}
                        </div>

                        {/* Quantity Selector */}
                        <div className="grid gap-2">
                            <Label htmlFor="quantity">{t('buy.modal.quantity') || 'Quantity'}</Label>
                            <div className="flex gap-2 items-center">
                                <Input
                                    id="quantity"
                                    type="number"
                                    min={1}
                                    value={quantity}
                                    onChange={(e) => {
                                        const v = Math.max(1, Number(e.target.value || 1))
                                        const limitCap = purchaseLimit && purchaseLimit > 0 ? purchaseLimit : undefined
                                        const stockCap = (!singleCardOnly && stockCount > 0) ? stockCount : undefined
                                        const cap = typeof limitCap === 'number' && typeof stockCap === 'number'
                                            ? Math.min(limitCap, stockCap)
                                            : (limitCap ?? stockCap)
                                        setQuantity(cap ? Math.min(v, cap) : v)
                                    }}
                                    disabled={loading}
                                />
                                {!singleCardOnly && stockCount > 0 && (
                                    <span className="text-xs text-muted-foreground">{t('buy.modal.maxQuantity', { max: stockCount }) || `Max: ${stockCount}`}</span>
                                )}
                                {purchaseLimit && purchaseLimit > 0 && (
                                    <span className="text-xs text-muted-foreground">{t('buy.purchaseLimit', { limit: purchaseLimit })}</span>
                                )}
                                {singleCardOnly && (
                                    <span className="text-xs text-muted-foreground">{t('buy.modal.reusableKeyHint') || 'Reusable single key'}</span>
                                )}
                            </div>
                        </div>

                        {points > 0 && (
                            <div className="flex items-center space-x-2 border p-3 rounded-md">
                                <input
                                    type="checkbox"
                                    id="use-points"
                                    checked={usePoints}
                                    onChange={(e) => setUsePoints(e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                />
                                <Label htmlFor="use-points" className="flex-1 flex justify-between cursor-pointer">
                                    <span className="flex items-center gap-1">
                                        {t('buy.modal.usePoints')} <Coins className="w-3 h-3 text-yellow-500" />
                                    </span>
                                    <span className="text-muted-foreground">
                                        {t('buy.modal.pointsDetails', { points: pointsToUse, available: points })}
                                    </span>
                                </Label>
                            </div>
                        )}

                        <div className="flex justify-between items-center border-t pt-4 font-bold text-lg">
                            <span>{t('buy.modal.total')}</span>
                            <span>{finalPrice.toFixed(2)}</span>
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                            {t('common.cancel')}
                        </Button>
                        <Button onClick={handleBuy} disabled={loading}>
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {finalPrice === 0 ? t('buy.modal.payWithPoints') : t('buy.modal.proceedPayment')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
