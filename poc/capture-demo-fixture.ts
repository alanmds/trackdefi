/**
 * Congela a carteira DEMO (0x892Ff98a…, de terceiro — a mesma do
 * validate-live e do botão "Try a demo wallet") como fixture dos testes:
 * posições cruas do Sugar + metadados dos pools + tokens, na Base (Aerodrome)
 * e na Optimism (Velodrome).
 *
 * Existe desde 26/09/2026, quando os testes deixaram de usar a carteira do
 * dono do projeto — o repo é público, e aquilo ligava o nome dos commits a
 * uma carteira. **Fixture de teste só com carteira de terceiro.**
 *
 * Uso: npx tsx poc/capture-demo-fixture.ts   (grava poc/fixture-demo.json)
 */

import { writeFileSync } from "node:fs";
import type { Address } from "viem";
import { createReader } from "../core/chain";
import { AerodromeAdapter } from "../core/adapters/aerodrome/index";
import { AERODROME_BASE, VELODROME_OPTIMISM } from "../core/adapters/aerodrome/config";

const DEMO: Address = "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac";

async function congelar(config: typeof AERODROME_BASE) {
  const adapter = new AerodromeAdapter(createReader(config.chainId), { config });
  const positions = await adapter.fetchRawPositions(DEMO);
  // loadPools/loadTokens são privados: acesso direto só aqui, no script de captura
  const priv = adapter as unknown as {
    loadPools(lps: Address[]): Promise<Map<Address, unknown>>;
    loadTokens(addrs: Address[]): Promise<Map<Address, unknown>>;
  };
  const pools = await priv.loadPools([...new Set(positions.map((p) => p.lp))]);
  const addrs = new Set<Address>([config.emissionsToken]);
  for (const m of pools.values()) {
    const meta = m as { token0: Address; token1: Address };
    addrs.add(meta.token0);
    addrs.add(meta.token1);
  }
  const tokens = await priv.loadTokens([...addrs]);
  return {
    chainId: config.chainId,
    protocol: config.protocol,
    emissionsToken: config.emissionsToken,
    positions,
    pools: Object.fromEntries(pools),
    tokens: Object.fromEntries(tokens),
  };
}

const [base, optimism] = await Promise.all([congelar(AERODROME_BASE), congelar(VELODROME_OPTIMISM)]);
writeFileSync(
  "poc/fixture-demo.json",
  JSON.stringify(
    { account: DEMO, capturedAt: new Date().toISOString(), base, optimism },
    (_, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  ),
);
console.log(`base: ${base.positions.length} posições · optimism: ${optimism.positions.length} posições → poc/fixture-demo.json`);
