/**
 * Formulário de sugestões (25/09/2026): validação, defesa contra robô e a rota
 * que entrega pelo Resend.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFeedbackEmail, MIN_FILL_MS, validateFeedback } from "../core/feedback";

const AGORA = 1_800_000_000_000;
const valido = { message: "Please add Linea — I have Lynex positions there.", startedAt: AGORA - 20_000 };

describe("validateFeedback", () => {
  it("mensagem normal passa, com tipo padrão 'suggestion'", () => {
    const r = validateFeedback(valido, AGORA);
    expect(r.ok && !r.spam && r.value.kind).toBe("suggestion");
  });

  it("carteira é devolvida no formato checksum", () => {
    const r = validateFeedback({ ...valido, wallet: "0x892ff98a46e5bd141e2d12618f4b2fe6284debac" }, AGORA);
    expect(r.ok && !r.spam && r.value.wallet).toBe("0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac");
  });

  it("e-mail e carteira são opcionais — vazio vira null", () => {
    const r = validateFeedback({ ...valido, email: "  ", wallet: "" }, AGORA);
    expect(r.ok && !r.spam && [r.value.email, r.value.wallet]).toEqual([null, null]);
  });

  it("tipo desconhecido cai em 'suggestion', não quebra", () => {
    const r = validateFeedback({ ...valido, kind: "<script>" }, AGORA);
    expect(r.ok && !r.spam && r.value.kind).toBe("suggestion");
  });

  it("recusa mensagem curta demais e longa demais", () => {
    expect(validateFeedback({ ...valido, message: "hi" }, AGORA)).toEqual({ ok: false, error: "message_too_short" });
    expect(validateFeedback({ ...valido, message: "x".repeat(4001) }, AGORA)).toEqual({ ok: false, error: "message_too_long" });
  });

  it("recusa e-mail e carteira malformados", () => {
    expect(validateFeedback({ ...valido, email: "nao-e-email" }, AGORA)).toEqual({ ok: false, error: "invalid_email" });
    expect(validateFeedback({ ...valido, wallet: "0x123" }, AGORA)).toEqual({ ok: false, error: "invalid_wallet" });
  });

  describe("defesa contra robô", () => {
    it("campo-isca preenchido = robô", () => {
      expect(validateFeedback({ ...valido, website: "http://spam.example" }, AGORA)).toEqual({ ok: true, spam: true });
    });

    it(`enviado em menos de ${MIN_FILL_MS / 1000} s = robô`, () => {
      expect(validateFeedback({ ...valido, startedAt: AGORA - 500 }, AGORA)).toEqual({ ok: true, spam: true });
    });

    it("sem o carimbo de abertura (chamada direta à API) = robô", () => {
      expect(validateFeedback({ message: valido.message }, AGORA)).toEqual({ ok: true, spam: true });
    });

    it("robô é identificado ANTES de validar o resto — nem mensagem inválida gera pista", () => {
      expect(validateFeedback({ website: "x", message: "" }, AGORA)).toEqual({ ok: true, spam: true });
    });
  });
});

describe("buildFeedbackEmail", () => {
  const f = { kind: "missing" as const, message: "My WETH/USDC on Aerodrome, Base, doesn't show.", email: "a@b.co", wallet: "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac", page: "/w/0x892F" };

  it("assunto diz o tipo e começa pela mensagem", () => {
    expect(buildFeedbackEmail(f, "https://trackdefi.app").subject).toBe(
      "[trackdefi] Missing position: My WETH/USDC on Aerodrome, Base, doesn't show.",
    );
  });

  it("corpo traz o link da carteira no site, pronto para reproduzir", () => {
    expect(buildFeedbackEmail(f, "https://trackdefi.app").text).toContain(`https://trackdefi.app/w/${f.wallet}`);
  });

  it("sem e-mail, o corpo avisa que não dá para responder", () => {
    expect(buildFeedbackEmail({ ...f, email: null }, "https://x").text).toContain("can't reply");
  });

  it("assunto longo é cortado com reticências", () => {
    const s = buildFeedbackEmail({ ...f, message: "a ".repeat(80) }, "https://x").subject;
    expect(s.endsWith("…")).toBe(true);
  });
});

describe("POST /api/feedback", () => {
  const envAntes = { ...process.env };
  let chamadas: Array<{ url: string; body: Record<string, unknown> }>;

  beforeEach(() => {
    vi.resetModules(); // limite por IP é estado do módulo: cada teste começa zerado
    chamadas = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        chamadas.push({ url, body: JSON.parse(String(init.body)) });
        return new Response("{}", { status: 200 });
      }),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...envAntes };
  });

  const post = async (body: unknown, ip = "1.1.1.1") => {
    const { POST } = await import("../app/api/feedback/route");
    return POST(new Request("https://trackdefi.app/api/feedback", {
      method: "POST",
      headers: { "x-forwarded-for": ip },
      body: JSON.stringify(body),
    }));
  };
  const agora = () => ({ ...valido, startedAt: Date.now() - 20_000 });

  it("entrega pelo Resend, com o visitante como destinatário da resposta", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    const res = await post({ ...agora(), email: "visitante@example.com" });
    expect(res.status).toBe(200);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe("https://api.resend.com/emails");
    expect(chamadas[0].body.reply_to).toBe("visitante@example.com");
    expect(chamadas[0].body.to).toEqual(["hello@trackdefi.app"]);
  });

  it("robô recebe 200 e NADA é enviado", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    const res = await post({ ...agora(), website: "spam" });
    expect(res.status).toBe(200);
    expect(chamadas).toHaveLength(0);
  });

  it("sem chave NA VERCEL: 503, nunca um 'ok' mentiroso", async () => {
    delete process.env.RESEND_API_KEY;
    process.env.VERCEL = "1";
    expect((await post(agora())).status).toBe(503);
    expect(chamadas).toHaveLength(0);
  });

  it("Resend fora do ar: 502", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    vi.stubGlobal("fetch", vi.fn(async () => new Response("erro", { status: 500 })));
    expect((await post(agora())).status).toBe(502);
  });

  it("mais de 5 mensagens do mesmo IP em 10 min: 429", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    const { POST } = await import("../app/api/feedback/route");
    const envia = () =>
      POST(new Request("https://trackdefi.app/api/feedback", {
        method: "POST",
        headers: { "x-forwarded-for": "9.9.9.9" },
        body: JSON.stringify(agora()),
      }));
    for (let i = 0; i < 5; i++) expect((await envia()).status).toBe(200);
    expect((await envia()).status).toBe(429);
  });

  it("corpo gigante é recusado antes de qualquer processamento", async () => {
    process.env.RESEND_API_KEY = "re_teste";
    const res = await post({ ...agora(), message: "x".repeat(20_000) });
    expect(res.status).toBe(413);
  });
});
