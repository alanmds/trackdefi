/**
 * Orçamento diário da Alchemy (plano grátis: 30 M CUs por mês).
 *
 * Em 17/11/2026 a conta estava em 26,8 M / 30 M no dia 17 e o site no ar parou de
 * ler as redes. Este contador faz o site ENCOLHER antes de morrer: passado o
 * orçamento do dia, a Alchemy sai da fila de leitura comum (o tráfego vai para os
 * outros RPCs) e as chamadas que SÓ ela atende (índices do v4 e do v2) avisam em
 * vez de gastar o que resta do mês.
 *
 * O site roda em UM processo Node na Hostinger, então o contador em memória vale
 * para o site todo; reiniciar o processo zera a conta do dia (erra para menos —
 * aceitável, o painel da Alchemy é a verdade). Os valores de CU são os da tabela
 * pública da Alchemy, arredondados — servem para ESTIMAR, não para cobrar.
 */

const CU: Record<string, number> = {
  eth_call: 26,
  eth_getLogs: 60,
  eth_blockNumber: 10,
  eth_getBlockByNumber: 16,
  eth_getCode: 19,
  eth_getStorageAt: 17,
  eth_getBalance: 19,
  alchemy_getTokenBalances: 26,
  alchemy_getAssetTransfers: 120,
};

/** 800 mil/dia ≈ 24 M/mês: deixa ~20% da cota para picos, testes e o que o contador não vê */
export const DEFAULT_DAILY_CU = 800_000;

function dailyLimit(): number {
  const v = Number(process.env.ALCHEMY_DAILY_CU);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_DAILY_CU;
}

let day = "";
let spent = 0;

function rollover(now: number): void {
  const d = new Date(now).toISOString().slice(0, 10);
  if (d !== day) {
    day = d;
    spent = 0;
  }
}

/** registra o gasto estimado de uma chamada à Alchemy */
export function chargeAlchemy(method: string, now: number = Date.now()): void {
  rollover(now);
  spent += CU[method] ?? 20;
}

/** ainda há orçamento hoje? */
export function alchemyBudgetLeft(now: number = Date.now()): boolean {
  rollover(now);
  return spent < dailyLimit();
}

/** para diagnóstico e testes */
export function alchemySpentToday(now: number = Date.now()): number {
  rollover(now);
  return spent;
}

/** só para testes */
export function resetAlchemyBudget(): void {
  day = "";
  spent = 0;
}
