/**
 * Formulário de feedback — parte PURA: validação e montagem da mensagem.
 * A rota `app/api/feedback/route.ts` só faz HTTP em volta disto.
 *
 * Desenho decidido pelo Alan em 25/09/2026, depois de descartar e-mail próprio
 * no domínio (a Hostinger cobra) e qualquer serviço que exija conta nova:
 *   - um link "Feedback" no rodapé abre um formulário no próprio site;
 *   - a mensagem chega no Gmail dele, e o visitante NÃO vê o endereço;
 *   - a entrega é um Google Apps Script na conta Google que ele já tem
 *     (`scripts/feedback-apps-script.gs`). Nenhuma senha fica guardada em
 *     lugar nenhum: o script só sabe mandar e-mail para o próprio dono.
 *
 * DEFESA CONTRA ROBÔ — todo formulário público recebe lixo automatizado em
 * poucos dias. Em camadas, sem incomodar pessoa:
 *   1. campo-isca (`website`), escondido da pessoa: robô preenche, pessoa não;
 *   2. tempo mínimo entre abrir o formulário e enviar;
 *   3. limite por IP e teto de tamanho (na rota).
 * Envio de robô recebe "ok" e é DESCARTADO em silêncio: responder erro só
 * ensinaria o robô a contornar.
 */

export const MIN_MESSAGE = 5;
export const MAX_MESSAGE = 4000;
/** menos que isto entre abrir e enviar = robô */
export const MIN_FILL_MS = 3000;

export interface FeedbackInput {
  message?: unknown;
  email?: unknown;
  page?: unknown;
  /** campo-isca: TEM que chegar vazio */
  website?: unknown;
  /** Date.now() do navegador quando o formulário abriu */
  startedAt?: unknown;
}

export interface Feedback {
  message: string;
  email: string | null;
  page: string | null;
}

export type FeedbackResult =
  | { ok: true; spam: false; value: Feedback }
  | { ok: true; spam: true }
  | { ok: false; error: "message_too_short" | "message_too_long" | "invalid_email" };

// simples de propósito: a validação de verdade de um e-mail é responder a ele
const RX_EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;

const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** PURA. `nowMs` injetável para os testes. */
export function validateFeedback(input: FeedbackInput, nowMs: number): FeedbackResult {
  // robô primeiro: nem chega a ser validado
  if (texto(input.website) !== "") return { ok: true, spam: true };
  const inicio = typeof input.startedAt === "number" ? input.startedAt : Number.NaN;
  if (!Number.isFinite(inicio) || nowMs - inicio < MIN_FILL_MS) return { ok: true, spam: true };

  const message = texto(input.message);
  if (message.length < MIN_MESSAGE) return { ok: false, error: "message_too_short" };
  if (message.length > MAX_MESSAGE) return { ok: false, error: "message_too_long" };

  const emailRaw = texto(input.email);
  if (emailRaw !== "" && (emailRaw.length > 254 || !RX_EMAIL.test(emailRaw))) return { ok: false, error: "invalid_email" };

  const page = texto(input.page).slice(0, 200);
  return {
    ok: true,
    spam: false,
    value: { message, email: emailRaw === "" ? null : emailRaw, page: page === "" ? null : page },
  };
}

/**
 * PURA: assunto e corpo do e-mail que chega no Gmail. Texto puro (sem HTML):
 * nada que o visitante escreve vira marcação.
 */
export function buildFeedbackEmail(f: Feedback, siteUrl: string): { subject: string; text: string } {
  const resumo = f.message.replace(/\s+/g, " ").slice(0, 60);
  const subject = `[trackdefi feedback] ${resumo}${f.message.length > 60 ? "…" : ""}`;
  const linhas = [`From:  ${f.email ?? "(no email — can't reply)"}`];
  if (f.page) linhas.push(`Page:  ${siteUrl}${f.page}`);
  linhas.push("", f.message);
  return { subject, text: linhas.join("\n") };
}
