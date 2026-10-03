/**
 * Guardas contra informação desatualizada (02/10/2026) — a parte da
 * `privado/CHECKLIST_ATUALIZACAO.md` que dá para vigiar por teste.
 *
 * Quebrou? Não é defeito do site: é um lugar que ficou para trás quando
 * entrou rede, protocolo ou funcionalidade. O nome do teste diz QUAL lugar;
 * a checklist diz o que mais costuma mudar junto.
 */

import { describe, expect, it } from "vitest";
import { buildAdapters } from "../core/adapters/registry";
import { poolLayout } from "../core/yields/onchain";
import { protocolLabel } from "../app/ui/format";
import { PROTOCOL_FAMILIES } from "../app/site";
import { LOCALES } from "../app/i18n/config";
import { getMessages } from "../app/i18n/get";

const protocolos = [...new Set(buildAdapters().map((a) => a.protocol))];

/** protocolos sem contrato de pool próprio (singleton): o fee APR medido no pool não se aplica */
const SEM_POOL_PROPRIO = new Set(["uniswap-v4"]);

describe("protocolo novo — partes de código", () => {
  it.each(protocolos)("%s tem nome legível na tela (PROTOCOL_LABELS em app/ui/format.ts)", (p) => {
    // sem entrada, o card mostra o id cru ("ramses-v3") no lugar do nome
    expect(protocolLabel(p)).not.toBe(p);
  });

  it.each(protocolos.filter((p) => !SEM_POOL_PROPRIO.has(p)))(
    "%s tem layout de pool para o fee APR (LAYOUTS em core/yields/onchain.ts)",
    (p) => {
      // sem layout, o "Earning now" medido some em silêncio: vira "—" para sempre
      expect(poolLayout(p)).not.toBeNull();
    },
  );
});

/**
 * Frases que listam as famílias de protocolo À MÃO. Título e meta description
 * já saem de `PROTOCOL_FAMILIES` sozinhos (com o corte por volume); estas não —
 * e foi assim que ficaram para trás antes. Família nova = acrescentar o nome
 * nestas frases, em todos os idiomas (e conferir a largura do cartão OG).
 */
describe("protocolo novo — frases que citam as famílias à mão", () => {
  for (const { code } of LOCALES) {
    const m = getMessages(code);
    const frases: Record<string, string> = {
      "ui.wallet.scanningBody": m.ui.wallet.scanningBody,
      "ui.wallet.empty.body": m.ui.wallet.empty.body,
      "pages.home.faq[0].a": m.pages.home.faq[0].a,
      "pages.roadmap.description": m.pages.roadmap.description,
      "pages.meta.keywordsBase": m.pages.meta.keywordsBase.join(" · "),
      "pages.meta.ogProtocols": m.pages.meta.ogProtocols,
    };
    for (const [onde, texto] of Object.entries(frases)) {
      it(`${code}: ${onde} cita todas as famílias`, () => {
        const faltam = PROTOCOL_FAMILIES.filter((f) => !texto.includes(f));
        expect(faltam, `faltam em ${onde} (${code})`).toEqual([]);
      });
    }
  }
});
