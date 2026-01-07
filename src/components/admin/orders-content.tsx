'use client'

import { useMemo, useState } from "react"
import { useI18n } from "@/lib/i18n/context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { RefundButton } from "@/components/admin/refund-button"
import { CopyButton } from "@/components/copy-button"
import { ClientDate } from "@/components/client-date"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

interface Order {
    orderId: string
    username: string | null
    email: string | null
    productName: string
    amount: string
    status: string | null
    cardKey: string | null
    tradeNo: string | null
    createdAt: Date | null
}

export function AdminOrdersContent({ orders }: { orders: Order[] }) {
    const { t } = useI18n()
    const [query, setQuery] = useState("")
    const [status, setStatus] = useState<string>("all")

    const getStatusBadgeVariant = (status: string | null) => {
        switch (status) {
            case 'delivered': return 'default' as const
            case 'paid': return 'secondary' as const
            case 'refunded': return 'destructive' as const
            case 'cancelled': return 'secondary' as const
            default: return 'outline' as const
        }
    }

    const getStatusText = (status: string | null) => {
        if (!status) return t('order.status.pending')
        return t(`order.status.${status}`) || status
    }

    const filtered = useMemo(() => {
        const q = query.trim().toLowerCase()
        return orders.filter(o => {
            const statusOk = status === 'all' ? true : (o.status || 'pending') === status
            if (!statusOk) return false
            if (!q) return true
            const hay = [
                o.orderId,
                o.username || '',
                o.email || '',
                o.productName,
                o.tradeNo || '',
                o.cardKey || ''
            ].join(' ').toLowerCase()
            return hay.includes(q)
        })
    }, [orders, query, status])

    const statusOptions = [
        { key: 'all', label: t('common.all') },
        { key: 'pending', label: t('order.status.pending') },
        { key: 'paid', label: t('order.status.paid') },
        { key: 'delivered', label: t('order.status.delivered') },
        { key: 'refunded', label: t('order.status.refunded') },
        { key: 'cancelled', label: t('order.status.cancelled') },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-3xl font-bold tracking-tight">{t('admin.orders.title')}</h1>
            </div>

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t('admin.orders.searchPlaceholder')}
                    className="md:w-[360px]"
                />
                <div className="flex flex-wrap gap-2">
                    {statusOptions.map(s => (
                        <Button
                            key={s.key}
                            type="button"
                            variant={status === s.key ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setStatus(s.key)}
                        >
                            {s.label}
                        </Button>
                    ))}
                </div>
            </div>

            <div className="rounded-md border bg-card">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t('admin.orders.orderId')}</TableHead>
                            <TableHead>{t('admin.orders.user')}</TableHead>
                            <TableHead>{t('admin.orders.product')}</TableHead>
                            <TableHead>{t('admin.orders.amount')}</TableHead>
                            <TableHead>{t('admin.orders.status')}</TableHead>
                            <TableHead>{t('admin.orders.tradeNo')}</TableHead>
                            <TableHead>{t('admin.orders.cardKey')}</TableHead>
                            <TableHead>{t('admin.orders.date')}</TableHead>
                            <TableHead className="text-right">{t('admin.orders.actions')}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.map(order => (
                            <TableRow key={order.orderId}>
                                <TableCell className="font-mono text-xs">{order.orderId}</TableCell>
                                <TableCell>
                                    {order.username ? (
                                        <div className="space-y-0.5">
                                            <a
                                                href={`https://linux.do/u/${order.username}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="font-medium text-sm hover:underline text-primary"
                                            >
                                                {order.username}
                                            </a>
                                            {order.email && (
                                                <div className="text-xs text-muted-foreground">
                                                    <CopyButton text={order.email} truncate maxLength={20} />
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="font-medium text-sm text-muted-foreground">Guest</span>
                                    )}
                                </TableCell>
                                <TableCell>{order.productName}</TableCell>
                                <TableCell>{Number(order.amount)}</TableCell>
                                <TableCell>
                                    <Badge variant={getStatusBadgeVariant(order.status)} className="uppercase text-xs">
                                        {getStatusText(order.status)}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {order.tradeNo ? (
                                        <CopyButton text={order.tradeNo} truncate maxLength={12} />
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {order.cardKey ? (
                                        <CopyButton text={order.cardKey} truncate maxLength={15} />
                                    ) : (
                                        <span className="text-muted-foreground">-</span>
                                    )}
                                </TableCell>
                                <TableCell className="text-muted-foreground text-xs">
                                    <ClientDate value={order.createdAt} format="dateTime" />
                                </TableCell>
                                <TableCell className="text-right">
                                    <RefundButton order={order} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    )
}
