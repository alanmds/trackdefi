import type { Metadata } from "next";
import Link from "next/link";
import { getAddress, isAddress } from "viem";
import PositionsView from "../../ui/PositionsView";

type Props = { params: Promise<{ address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { address } = await params;
  const label = isAddress(address) ? `${address.slice(0, 6)}…${address.slice(-4)}` : "wallet";
  return { title: `${label} — trackdefi` };
}

export default async function WalletPage({ params }: Props) {
  const { address } = await params;

  if (!isAddress(address)) {
    return (
      <main className="container">
        <div className="state-box error" role="alert">
          <h2>Invalid address</h2>
          <p>“{address.slice(0, 60)}” is not a valid wallet address.</p>
          <Link href="/" className="btn">
            Back to search
          </Link>
        </div>
      </main>
    );
  }

  return <PositionsView address={getAddress(address)} />;
}
