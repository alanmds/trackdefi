"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { DONATION_ADDRESS, DONATION_PHRASES, nextPhrase } from "../donate";

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
 * navega dentro do site, por isso o efeito depende do caminho da URL.
 */
export default function DonateLine() {
  const pathname = usePathname();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const { index, bag } = nextPhrase(readBag(), DONATION_PHRASES.length);
    setPhrase(DONATION_PHRASES[index]);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bag));
    } catch {
      /* sem armazenamento: a frase continua aleatória, só não evita repetir */
    }
  }, [pathname]);

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
    <section className="donate" aria-label="Support trackdefi">
      {/* antes do sorteio o espaço fica reservado e vazio, para o rodapé não
          pular nem trocar de texto diante do visitante */}
      {phrase ? (
        <p className="donate-phrase donate-in" key={phrase}>
          {phrase}
        </p>
      ) : (
        <p className="donate-phrase" aria-hidden>
          {" "}
        </p>
      )}
      <p className="donate-how">
        <span>Tip jar</span>
        <code className="donate-addr" translate="no">
          {DONATION_ADDRESS}
        </code>
        <button type="button" className="donate-copy" onClick={copy} aria-label="Copy tip address">
          {copied ? "Copied ✓" : "Copy"}
        </button>
        <span className="donate-note">Same address on any EVM network · always optional</span>
      </p>
    </section>
  );
}
