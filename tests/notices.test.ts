/**
 * Textos de aviso da varredura (app/ui/notices.ts). A regra que este arquivo
 * trava: "Refresh to retry" só onde recarregar ajuda, e preço ausente nunca
 * se apresenta como erro do site — foi essa confusão que abriu a frente em
 * 26/09/2026.
 */

import { describe, expect, it } from "vitest";
import type { ScanNotice } from "../core/service";
import { noPriceSummaryTip, noPriceTip, noticeText } from "../app/ui/notices";

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
    for (const n of retry) expect(noticeText(n).retry, n.kind).toBe(true);
    for (const n of fixo) expect(noticeText(n).retry, n.kind).toBe(false);
  });

  it("diz ONDE: nome do protocolo e da rede, não o id interno", () => {
    const t = noticeText({ kind: "source", protocol: "uniswap-v3", chainId: 8453 }).text;
    expect(t).toContain("Uniswap v3 on Base");
    expect(t).not.toContain("uniswap-v3");
  });

  it("singular e plural nas taxas estimadas", () => {
    expect(noticeText({ kind: "fees", positions: 1 }).text).toContain("1 position — its fee rate");
    expect(noticeText({ kind: "fees", positions: 3 }).text).toContain("3 positions — their fee rate");
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
    for (const n of todos) expect(noticeText(n).text).not.toMatch(/indispon|posi[çc]|RPC|fee APR/i);
  });
});

describe("tooltip de preço ausente", () => {
  it("sem falha na fonte: não é erro e recarregar não muda", () => {
    const t = noPriceTip(["AA"], false);
    expect(t).toContain("AA");
    expect(t).toContain("isn't an error");
    expect(t).toContain("refreshing won't change it");
  });

  it("com falha na fonte nesta varredura: não promete que é permanente", () => {
    const t = noPriceTip(["AA"], true);
    expect(t).not.toContain("won't change");
    expect(noPriceSummaryTip("positions", true)).toContain("refreshing may bring those back");
  });

  it("vários tokens viram lista, sem repetir", () => {
    expect(noPriceTip(["AA", "XYZ", "AA"], false)).toContain("AA and XYZ");
    expect(noPriceTip(["AA", "XYZ"], false)).toContain("doesn't cover them");
  });
});
