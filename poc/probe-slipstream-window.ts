/**
 * CONTRAPROVA do caminho Slipstream (Aerodrome/Velodrome) na Receita G v2:
 * o layout do `ticks()` do fork está certo e a janela on-chain realmente
 * volta com número — em vez de cair calado no fallback da DefiLlama.
 *
 * Uso: npx tsx poc/probe-slipstream-window.ts [chainId] [0xCARTEIRA]
 */

import type { Address } from "viem";
import { createReader } from "../core/chain";
import { CHAINS } from "../core/chains";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { VELODROME_OPTIMISM } from "../core/adapters/aerodrome/config";
import { feeGrowthInside, readPositionFeeWindows, type FeeWindowTarget } from "../core/yields/onchain";

async function main() {
  const chainId = Number(process.argv[2] ?? 10);
  const carteira = (process.argv[3] ?? "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac") as Address;
  const info = CHAINS[chainId];
  const reader = createReader(chainId);
  const adapter = chainId === 10 ? new AerodromeAdapter(reader, { config: VELODROME_OPTIMISM }) : new AerodromeAdapter(reader);

  const posicoes = await adapter.getPositions(carteira);
  const alvos = posicoes.filter((p) => p.kind === "concentrated" && p.range?.inRange);
  console.log(`${info.label}: ${posicoes.length} posições, ${alvos.length} concentradas E na faixa`);
  if (alvos.length === 0) return;

  const targets: FeeWindowTarget[] = alvos.map((p, i) => ({
    key: String(i),
    protocol: p.protocol,
    pool: p.poolAddress,
    tickLower: p.range!.tickLower,
    tickUpper: p.range!.tickUpper,
    inside0Last: p.earningInputs?.feeGrowthInside0LastX128 ?? null,
  }));

  const bloco = (await (reader as any).getBlockNumber()) as bigint;
  const janelas = await readPositionFeeWindows(reader, targets, bloco, info.secPerBlock, (m) => console.log("  aviso:", m));

  alvos.forEach((p, i) => {
    const w = janelas.get(String(i));
    console.log(
      `  ${p.poolSymbol.padEnd(26)} ${w ? `janela ${w.windowSec / 3600} h · delta0=${w.delta0} delta1=${w.delta1}` : "SEM JANELA (caiu no fallback)"}`,
    );
  });
  console.log(`\n  ${janelas.size}/${targets.length} posições medidas NO CONTRATO`);
}
main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
