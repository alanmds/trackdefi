/**
 * Apoio voluntário — a linha de doação do rodapé, em todas as páginas.
 *
 * Por que doação e não banner: o plano grátis da Vercel proíbe anúncio, mas
 * permite pedir doação (fair use guidelines, conferido em 15/09/2026). O
 * mapa dos banners, para quando houver tráfego, está em privado/.
 *
 * ⚠️ O ENDEREÇO só muda de propósito, com o Alan confirmando. Um endereço de
 * doação trocado em silêncio — erro de digitação, dependência comprometida —
 * manda o dinheiro de quem apoia para outra pessoa. tests/donate.test.ts fixa
 * o valor exato e o checksum; mexer aqui sem mexer lá quebra o teste.
 * Conferido em 25/09/2026: checksum válido, carteira sem contrato e sem
 * transação em Base, Ethereum, Optimism e Arbitrum.
 */
export const DONATION_ADDRESS = "0x0a7629b2B98270D824e7aa23e8F5B0BBD88d8228";

/**
 * Banco de frases que rotacionam acima do endereço.
 *
 * REGRAS (travadas em tests/donate.test.ts):
 * 1. Inglês, uma ideia por frase, até 90 caracteres — no celular cabe em duas
 *    linhas, e é esse o espaço que o rodapé reserva.
 * 2. Sempre voluntário. Nada de urgência, culpa ou promessa: nenhuma palavra
 *    de golpe cripto ("airdrop", "reward", "double", "verify"…). Pedido de
 *    doação em cripto já nasce parecido com golpe; o texto precisa desmentir.
 * 3. Nenhum nome de rede escrito à mão, nem "N networks" — a cobertura muda e
 *    a frase envelheceria calada (regra do site inteiro).
 *
 * Frase nova entra no FIM da lista: quem já tem a rotação salva no navegador
 * continua com a fila válida e vê a nova no ciclo seguinte.
 */
export const DONATION_PHRASES: readonly string[] = [
  "Free and read-only, always. If it saved you time today, a tip keeps it running.",
  "Built by one person and funded by its users. Tips are optional — and appreciated.",
  "Every scan reads several blockchains at once. Tips help pay for the nodes behind it.",
  "No login, no paywall. If this page was useful, consider buying the dev a coffee.",
  "Found a position you'd forgotten? Consider tipping the tool that found it.",
  "Your tips fund the next networks and exchanges on the roadmap.",
  "Tracking LPs shouldn't cost you anything. Keeping the lights on does — tips help.",
  "If trackdefi lives in your bookmarks, a small tip helps keep it online.",
  "Fees claimed? A tiny slice as a tip goes a long way here.",
  "Independent and free. Tips are how it stays that way.",
  "Honest numbers take work. A tip is a way of saying thanks for it.",
  "Out of range? We'll tell you. Tips help us keep telling you.",
  "One address, every position — and one address for tips, if you'd like.",
  "Tips cover servers and blockchain nodes, so the tracker stays fast and free.",
  "Saved you a trip through five block explorers? A tip is always welcome.",
  "Enjoying trackdefi? A voluntary tip helps it grow.",
  "Want a network added sooner? Tips turn roadmap items into shipped features.",
  "Small tips, big help: every one goes into keeping trackdefi running.",
  "Like watching your fees add up? Help the tracker grow too — tips welcome.",
  "Free for everyone, supported by a few. Want to be one of the few?",
  "Checked your LPs in seconds? That's the whole idea. A tip helps keep it free.",
  "Useful today? Tips — even small ones — keep trackdefi independent.",
  "Every tip goes into servers, nodes and new features. Thank you!",
  "Emissions are pending; gratitude can be claimed anytime. Tips welcome.",
  "Your range is bounded; our thanks for a tip is not.",
  "A coffee's worth of ETH keeps this tracker brewing.",
  "If this saved you a spreadsheet, consider a tip.",
  "Staked positions, found. Pending fees, counted. Tips, gratefully received.",
  "No account needed to use it — and none needed to support it, either.",
  "Behind every refresh there's a server bill. Tips help pay it.",
];

/**
 * Estado da rotação, guardado no navegador de quem visita (localStorage).
 * É só uma fila de números de frase — não identifica ninguém e nunca sai do
 * navegador, então não contraria o "we don't build a profile of you".
 */
export interface PhraseBag {
  /** frases que ainda faltam neste ciclo, na ordem em que vão aparecer */
  queue: number[];
  /** a última mostrada — o ciclo seguinte nunca começa por ela */
  last: number | null;
}

function isIndex(n: unknown, count: number): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n < count;
}

/**
 * Aceita o que vier do navegador (nada, texto corrompido, versão antiga com
 * mais frases) e devolve só um estado válido para o banco atual.
 */
export function parseBag(raw: unknown, count: number): PhraseBag {
  if (!raw || typeof raw !== "object") return { queue: [], last: null };
  const r = raw as { queue?: unknown; last?: unknown };
  const queue = Array.isArray(r.queue) ? [...new Set(r.queue.filter((n): n is number => isIndex(n, count)))] : [];
  return { queue, last: isIndex(r.last, count) ? r.last : null };
}

function shuffled(count: number, random: () => number): number[] {
  const a = Array.from({ length: count }, (_, i) => i);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * A próxima frase, no esquema de "saco embaralhado": num ciclo, todas as
 * frases aparecem uma vez, em ordem aleatória, antes de qualquer uma repetir
 * — é o que garante frase nova a quem volta sempre. Sorteio puro repetiria
 * cedo (com 30 frases, a chance de repetir em 7 visitas já passa de 50%).
 */
export function nextPhrase(
  raw: unknown,
  count: number,
  random: () => number = Math.random,
): { index: number; bag: PhraseBag } {
  if (count < 1) throw new Error("the phrase bank is empty");
  const bag = parseBag(raw, count);
  let queue = bag.queue;
  if (queue.length === 0) {
    queue = shuffled(count, random);
    const end = queue.length - 1;
    if (end > 0 && queue[0] === bag.last) [queue[0], queue[end]] = [queue[end], queue[0]];
  }
  const [index, ...rest] = queue;
  return { index, bag: { queue: rest, last: index } };
}
