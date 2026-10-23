/**
 * PoC — gauges da Aerodrome/Velodrome no lançamento do Aero (22/10/2026).
 *
 * A doc oficial (aero.xyz/aero-upgrade) diz que os gauges antigos são
 * desligados no lançamento e as emissões acabam. O site calcula a emissão da
 * posição com `gauge.rewardRate()` — e esse número NÃO zera sozinho: ele só
 * muda no próximo `notifyRewardAmount`. Depois de `periodFinish` o gauge não
 * paga mais nada, mas o `rewardRate` continua lá, com o ritmo da semana velha.
 *
 * Premissa a provar: todo gauge CL das redes Sugar expõe `periodFinish()`, e
 * hoje ele aponta para a virada de época (quinta 00:00 UTC). Se sim, comparar
 * `periodFinish` com a hora do bloco basta para o site mostrar 0 quando o
 * gauge parar — sem data fixa no código.
 *
 *   npx tsx poc/probe-aero-gauges.ts
 */

export {}; // arquivo-script

import { parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { AERODROME_BASE, VELODROME_OPTIMISM, VELODROME_LEAF_CHAINS } from "../core/adapters/aerodrome/config";
import { CHAINS } from "../core/chains";

const poolAbi = parseAbi(["function gauge() view returns (address)"]);
const gaugeAbi = parseAbi([
  "function rewardRate() view returns (uint256)",
  "function periodFinish() view returns (uint256)",
]);
const ZERO = "0x0000000000000000000000000000000000000000";

for (const cfg of [AERODROME_BASE, VELODROME_OPTIMISM, ...VELODROME_LEAF_CHAINS]) {
  const label = `${cfg.protocol} · ${CHAINS[cfg.chainId]?.label ?? cfg.chainId}`;
  try {
    const reader = createReader(cfg.chainId);
    const positions = await new AerodromeAdapter(reader, { config: cfg }).getPositions(cfg.testWallet);
    const pools = [...new Set(positions.filter((p) => p.kind === "concentrated").map((p) => p.poolAddress))].slice(0, 3);
    if (pools.length === 0) {
      console.log(`${label}: carteira de teste sem posição CL — nada a sondar`);
      continue;
    }
    const block = await (reader as unknown as { getBlock(): Promise<{ timestamp: bigint }> }).getBlock();
    for (const pool of pools) {
      const gauge = (await reader.readContract({ address: pool, abi: poolAbi, functionName: "gauge" })) as Address;
      if (gauge === ZERO) {
        console.log(`${label}: pool ${pool} sem gauge`);
        continue;
      }
      const [rate, finish] = await reader.multicall({
        contracts: [
          { address: gauge, abi: gaugeAbi, functionName: "rewardRate" },
          { address: gauge, abi: gaugeAbi, functionName: "periodFinish" },
        ],
        allowFailure: true,
      });
      const f = finish.status === "success" ? (finish.result as bigint) : null;
      console.log(
        `${label}: gauge ${gauge} rewardRate=${rate.status === "success" ? rate.result : "FALHOU"} ` +
          `periodFinish=${f === null ? "FALHOU" : new Date(Number(f) * 1000).toISOString()} ` +
          `bloco=${new Date(Number(block.timestamp) * 1000).toISOString()} ` +
          `pagando=${f === null ? "?" : f > block.timestamp}`,
      );
    }
  } catch (e) {
    console.log(`${label}: ERRO ${(e as Error).message.split("\n")[0]}`);
  }
}
