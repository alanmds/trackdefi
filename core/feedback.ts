/**
 * Formulário de sugestões (25/09/2026) — parte PURA: validação e montagem da
 * mensagem. A rota `app/api/feedback/route.ts` só faz HTTP em volta disto.
 *
 * Decisão do Alan: e-mail + formulário, entregando na mesma caixa
 * (`hello@trackdefi.app`). A entrega é pelo Resend (API HTTPS simples, sem
 * pacote npm novo; a chave só envia e se revoga num clique).
 *
 * DEFESA CONTRA ROBÔ — é o risco real de todo formulário público, que recebe
 * lixo automatizado em poucos dias. Em camadas, sem incomodar pessoa:
 *   1. campo-isca (`website`), escondido da pessoa: robô preenche, pessoa não;
 *   2. tempo mínimo entre abrir o formulário e enviar: ninguém escreve uma
 *      sugestão em menos de 3 segundos;
 *   3. limite por IP e teto de tamanho (na rota).
 * Envio de robô recebe "ok" e é DESCARTADO em silêncio: responder erro só
 * ensinaria o robô a contornar.
 */

import { getAddress, isAddress } from "viem";

export const FEEDBACK_KINDS = ["suggestion", "missing", "bug", "other"] as const;
export type FeedbackKind = (typeof FEEDBACK_KINDS)[number];

export const KIND_LABELS: Record<FeedbackKind, string> = {
  suggestion: "Suggestion",
  missing: "Missing position",
  bug: "Something's wrong",
  other: "Other",
};

export const MIN_MESSAGE = 5;
export const MAX_MESSAGE = 4000;
/** menos que isto entre abrir e enviar = robô */
export const MIN_FILL_MS = 3000;

export interface FeedbackInput {
  kind?: unknown;
  message?: unknown;
  email?: unknown;
  wallet?: unknown;
  page?: unknown;
  /** campo-isca: TEM que chegar vazio */
  website?: unknown;
  /** Date.now() do navegador quando o formulário abriu */
  startedAt?: unknown;
}

export interface Feedback {
  kind: FeedbackKind;
  message: string;
  email: string | null;
  wallet: string | null;
  page: string | null;
}

export type FeedbackResult =
  | { ok: true; spam: false; value: Feedback }
  | { ok: true; spam: true }
  | { ok: false; error: "message_too_short" | "message_too_long" | "invalid_email" | "invalid_wallet" };

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

  const walletRaw = texto(input.wallet);
  if (walletRaw !== "" && !isAddress(walletRaw)) return { ok: false, error: "invalid_wallet" };

  const kind = FEEDBACK_KINDS.includes(input.kind as FeedbackKind) ? (input.kind as FeedbackKind) : "suggestion";
  const page = texto(input.page).slice(0, 200);

  return {
    ok: true,
    spam: false,
    value: {
      kind,
      message,
      email: emailRaw === "" ? null : emailRaw,
      wallet: walletRaw === "" ? null : getAddress(walletRaw),
      page: page === "" ? null : page,
    },
  };
}

/**
 * PURA: assunto e corpo do e-mail que chega na caixa. Texto puro (sem HTML):
 * nada que o visitante escreve vira marcação.
 */
export function buildFeedbackEmail(f: Feedback, siteUrl: string): { subject: string; text: string } {
  const resumo = f.message.replace(/\s+/g, " ").slice(0, 60);
  const subject = `[trackdefi] ${KIND_LABELS[f.kind]}: ${resumo}${f.message.length > 60 ? "…" : ""}`;
  const linhas = [
    `Type:    ${KIND_LABELS[f.kind]}`,
    `From:    ${f.email ?? "(no email — can't reply)"}`,
  ];
  if (f.wallet) linhas.push(`Wallet:  ${f.wallet}`, `         ${siteUrl}/w/${f.wallet}`);
  if (f.page) linhas.push(`Page:    ${f.page}`);
  linhas.push("", f.message);
  return { subject, text: linhas.join("\n") };
}
