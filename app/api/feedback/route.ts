/**
 * POST /api/feedback — formulário de sugestões.
 *
 * Casca fina de HTTP sobre `core/feedback.ts`: limite por IP, teto de tamanho,
 * validação e entrega por e-mail pelo Resend (API HTTPS, sem pacote npm).
 *
 * SEM cabeçalho de CORS de propósito: ao contrário de `/api/positions`, que é
 * pública, esta rota só deve receber do próprio site. Navegador em outra
 * origem é barrado no preflight; robô que chama direto esbarra no limite por
 * IP e nas defesas de `core/feedback.ts`.
 *
 * Configuração (painel da Vercel — não viaja por git, ver INFRA_E_DOMINIO.md):
 *   RESEND_API_KEY  obrigatória em produção
 *   FEEDBACK_TO     padrão hello@trackdefi.app
 *   FEEDBACK_FROM   padrão "trackdefi feedback <feedback@trackdefi.app>"
 *                   (o domínio precisa estar verificado no Resend)
 *
 * Respostas:
 *   200 { ok: true }                 — entregue (ou robô descartado em silêncio)
 *   400 { error: "<motivo>" }        — mensagem curta/longa, e-mail ou carteira inválidos
 *   413 { error: "too_large" }
 *   429 { error: "rate_limited" }
 *   502 { error: "upstream" }        — o Resend falhou
 *   503 { error: "not_configured" }  — falta a chave em produção
 */

import { buildFeedbackEmail, validateFeedback, type FeedbackInput } from "../../../core/feedback";
import { FixedWindowLimiter } from "../../../core/guards";
import { FEEDBACK_EMAIL, SITE_URL } from "../../site";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
// generoso para pessoa (5 mensagens em 10 min), apertado para robô
const limiter = new FixedWindowLimiter(10 * 60_000, 5);

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function POST(request: Request): Promise<Response> {
  const ip = (request.headers.get("x-forwarded-for") ?? "local").split(",")[0].trim();
  if (!limiter.check(ip)) return json({ error: "rate_limited" }, 429);

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return json({ error: "too_large" }, 413);

  let input: FeedbackInput;
  try {
    input = JSON.parse(raw) as FeedbackInput;
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const r = validateFeedback(input, Date.now());
  if (!r.ok) return json({ error: r.error }, 400);
  if (r.spam) return json({ ok: true }, 200); // robô: "ok" e descarte, sem pista

  const { subject, text } = buildFeedbackEmail(r.value, SITE_URL);
  const key = process.env.RESEND_API_KEY?.trim();

  if (!key) {
    // Modo local: sem chave e fora da Vercel, só imprime no terminal — dá para
    // testar a tela inteira sem conta no Resend. Em produção, falta de chave é
    // erro de configuração, nunca "ok" mentiroso.
    if (!process.env.VERCEL) {
      console.log(`\n[feedback — modo local, NÃO enviado]\n${subject}\n${text}\n`);
      return json({ ok: true }, 200);
    }
    return json({ error: "not_configured" }, 503);
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: process.env.FEEDBACK_FROM?.trim() || "trackdefi feedback <feedback@trackdefi.app>",
        to: [process.env.FEEDBACK_TO?.trim() || FEEDBACK_EMAIL],
        // responder direto ao visitante, quando ele deixou e-mail
        ...(r.value.email ? { reply_to: r.value.email } : {}),
        subject,
        text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return json({ error: "upstream" }, 502);
    return json({ ok: true }, 200);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
