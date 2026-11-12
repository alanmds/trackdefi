/**
 * Onde vai a CPU de uma varredura? (12/11/2026 — o plano grátis da Vercel
 * cobra "Fluid Active CPU", e a rota /api/positions consome quase tudo.)
 *
 * Mede o tempo de CPU (não o de relógio) de:
 *   1. cada adapter, um por vez (em série, para a CPU ser atribuível);
 *   2. a varredura completa, a frio e de novo a quente (caches por instância).
 *
 * Uso: npx tsx --env-file=.env.local poc/probe-cpu.ts [0xENDERECO]
 */

import { buildAdapters } from "../core/adapters/registry";
import { chainInfo } from "../core/chains";
import { getWalletPositions } from "../core/service";

const address = process.argv[2] ?? "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";

function cpuMs(since: NodeJS.CpuUsage): number {
  const d = process.cpuUsage(since);
  return (d.user + d.system) / 1000;
}

async function main() {
  const kind = address.startsWith("0x") ? "evm" : "solana";
  const adapters = buildAdapters().filter((a) => (a.addressKind ?? "evm") === kind);

  const rows: { nome: string; cpu: number; relogio: number; n: number | string }[] = [];
  for (const a of adapters) {
    const c0 = process.cpuUsage();
    const t0 = Date.now();
    let n: number | string;
    try {
      n = (await a.getPositions(address)).length;
      if (a.getLocks) await a.getLocks(address);
    } catch (e) {
      n = "erro: " + (e as Error).message.slice(0, 40);
    }
    rows.push({ nome: `${a.protocol}@${chainInfo(a.chainId).label}`, cpu: cpuMs(c0), relogio: Date.now() - t0, n });
  }
  rows.sort((x, y) => y.cpu - x.cpu);
  const total = rows.reduce((s, r) => s + r.cpu, 0);
  console.log(`\nPor adapter (em série, a frio) — carteira ${address.slice(0, 8)}…`);
  for (const r of rows.slice(0, 25)) {
    console.log(
      `${r.cpu.toFixed(0).padStart(6)} ms CPU  ${String(r.relogio).padStart(6)} ms relógio  ${((r.cpu / total) * 100).toFixed(0).padStart(3)}%  ${r.nome}  (${r.n})`,
    );
  }
  console.log(`${total.toFixed(0).padStart(6)} ms CPU  — soma dos ${rows.length} adapters`);

  for (const rotulo of ["2ª passada (caches quentes)", "3ª passada"]) {
    const c0 = process.cpuUsage();
    const t0 = Date.now();
    const dto = await getWalletPositions(address);
    console.log(
      `\nVarredura completa, ${rotulo}: ${cpuMs(c0).toFixed(0)} ms CPU, ${Date.now() - t0} ms relógio, ${dto.totalPositions} posições`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
