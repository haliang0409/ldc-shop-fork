import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";
import { getSetting } from "@/lib/db/queries";
import { normalizeFooterConfig, parseFooterConfig } from "@/lib/footer-config";

const inter = Inter({ subsets: ["latin"] });

const DEFAULT_TITLE = "LDC Virtual Goods Shop";
const DEFAULT_DESCRIPTION = "High-quality virtual goods, instant delivery";

export async function generateMetadata(): Promise<Metadata> {
  let shopName: string | null = null;
  try {
    shopName = await getSetting("shop_name");
  } catch {
    shopName = null;
  }
  return {
    title: shopName?.trim() || DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // This layout remains sync for streaming; footer config is fetched in a nested async boundary.
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn("min-h-screen bg-background font-sans antialiased", inter.className)}>
        <Providers>
          <div className="relative flex min-h-screen flex-col">
            <SiteHeader />
            <div className="flex-1">{children}</div>
            <FooterWithConfig />
          </div>
        </Providers>
      </body>
    </html>
  );
}

async function FooterWithConfig() {
  let footerConfig = null
  try {
    const raw = await getSetting("footer_config")
    footerConfig = normalizeFooterConfig(parseFooterConfig(raw))
  } catch {
    footerConfig = null
  }
  return <SiteFooter config={footerConfig} />
}
