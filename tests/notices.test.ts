/**
 * Textos de aviso da varredura (app/ui/notices.ts). A regra que este arquivo
 * trava: "Refresh to retry" só onde recarregar ajuda, e preço ausente nunca
 * se apresenta como erro do site — foi essa confusão que abriu a frente em
 * 26/09/2026.
 */

import { describe, expect, it } from "vitest";
import type { ScanNotice } from "../core/service";
import type { I18n } from "../app/i18n/provider";
import ui from "../app/i18n/messages/en/ui";
import { noPriceSummaryTip, noPriceTip, noticeText } from "../app/ui/notices";

const en: I18n = { locale: "en", ui };

describe("noticeText", () => {
  it("falha de leitura pede para recarregar; limite conhecido não", () => {
    const retry: ScanNotice[] = [
      { kind: "source", protocol: "aerodrome", chainId: 8453 },
      { kind: "partial", protocol: "uniswap-v4", chainId: 4663 },
      { kind: "locks", protocol: "velodrome", chainId: 10 },
      { kind: "prices" },
      { kind: "apr" },
    ];
    const fixo: ScanNotice[] = [
      { kind: "fees", positions: 2 },
      { kind: "capped", protocol: "uniswap-v3", chainId: 1, checked: 500 },
      { kind: "hooks", protocol: "uniswap-v4", chainId: 4663, positions: 1 },
    ];
    for (const n of retry) expect(noticeText(n, en).retry, n.kind).toBe(true);
    for (const n of fixo) expect(noticeText(n, en).retry, n.kind).toBe(false);
  });

  it("diz ONDE: nome do protocolo e da rede, não o id interno", () => {
    const t = noticeText({ kind: "source", protocol: "uniswap-v3", chainId: 8453 }, en).text;
    expect(t).toContain("Uniswap v3 on Base");
    expect(t).not.toContain("uniswap-v3");
  });

  it("singular e plural nas taxas estimadas", () => {
    expect(noticeText({ kind: "fees", positions: 1 }, en).text).toContain("1 position — its fee rate");
    expect(noticeText({ kind: "fees", positions: 3 }, en).text).toContain("3 positions — their fee rate");
  });

  it("nenhum texto vaza o log interno em português", () => {
    const todos: ScanNotice[] = [
      { kind: "source", protocol: "aerodrome", chainId: 8453 },
      { kind: "partial", protocol: "aerodrome", chainId: 8453 },
      { kind: "locks", protocol: "aerodrome", chainId: 8453 },
      { kind: "prices" },
      { kind: "apr" },
      { kind: "fees", positions: 1 },
      { kind: "capped", protocol: "uniswap-v3", chainId: 8453, checked: 500 },
      { kind: "hooks", protocol: "uniswap-v4", chainId: 4663, positions: 2 },
    ];
    for (const n of todos) expect(noticeText(n, en).text).not.toMatch(/indispon|posi[çc]|RPC|fee APR/i);
  });
});

describe("tooltip de preço ausente", () => {
  it("sem falha na fonte: não é erro e recarregar não muda", () => {
    const t = noPriceTip(["XYZ"], false, en);
    expect(t).toContain("XYZ");
    expect(t).toContain("isn't an error");
    expect(t).toContain("refreshing won't change it");
  });

  it("com falha na fonte nesta varredura: não promete que é permanente", () => {
    const t = noPriceTip(["XYZ"], true, en);
    expect(t).not.toContain("won't change");
    expect(noPriceSummaryTip("positions", true, en)).toContain("refreshing may bring those back");
  });

  it("vários tokens viram lista, sem repetir", () => {
    expect(noPriceTip(["XYZ", "ABC", "XYZ"], false, en)).toContain("XYZ and ABC");
    expect(noPriceTip(["XYZ", "ABC"], false, en)).toContain("doesn't cover them");
  });
});
