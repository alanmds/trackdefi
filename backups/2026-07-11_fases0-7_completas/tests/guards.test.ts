import { describe, expect, it } from "vitest";
import { FixedWindowLimiter, TtlCache } from "../core/guards";

describe("TtlCache", () => {
  it("guarda e devolve dentro do TTL; expira depois", () => {
    let t = 0;
    const c = new TtlCache<string>(1000, () => t);
    c.set("a", "x");
    expect(c.get("a")).toBe("x");
    t = 999;
    expect(c.get("a")).toBe("x");
    t = 1000;
    expect(c.get("a")).toBeUndefined();
  });

  it("chave inexistente é undefined", () => {
    const c = new TtlCache<string>(1000);
    expect(c.get("nope")).toBeUndefined();
  });
});

describe("FixedWindowLimiter", () => {
  it("permite até max e bloqueia o excedente na janela", () => {
    let t = 0;
    const l = new FixedWindowLimiter(1000, 3, () => t);
    expect(l.check("ip")).toBe(true);
    expect(l.check("ip")).toBe(true);
    expect(l.check("ip")).toBe(true);
    expect(l.check("ip")).toBe(false); // 4ª estoura
  });

  it("libera de novo quando a janela passa", () => {
    let t = 0;
    const l = new FixedWindowLimiter(1000, 1, () => t);
    expect(l.check("ip")).toBe(true);
    expect(l.check("ip")).toBe(false);
    t = 1000;
    expect(l.check("ip")).toBe(true);
  });

  it("chaves (IPs) diferentes são independentes", () => {
    let t = 0;
    const l = new FixedWindowLimiter(1000, 1, () => t);
    expect(l.check("ip1")).toBe(true);
    expect(l.check("ip2")).toBe(true);
    expect(l.check("ip1")).toBe(false);
  });
});
