/**
 * Tirar os aparelhos do Alan da contagem do Vercel Analytics.
 *
 * A Vercel não tem filtro de dono (nem por IP, nem no painel): a única
 * alavanca é o `beforeSend`, que roda no navegador antes de cada envio e pode
 * descartar o evento. A marca fica no localStorage daquele navegador.
 *
 * Como ligar: abrir `trackdefi.app/?notrack=1` UMA vez em cada navegador de
 * cada aparelho (Chrome e Safari do mesmo celular são dois). Para desligar:
 * `?notrack=0`. Link em vez de comando no console porque celular não tem
 * console. Aba anônima não guarda a marca; limpar os dados do navegador apaga.
 *
 * O parâmetro fica visível no repositório público — quem o achar só deixa de
 * ser contado, o que não traz risco a ninguém.
 */

/** chave no localStorage (a mesma que a doc da Vercel usa como exemplo) */
export const OPT_OUT_KEY = "va-disable";

/** parâmetro da URL que liga (1) ou desliga (0) a marca */
export const OPT_OUT_PARAM = "notrack";

const BASE = "https://trackdefi.app";

function paramOf(url: string): string | null {
  try {
    return new URL(url, BASE).searchParams.get(OPT_OUT_PARAM);
  } catch {
    return null;
  }
}

export interface OptOutDecision {
  /** o evento vai para a Vercel? */
  send: boolean;
  /** o que fazer com a marca deste navegador */
  store: "set" | "clear" | null;
}

/**
 * Decide o destino de um evento a partir da URL da visita e da marca já
 * guardada. A visita que traz `?notrack=1` já não conta — por isso a decisão
 * lê a URL do próprio evento, e não depende de a marca ter sido gravada antes.
 */
export function optOutDecision(url: string, stored: string | null): OptOutDecision {
  const flag = paramOf(url);
  if (flag === "1") return { send: false, store: "set" };
  if (flag === "0") return { send: true, store: "clear" };
  return { send: stored === null, store: null };
}

/** a URL sem o `notrack`, para ele não aparecer no painel como página própria */
export function withoutOptOutParam(url: string): string {
  let u: URL;
  try {
    u = new URL(url, BASE);
  } catch {
    return url;
  }
  if (!u.searchParams.has(OPT_OUT_PARAM)) return url;
  u.searchParams.delete(OPT_OUT_PARAM);
  return u.toString();
}
