/**
 * `lastmod` do sitemap que não envelhece calado (02/10/2026).
 *
 * As datas de `app/sitemap-datas.ts` são escritas à mão — de propósito (ver o
 * comentário lá). O risco é o contrário: o texto da página muda e ninguém
 * lembra da data. Foi o que aconteceu em 02/10/2026 com o `/how-it-works` e o
 * `/glossary` (mudaram com a PancakeSwap e a Ramses; o sitemap ainda dizia
 * 27/09). Este teste guarda uma impressão digital do texto de cada página,
 * em todos os idiomas.
 *
 * Quebrou? O texto daquela página mudou. Faça as DUAS coisas:
 *  1. `EDITADA_EM.<página>` em `app/sitemap-datas.ts` = o dia do deploy;
 *  2. aqui, `data` = a mesma data e `hash` = o valor que o teste mostrou.
 */

import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../app/i18n/config";
import { getMessages } from "../app/i18n/get";
import { EDITADA_EM } from "../app/sitemap-datas";

const IMPRESSAO: Record<keyof typeof EDITADA_EM, { data: string; hash: string }> = {
  home: { data: "2026-10-02", hash: "08dafe595df66199" },
  howItWorks: { data: "2026-10-02", hash: "70213f1268a272af" },
  roadmap: { data: "2026-10-07", hash: "73a118a98b1ffaaf" },
  glossary: { data: "2026-10-02", hash: "f57c180473922052" },
};

/** texto da página em todos os idiomas → 16 caracteres de sha256 */
function impressao(pagina: keyof typeof EDITADA_EM): string {
  const textos = LOCALES.map((l) => (getMessages(l.code).pages as unknown as Record<string, unknown>)[pagina]);
  return createHash("sha256").update(JSON.stringify(textos)).digest("hex").slice(0, 16);
}

describe("sitemap: a data acompanha o texto", () => {
  for (const pagina of Object.keys(IMPRESSAO) as Array<keyof typeof EDITADA_EM>) {
    it(`${pagina}: texto conhecido e data em dia`, () => {
      const agora = impressao(pagina);
      expect(
        agora,
        `o texto de "${pagina}" mudou — ponha EDITADA_EM.${pagina} (app/sitemap-datas.ts) e a data daqui no dia do deploy, e hash: "${agora}"`,
      ).toBe(IMPRESSAO[pagina].hash);
      expect(EDITADA_EM[pagina], `EDITADA_EM.${pagina} diferente da data registrada aqui`).toBe(IMPRESSAO[pagina].data);
    });
  }
});
