/**
 * POST /api/feedback — formulário de feedback.
 *
 * Casca fina de HTTP sobre `core/feedback.ts`: limite por IP, teto de tamanho,
 * validação e entrega no Gmail do Alan por um Google Apps Script publicado na
 * conta dele (`scripts/feedback-apps-script.gs`).
 *
 * O endereço de destino NÃO existe neste código nem no navegador: o script
 * manda para o próprio dono. O que fica na Vercel é só a URL do script, que é
 * longa e aleatória — ela é o segredo. Vazada, o pior caso é alguém mandar
 * e-mail para o Alan (limitado a 100/dia pelo Google); ninguém lê a caixa.
 *
 * SEM cabeçalho de CORS de propósito: ao contrário de `/api/positions`, que é
 * pública, esta rota só deve receber do próprio site.
 *
 * Configuração (painel da Vercel — não viaja por git):
 *   FEEDBACK_WEBHOOK_URL   a URL de implantação do Apps Script (termina em /exec)
 *
 * Respostas:
 *   200 { ok: true }                 — entregue (ou robô descartado em silêncio)
 *   400 { error: "<motivo>" }        — mensagem curta/longa ou e-mail inválido
 *   413 { error: "too_large" }
 *   429 { error: "rate_limited" }
 *   502 { error: "upstream" }        — o script não confirmou o envio
 *   503 { error: "not_configured" }  — falta a URL em produção
 */

import { buildFeedbackEmail, validateFeedback, type FeedbackInput } from "../../../core/feedback";
import { FixedWindowLimiter } from "../../../core/guards";
import { SITE_URL } from "../../site";

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
  const url = process.env.FEEDBACK_WEBHOOK_URL?.trim();

  if (!url) {
    // Modo local: sem URL e fora da Vercel, só imprime no terminal — dá para
    // testar a tela inteira sem o script. Em produção, falta de URL é erro de
    // configuração, nunca "ok" mentiroso.
    if (!process.env.VERCEL) {
      console.log(`\n[feedback — modo local, NÃO enviado]\n${subject}\n${text}\n`);
      return json({ ok: true }, 200);
    }
    return json({ error: "not_configured" }, 503);
  }

  try {
    // O Apps Script responde com um redirecionamento para a saída do script;
    // o fetch segue sozinho. Só vale como entregue se o script disser "ok" —
    // erro de script volta como página HTML com status 200.
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ subject, text, replyTo: r.value.email ?? "" }),
      signal: AbortSignal.timeout(15_000),
    });
    const resposta = (await res.text()).trim();
    if (!res.ok || resposta !== "ok") return json({ error: "upstream" }, 502);
    return json({ ok: true }, 200);
  } catch {
    return json({ error: "upstream" }, 502);
  }
}
