import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "./site";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "liquidity pool tracker",
    "LP position tracker",
    "Aerodrome",
    "Uniswap v3",
    "Base network",
    "DeFi portfolio",
    "concentrated liquidity",
    "wallet address",
  ],
  openGraph: {
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    siteName: SITE_NAME,
    type: "website",
    url: SITE_URL,
  },
  twitter: {
    card: "summary",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

/** Dados estruturados do site (Google) — nome/URL vêm de app/site.ts */
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
        <script
          type="application/ld+json"
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <header className="site-header">
          <div className="container">
            <Link href="/" className="brand">
              track<span className="tld">defi</span>
            </Link>
            <span className="header-note">
              <span className="dot-live" aria-hidden />
              Read-only · we never ask for keys
            </span>
          </div>
        </header>
        {children}
        <footer className="site-footer">
          <div className="container">
            <span>
              <strong>{SITE_NAME}</strong> reads public blockchain data only. It never asks for private keys or seed
              phrases, and cannot move funds. <Link href="/how-it-works">How it works &amp; why it&apos;s safe →</Link>
            </span>
            <span>Not financial advice. Verify data on-chain before acting. Prices by DefiLlama.</span>
            <span>
              Coverage: Base · Aerodrome &amp; Uniswap v3 — <Link href="/roadmap">see the roadmap</Link>.
            </span>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
