import { describe, expect, it } from "vitest";
import { redactUrls } from "../core/redact";

describe("redactUrls", () => {
  it("tira a chave da URL da Alchemy e mantém o host", () => {
    const msg =
      "nenhuma factory respondeu — causa: HTTP request failed. |  | URL: https://base-mainnet.g.alchemy.com/v2/abcDEF123_segredo";
    const out = redactUrls(msg);
    expect(out).not.toContain("abcDEF123_segredo");
    expect(out).toContain("https://base-mainnet.g.alchemy.com/…");
  });

  it("tira query string e credencial embutida", () => {
    const out = redactUrls("falhou https://user:senha@rpc.example.com/path?apikey=XYZ e seguiu");
    expect(out).toBe("falhou https://rpc.example.com/… e seguiu");
  });

  it("cobre websocket e várias URLs no mesmo texto", () => {
    const out = redactUrls("a wss://ws.example.io/k1 b https://mainnet.base.org");
    expect(out).toBe("a wss://ws.example.io/… b https://mainnet.base.org/…");
  });

  it("não mexe em texto sem URL", () => {
    const msg = "fee APR on-chain indisponível em 2 pool(s) — o RPC não devolveu o estado passado";
    expect(redactUrls(msg)).toBe(msg);
  });
});
