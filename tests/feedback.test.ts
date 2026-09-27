/**
 * Formulário de feedback (25/09/2026): validação, defesa contra robô e a rota
 * que entrega no Gmail do dono por um Google Apps Script.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildFeedbackEmail, MIN_FILL_MS, validateFeedback } from "../core/feedback";

const AGORA = 1_800_000_000_000;
const valido = { message: "Please add Linea — I have Lynex positions there.", startedAt: AGORA - 20_000 };

describe("validateFeedback", () => {
  it("mensagem normal passa", () => {
    const r = validateFeedback(valido, AGORA);
    expect(r.ok && !r.spam && r.value.message).toBe(valido.message);
  });

  it("e-mail é opcional — vazio vira null", () => {
    const r = validateFeedback({ ...valido, email: "  " }, AGORA);
    expect(r.ok && !r.spam && r.value.email).toBeNull();
  });

  it("recusa mensagem curta demais e longa demais", () => {
    expect(validateFeedback({ ...valido, message: "hi" }, AGORA)).toEqual({ ok: false, error: "message_too_short" });
    expect(validateFeedback({ ...valido, message: "x".repeat(4001) }, AGORA)).toEqual({ ok: false, error: "message_too_long" });
  });

  it("recusa e-mail malformado", () => {
    expect(validateFeedback({ ...valido, email: "nao-e-email" }, AGORA)).toEqual({ ok: false, error: "invalid_email" });
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
  const f = { message: "My WETH/USDC on Aerodrome, Base, doesn't show.", email: "a@b.co", page: "/w/0x892F" };

  it("assunto começa pela mensagem", () => {
    expect(buildFeedbackEmail(f, "https://trackdefi.app").subject).toBe(
      "[trackdefi feedback] My WETH/USDC on Aerodrome, Base, doesn't show.",
    );
  });

  it("corpo traz a página de onde o visitante veio, como link completo", () => {
    expect(buildFeedbackEmail(f, "https://trackdefi.app").text).toContain("https://trackdefi.app/w/0x892F");
  });

  it("sem e-mail, o corpo avisa que não dá para responder", () => {
    expect(buildFeedbackEmail({ ...f, email: null }, "https://x").text).toContain("can't reply");
  });

  it("assunto longo é cortado com reticências", () => {
    expect(buildFeedbackEmail({ ...f, message: "a ".repeat(80) }, "https://x").subject.endsWith("…")).toBe(true);
  });
});

describe("POST /api/feedback", () => {
  const envAntes = { ...process.env };
  const SCRIPT = "https://script.google.com/macros/s/TESTE/exec";
  let chamadas: Array<{ url: string; body: Record<string, unknown> }>;

  const scriptResponde = (texto: string, status = 200) =>
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init: RequestInit) => {
        chamadas.push({ url, body: JSON.parse(String(init.body)) });
        return new Response(texto, { status });
      }),
    );

  beforeEach(() => {
    vi.resetModules(); // limite por IP é estado do módulo: cada teste começa zerado
    chamadas = [];
    scriptResponde("ok");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...envAntes };
  });

  const post = async (body: unknown, ip = "1.1.1.1") => {
    const { POST } = await import("../app/api/feedback/route");
    return POST(
      new Request("https://trackdefi.app/api/feedback", {
        method: "POST",
        headers: { "x-forwarded-for": ip },
        body: JSON.stringify(body),
      }),
    );
  };
  const agora = () => ({ ...valido, startedAt: Date.now() - 20_000 });

  it("entrega no script, com o visitante como destino da resposta", async () => {
    process.env.FEEDBACK_WEBHOOK_URL = SCRIPT;
    const res = await post({ ...agora(), email: "visitante@example.com" });
    expect(res.status).toBe(200);
    expect(chamadas).toHaveLength(1);
    expect(chamadas[0].url).toBe(SCRIPT);
    expect(chamadas[0].body.replyTo).toBe("visitante@example.com");
    expect(String(chamadas[0].body.subject)).toContain("[trackdefi feedback]");
  });

  it("o endereço de destino não passa por aqui: quem sabe é só o script", async () => {
    process.env.FEEDBACK_WEBHOOK_URL = SCRIPT;
    await post(agora());
    expect(Object.keys(chamadas[0].body).sort()).toEqual(["replyTo", "subject", "text"]);
  });

  it("robô recebe 200 e NADA é enviado", async () => {
    process.env.FEEDBACK_WEBHOOK_URL = SCRIPT;
    expect((await post({ ...agora(), website: "spam" })).status).toBe(200);
    expect(chamadas).toHaveLength(0);
  });

  it("sem a URL NA VERCEL: 503, nunca um 'ok' mentiroso", async () => {
    delete process.env.FEEDBACK_WEBHOOK_URL;
    process.env.VERCEL = "1";
    expect((await post(agora())).status).toBe(503);
    expect(chamadas).toHaveLength(0);
  });

  it("script com erro devolve página HTML com status 200 — isso NÃO conta como entregue", async () => {
    process.env.FEEDBACK_WEBHOOK_URL = SCRIPT;
    scriptResponde("<html>TypeError: Cannot read properties…</html>", 200);
    expect((await post(agora())).status).toBe(502);
  });

  it("script fora do ar: 502", async () => {
    process.env.FEEDBACK_WEBHOOK_URL = SCRIPT;
    scriptResponde("erro", 500);
    expect((await post(agora())).status).toBe(502);
  });

  it("mais de 5 mensagens do mesmo IP em 10 min: 429", async () => {
    process.env.FEEDBACK_WEBHOOK_URL = SCRIPT;
    const { POST } = await import("../app/api/feedback/route");
    const envia = () =>
      POST(
        new Request("https://trackdefi.app/api/feedback", {
          method: "POST",
          headers: { "x-forwarded-for": "9.9.9.9" },
          body: JSON.stringify(agora()),
        }),
      );
    for (let i = 0; i < 5; i++) expect((await envia()).status).toBe(200);
    expect((await envia()).status).toBe(429);
  });

  it("corpo gigante é recusado antes de qualquer processamento", async () => {
    process.env.FEEDBACK_WEBHOOK_URL = SCRIPT;
    expect((await post({ ...agora(), message: "x".repeat(20_000) })).status).toBe(413);
  });
});
