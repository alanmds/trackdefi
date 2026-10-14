import type { Metadata } from "next";
import Link from "next/link";
import { parseWalletAddress, shortAddress } from "../../../../core/address";
import { localePath } from "../../../i18n/config";
import { getMessages } from "../../../i18n/get";
import { fill } from "../../../i18n/rich";
import { localeFrom } from "../../../i18n/server";
import PositionsView from "../../../ui/PositionsView";

type Props = { params: Promise<{ lang: string; address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await localeFrom(params);
  const { address } = await params;
  const label = parseWalletAddress(address)
    ? shortAddress(address)
    : getMessages(lang).pages.meta.walletFallback;
  // páginas de carteira são infinitas/dinâmicas: fora do índice do Google
  // (o robots.txt bloqueia a varredura; isto cobre links externos diretos)
  return { title: label, robots: { index: false, follow: false } };
}

export default async function WalletPage({ params }: Props) {
  const lang = await localeFrom(params);
  const { address } = await params;

  const parsed = parseWalletAddress(address);
  if (!parsed) {
    const t = getMessages(lang).ui.wallet.invalidAddress;
    return (
      <main className="container">
        <div className="state-box error" role="alert">
          <h2>{t.title}</h2>
          <p>{fill(t.body, { address: address.slice(0, 60) })}</p>
          <Link href={localePath(lang, "/")} className="btn">
            {t.back}
          </Link>
        </div>
      </main>
    );
  }

  return <PositionsView address={parsed.address} />;
}
