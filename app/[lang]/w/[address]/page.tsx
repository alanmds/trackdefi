import type { Metadata } from "next";
import Link from "next/link";
import { parseWalletAddress, shortAddress } from "../../../../core/address";
import { localePath } from "../../../i18n/config";
import { getMessages } from "../../../i18n/get";
import { fill } from "../../../i18n/rich";
import { ogImage } from "../../../i18n/seo";
import { localeFrom } from "../../../i18n/server";
import PositionsView from "../../../ui/PositionsView";
import { SITE_NAME } from "../../../site";

type Props = { params: Promise<{ lang: string; address: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const lang = await localeFrom(params);
  const { address } = await params;
  const meta = getMessages(lang).pages.meta;
  const valid = parseWalletAddress(address);
  const label = valid ? shortAddress(address) : meta.walletFallback;
  // páginas de carteira são infinitas/dinâmicas: fora do índice do Google
  // (o robots.txt bloqueia a varredura; isto cobre links externos diretos)
  const base: Metadata = { title: label, robots: { index: false, follow: false } };
  if (!valid) return base;

  /* Prévia do link compartilhado (12/11/2026): antes, o link de uma carteira
     aparecia no X/Telegram/WhatsApp com o título e a descrição da HOME. Agora
     diz de quem são as posições. A imagem é a mesma do site, de propósito:
     é estática (custo zero) — uma imagem por carteira exigiria uma varredura
     a cada robô de prévia, e a CPU é o recurso apertado do plano. Sem número
     nenhum na prévia: valor só aparece lido na hora, na página. */
  const title = `${fill(meta.walletShareTitle, { address: label })} — ${SITE_NAME}`;
  const description = meta.walletShareDescription;
  const image = ogImage(lang);
  return {
    ...base,
    description,
    openGraph: {
      title,
      description,
      siteName: SITE_NAME,
      type: "website",
      url: localePath(lang, `/w/${valid.address}`),
      images: [image],
    },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
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
