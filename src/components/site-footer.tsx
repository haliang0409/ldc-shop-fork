'use client'

import { useI18n } from "@/lib/i18n/context"
import type { FooterConfig } from "@/lib/footer-config"

export function SiteFooter({ config }: { config?: FooterConfig | null }) {
    const { t } = useI18n()
    const leftText = (config?.left || '').trim() || t('footer.disclaimer')
    const rightItems = Array.isArray(config?.right) && config!.right!.length
        ? config!.right!
        : [
            { text: 'GitHub: ldc-shop-fork', href: 'https://github.com/haliang0409/ldc-shop-fork' },
            { text: 'Blog: garyblog.net', href: 'https://www.garyblog.net' },
        ]

    return (
        <footer className="border-t border-border/50 py-6 md:py-0 bg-gradient-to-t from-muted/30 to-transparent">
            <div className="container flex flex-col items-center justify-between gap-4 md:h-20 md:flex-row">
                <div className="flex flex-col items-center gap-4 px-8 md:flex-row md:gap-2 md:px-0">
                    <p className="text-center text-xs leading-loose text-muted-foreground/80 md:text-left whitespace-pre-wrap">
                        {leftText}
                    </p>
                </div>
                <div className="flex flex-col items-center gap-2 md:flex-row md:gap-4">
                    {rightItems.map((it, idx) => (
                        it.href ? (
                            <a
                                key={idx}
                                href={it.href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-center text-xs md:text-left text-muted-foreground/60 hover:text-primary transition-colors duration-300"
                            >
                                {it.text}
                            </a>
                        ) : (
                            <span
                                key={idx}
                                className="text-center text-xs md:text-left text-muted-foreground/60"
                            >
                                {it.text}
                            </span>
                        )
                    ))}
                </div>
            </div>
        </footer>
    )
}
