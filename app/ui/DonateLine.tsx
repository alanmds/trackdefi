"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DONATION_ADDRESS, nextPhrase } from "../donate";
import { useI18n } from "../i18n/provider";
import { setPhraseIndex } from "./donatePhrase";

/** onde a rotação fica guardada; o sufixo muda se o formato mudar */
const STORAGE_KEY = "trackdefi.donate.v1";

function readBag(): unknown {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
  } catch {
    return null; // navegação privada, armazenamento bloqueado ou dado corrompido
  }
}

/**
 * Linha de apoio do rodapé. A frase é sorteada NO NAVEGADOR: as páginas são
 * geradas no build, e um sorteio no servidor congelaria a mesma frase para
 * todo mundo até o próximo deploy.
 *
 * Troca de frase a cada página visitada — o layout não remonta quando se
 * navega dentro do site, por isso o efeito depende do caminho da URL. As
 * frases são as do idioma da página; o mesmo `localStorage` serve a todos os
 * idiomas (`parseBag` descarta o que não couber no banco do idioma atual).
 */
export default function DonateLine() {
  const { ui } = useI18n();
  const pathname = usePathname();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const phrases = ui.donate.phrases;

  useEffect(() => {
    const { index, bag } = nextPhrase(readBag(), phrases.length);
    setPhrase(phrases[index]);
    setPhraseIndex(index); // a faixa do topo da página de carteira repete esta frase
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bag));
    } catch {
      /* sem armazenamento: a frase continua aleatória, só não evita repetir */
    }
  }, [pathname, phrases]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(DONATION_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard indisponível — o endereço é selecionável com um clique */
    }
  }

  return (
    <section className="donate" aria-label={ui.donate.aria}>
      {/* antes do sorteio o espaço fica reservado e vazio, para o rodapé não
          pular nem trocar de texto diante do visitante */}
      {phrase ? (
        <p className="donate-phrase donate-in" key={phrase}>
          {phrase}
        </p>
      ) : (
        <p className="donate-phrase" aria-hidden>
          {" "}
        </p>
      )}
      <p className="donate-how">
        <span>{ui.donate.tipJar}</span>
        <code className="donate-addr" translate="no">
          {DONATION_ADDRESS}
        </code>
        <button type="button" className="donate-copy" onClick={copy} aria-label={ui.donate.copyAria}>
          {copied ? ui.donate.copied : ui.donate.copy}
        </button>
        <span className="donate-note">{ui.donate.note}</span>
      </p>
    </section>
  );
}
