import type { ReactNode } from "react";

export const metadata = {
  title: "trackdefi",
  description: "Track your liquidity pool positions by wallet address — no login, read-only.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
