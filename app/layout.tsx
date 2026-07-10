import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const fraunces = Fraunces({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-fraunces" });

export const metadata: Metadata = {
  title: "trackdefi — liquidity pool tracker",
  description:
    "See every liquidity pool position of any wallet — including gauge-staked ones. Read-only, no login, no keys. Base · Aerodrome.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${fraunces.variable}`}>
      <body>
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
              <strong>trackdefi</strong> reads public blockchain data only. It never asks for private keys or seed
              phrases, and cannot move funds.
            </span>
            <span>Not financial advice. Verify data on-chain before acting. Prices by DefiLlama.</span>
            <span>Coverage: Base · Aerodrome — more networks coming.</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
