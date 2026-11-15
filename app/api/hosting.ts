/**
 * Onde o servidor está rodando — sem amarrar o código a um host.
 *
 * Até 11/2026 as rotas perguntavam "estou na Vercel?" (`VERCEL`) para saber se
 * eram o site no ar. Fora da Vercel (Hostinger) essa pergunta responde "não" e
 * o servidor de verdade se comportaria como o computador do dono: aceitaria
 * dados congelados (fixture), diria "ok" a um feedback que não foi enviado e
 * mostraria o motivo dos erros ao visitante. `TRACKDEFI_PRODUCTION=1`, setada
 * no painel do host, diz o mesmo que a Vercel diz sozinha.
 */

const flagged = (): boolean => process.env.TRACKDEFI_PRODUCTION?.trim() === "1";

/** Servidor publicado (produção ou prévia) — nunca o computador do dono. */
export function isHostedServer(): boolean {
  return Boolean(process.env.VERCEL) || flagged();
}

/** O site público: erros saem sem detalhe interno. */
export function isPublicProduction(): boolean {
  return process.env.VERCEL_ENV === "production" || flagged();
}
