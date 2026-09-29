import total from "./custos-total.json";

/**
 * Totais de custo e tempo do projeto, mostrados na faixa do topo de toda página.
 *
 * Os números vêm de `app/custos-total.json`, gerado por `npm run horas` a partir
 * da tabela privada (privado/custos.json). Não editar o JSON à mão: rodar o
 * script e commitar o arquivo. Valores já saem em dólares.
 */
export const COST_TOTALS: { horas: number; totalUsd: number; atualizadoEm: string } = total;

/** "US$ 445" no formato do site, e horas inteiras ("30 hours") */
export function costLine(t: { horas: number; totalUsd: number } = COST_TOTALS): string {
  const hours = Math.round(t.horas);
  return `So far this site has taken about ${hours} ${hours === 1 ? "hour" : "hours"} of work and US$ ${t.totalUsd.toLocaleString("en-US")} to build and run.`;
}
