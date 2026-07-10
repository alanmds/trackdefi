/**
 * trackdefi — Fase 1: prova de conceito
 *
 * Lê TODAS as posições de liquidez de uma carteira na Aerodrome (rede Base)
 * usando o contrato LP Sugar (API on-chain oficial do protocolo), via RPC
 * público. Sem chaves, sem login — somente leitura.
 *
 * Uso:
 *   npm run poc -- 0xENDERECO            # imprime as posições
 *   npm run poc -- 0xENDERECO --json     # também salva poc/fixture-<addr>.json
 *
 * Fonte dos endereços/structs: github.com/velodrome-finance/sugar
 * (deployments/base.env + contracts/LpSugar.vy, conferidos em 10/07/2026).
 */

import { writeFileSync } from "node:fs";
import {
  createPublicClient,
  fallback,
  http,
  isAddress,
  getAddress,
  formatUnits,
  parseAbi,
  erc20Abi,
  type Address,
} from "viem";
import { base } from "viem/chains";

// ---------------------------------------------------------------- endereços

const LP_SUGAR: Address = "0x69dD9db6d8f8E7d83887A704f447b1a584b599A1";

// Token de emissões da Aerodrome (AERO) — usado quando o byAddress do Sugar
// não responde e caímos na leitura direta do pool.
const AERO: Address = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";

// V2 factory + 3 CL factories (deployments/base.env). Servem só para saber o
// total de pools e dimensionar a varredura paginada do Sugar.
const FACTORIES: Address[] = [
  "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
  "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
  "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a",
  "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef",
];

const RPCS = [
  "https://mainnet.base.org",
  "https://base-rpc.publicnode.com",
  "https://base.llamarpc.com",
];

// ---------------------------------------------------------------------- ABI
// Structs copiados campo a campo do LpSugar.vy — a ordem é o contrato.

const sugarAbi = parseAbi([
  "struct Position { uint256 id; address lp; uint256 liquidity; uint256 staked; uint256 amount0; uint256 amount1; uint256 staked0; uint256 staked1; uint256 unstaked_earned0; uint256 unstaked_earned1; uint256 emissions_earned; int24 tick_lower; int24 tick_upper; uint160 sqrt_ratio_lower; uint160 sqrt_ratio_upper; address locker; uint32 unlocks_at; address alm; }",
  "struct Lp { address lp; string symbol; uint8 decimals; uint256 liquidity; int24 poolType; int24 tick; uint160 sqrt_ratio; address token0; uint256 reserve0; uint256 staked0; address token1; uint256 reserve1; uint256 staked1; address gauge; uint256 gauge_liquidity; bool gauge_alive; address fee; address bribe; address factory; uint256 emissions; address emissions_token; uint256 emissions_cap; uint256 pool_fee; uint256 unstaked_fee; uint256 token0_fees; uint256 token1_fees; uint256 locked; uint256 emerging; uint32 created_at; address nfpm; address alm; address root; }",
  "function positions(uint256 _limit, uint256 _offset, address _account) view returns (Position[] memory)",
  "function positionsUnstakedConcentrated(uint256 _limit, uint256 _offset, address _account) view returns (Position[] memory)",
  "function byAddress(address _address) view returns (Lp memory)",
]);

const factoryAbi = parseAbi([
  "function allPoolsLength() view returns (uint256)",
]);

type SugarPosition = {
  id: bigint;
  lp: Address;
  liquidity: bigint;
  staked: bigint;
  amount0: bigint;
  amount1: bigint;
  staked0: bigint;
  staked1: bigint;
  unstaked_earned0: bigint;
  unstaked_earned1: bigint;
  emissions_earned: bigint;
  tick_lower: number;
  tick_upper: number;
  sqrt_ratio_lower: bigint;
  sqrt_ratio_upper: bigint;
  locker: Address;
  unlocks_at: number;
  alm: Address;
};

const client = createPublicClient({
  chain: base,
  transport: fallback(RPCS.map((url) => http(url, { timeout: 30_000 }))),
});

// ------------------------------------------------------------------ helpers

const ZERO: Address = "0x0000000000000000000000000000000000000000";

function fmt(raw: bigint, decimals: number, digits = 6): string {
  const n = Number(formatUnits(raw, decimals));
  return n.toLocaleString("pt-BR", { maximumFractionDigits: digits });
}

function usd(n: number | undefined): string {
  if (n === undefined) return "—";
  return "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Varre o Sugar em janelas de pools; reduz a janela se o RPC reclamar. */
async function sweep(
  fn: "positions" | "positionsUnstakedConcentrated",
  account: Address,
  totalPools: bigint,
): Promise<SugarPosition[]> {
  const found: SugarPosition[] = [];
  const CHUNK = 200n;
  for (let offset = 0n; offset < totalPools; offset += CHUNK) {
    const limit = offset + CHUNK > totalPools ? totalPools - offset : CHUNK;
    try {
      const batch = await client.readContract({
        address: LP_SUGAR,
        abi: sugarAbi,
        functionName: fn,
        args: [limit, offset, account],
      });
      found.push(...(batch as SugarPosition[]));
    } catch {
      // janela pesada demais para o RPC público — tenta em fatias de 50
      for (let o = offset; o < offset + limit; o += 50n) {
        const l = o + 50n > offset + limit ? offset + limit - o : 50n;
        try {
          const batch = await client.readContract({
            address: LP_SUGAR,
            abi: sugarAbi,
            functionName: fn,
            args: [l, o, account],
          });
          found.push(...(batch as SugarPosition[]));
        } catch (e) {
          console.warn(`  aviso: ${fn} falhou em offset ${o} (janela 50) — ${(e as Error).message.split("\n")[0]}`);
        }
      }
    }
  }
  return found;
}

async function fetchPricesUSD(tokens: Address[]): Promise<Map<Address, number>> {
  const prices = new Map<Address, number>();
  if (tokens.length === 0) return prices;
  try {
    const keys = tokens.map((t) => `base:${t}`).join(",");
    const res = await fetch(`https://coins.llama.fi/prices/current/${keys}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = (await res.json()) as { coins: Record<string, { price: number }> };
    for (const t of tokens) {
      const hit = body.coins[`base:${t}`] ?? body.coins[`base:${t.toLowerCase()}`];
      if (hit && Number.isFinite(hit.price)) prices.set(t, hit.price);
    }
  } catch (e) {
    console.warn(`  aviso: preços indisponíveis (${(e as Error).message}) — valores em US$ sairão como "—"`);
  }
  return prices;
}

// --------------------------------------------------------------------- main

async function main() {
  const args = process.argv.slice(2).filter((a) => a !== "--json");
  const wantJson = process.argv.includes("--json");
  const input = args[0] ?? "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac"; // carteira de teste do repo Sugar
  if (!isAddress(input)) {
    console.error(`Endereço inválido: ${input}`);
    process.exit(1);
  }
  const account = getAddress(input);

  console.log(`\ntrackdefi PoC — Aerodrome @ Base`);
  console.log(`Carteira: ${account}\n`);

  // 1. total de pools (dimensiona a varredura)
  const counts = await client.multicall({
    contracts: FACTORIES.map((f) => ({ address: f, abi: factoryAbi, functionName: "allPoolsLength" as const })),
    allowFailure: true,
  });
  let totalPools = 0n;
  counts.forEach((c, i) => {
    if (c.status === "success") totalPools += c.result as bigint;
    else console.warn(`  aviso: factory ${FACTORIES[i]} não respondeu allPoolsLength`);
  });
  totalPools += 200n; // folga para pools criados entre a contagem e a varredura
  console.log(`Pools na Aerodrome (4 factories): ~${(totalPools - 200n).toLocaleString("pt-BR")}`);

  // 2. posições (staked + clássicas) e CL não-staked — deduplicadas
  console.log(`Varrendo posições (isso leva ~10–60 s no RPC público)...`);
  const t0 = Date.now();
  const [a, b] = await Promise.all([
    sweep("positions", account, totalPools),
    sweep("positionsUnstakedConcentrated", account, totalPools),
  ]);
  const byKey = new Map<string, SugarPosition>();
  for (const p of [...a, ...b]) byKey.set(`${p.lp}-${p.id}`, p);
  const positions = [...byKey.values()].filter(
    (p) => p.liquidity > 0n || p.staked > 0n || p.unstaked_earned0 > 0n || p.unstaked_earned1 > 0n || p.emissions_earned > 0n,
  );
  console.log(`Varredura concluída em ${((Date.now() - t0) / 1000).toFixed(1)} s — ${positions.length} posição(ões).\n`);

  if (positions.length === 0) {
    console.log("Nenhuma posição de liquidez encontrada na Aerodrome para esta carteira.");
    return;
  }

  // 3. metadados dos pools e dos tokens
  const poolAddrs = [...new Set(positions.map((p) => p.lp))];
  const pools = new Map<Address, Awaited<ReturnType<typeof readPool>>>();
  for (const lp of poolAddrs) pools.set(lp, await readPool(lp));

  const tokenAddrs = new Set<Address>();
  for (const info of pools.values()) {
    tokenAddrs.add(info.token0);
    tokenAddrs.add(info.token1);
    if (info.emissionsToken !== ZERO) tokenAddrs.add(info.emissionsToken);
  }
  const tokens = await readTokens([...tokenAddrs]);
  const prices = await fetchPricesUSD([...tokenAddrs]);

  // 4. relatório
  let totalUsd = 0;
  let totalRewardsUsd = 0;
  let missingPrices = 0;

  positions.forEach((p, i) => {
    const pool = pools.get(p.lp)!;
    const t0i = tokens.get(pool.token0)!;
    const t1i = tokens.get(pool.token1)!;
    const isCL = pool.poolType > 0;
    const amt0 = p.amount0 + p.staked0;
    const amt1 = p.amount1 + p.staked1;
    const p0 = prices.get(pool.token0);
    const p1 = prices.get(pool.token1);
    const v0 = p0 !== undefined ? Number(formatUnits(amt0, t0i.decimals)) * p0 : undefined;
    const v1 = p1 !== undefined ? Number(formatUnits(amt1, t1i.decimals)) * p1 : undefined;
    const value = v0 !== undefined && v1 !== undefined ? v0 + v1 : undefined;
    if (value !== undefined) totalUsd += value;
    else missingPrices++;

    console.log(`── Posição ${i + 1}: ${pool.symbol || `${t0i.symbol}/${t1i.symbol}`} ${isCL ? `(concentrada, id NFT #${p.id})` : "(clássica)"}`);
    console.log(`   Tipo: ${pool.poolType > 0 ? `concentrada — tick spacing ${pool.poolType}` : pool.poolType === 0 ? "clássica volátil" : "clássica estável"}${p.staked > 0n ? " · EM STAKE no gauge" : ""}${p.alm !== ZERO ? " · via ALM (gestor automático)" : ""}`);
    console.log(`   ${t0i.symbol}: ${fmt(amt0, t0i.decimals)}   ${t1i.symbol}: ${fmt(amt1, t1i.decimals)}   Valor: ${usd(value)}`);

    if (isCL) {
      const dec = t0i.decimals - t1i.decimals;
      const lo = Math.pow(1.0001, p.tick_lower) * Math.pow(10, dec);
      const hi = Math.pow(1.0001, p.tick_upper) * Math.pow(10, dec);
      const inRange = pool.tick >= p.tick_lower && pool.tick < p.tick_upper;
      console.log(`   Faixa: ${lo.toLocaleString("pt-BR", { maximumSignificantDigits: 6 })} – ${hi.toLocaleString("pt-BR", { maximumSignificantDigits: 6 })} ${t1i.symbol}/${t0i.symbol} → ${inRange ? "✅ NA FAIXA" : "⚠️ FORA DA FAIXA"}`);
    }

    const rew: string[] = [];
    let rewUsd = 0;
    let rewComplete = true;
    if (p.unstaked_earned0 > 0n) {
      rew.push(`${fmt(p.unstaked_earned0, t0i.decimals)} ${t0i.symbol}`);
      if (p0 !== undefined) rewUsd += Number(formatUnits(p.unstaked_earned0, t0i.decimals)) * p0; else rewComplete = false;
    }
    if (p.unstaked_earned1 > 0n) {
      rew.push(`${fmt(p.unstaked_earned1, t1i.decimals)} ${t1i.symbol}`);
      if (p1 !== undefined) rewUsd += Number(formatUnits(p.unstaked_earned1, t1i.decimals)) * p1; else rewComplete = false;
    }
    if (p.emissions_earned > 0n && pool.emissionsToken !== ZERO) {
      const ti = tokens.get(pool.emissionsToken)!;
      const pe = prices.get(pool.emissionsToken);
      rew.push(`${fmt(p.emissions_earned, ti.decimals)} ${ti.symbol} (emissões)`);
      if (pe !== undefined) rewUsd += Number(formatUnits(p.emissions_earned, ti.decimals)) * pe; else rewComplete = false;
    }
    if (rew.length > 0) {
      console.log(`   A receber: ${rew.join(" + ")} ≈ ${rewComplete ? usd(rewUsd) : "—"}`);
      if (rewComplete) totalRewardsUsd += rewUsd;
    }
    console.log("");
  });

  console.log(`══════════════════════════════════════════════`);
  console.log(`TOTAL em pools:   ${usd(totalUsd)}${missingPrices ? `  (+ ${missingPrices} posição(ões) sem preço)` : ""}`);
  console.log(`TOTAL a receber:  ${usd(totalRewardsUsd)}`);
  console.log(`Conferir em: https://aerodrome.finance/dash?account=${account}\n`);

  if (wantJson) {
    const file = `poc/fixture-${account.slice(0, 10)}.json`;
    writeFileSync(
      file,
      JSON.stringify({ account, capturedAt: new Date().toISOString(), positions }, (_, v) => (typeof v === "bigint" ? v.toString() : v), 2),
    );
    console.log(`Fixture salvo em ${file} (para os testes da Fase 2).`);
  }
}

async function readPool(lp: Address) {
  try {
    const r = await client.readContract({ address: LP_SUGAR, abi: sugarAbi, functionName: "byAddress", args: [lp] });
    return {
      symbol: r.symbol,
      poolType: r.poolType,
      tick: r.tick,
      token0: r.token0,
      token1: r.token1,
      emissionsToken: r.emissions_token,
    };
  } catch {
    // fallback: lê o mínimo direto do pool (caso o struct Lp mude de versão)
    const minAbi = parseAbi([
      "function token0() view returns (address)",
      "function token1() view returns (address)",
      "function tickSpacing() view returns (int24)",
      "function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 a, uint16 b, uint16 c, bool d)",
    ]);
    const [token0, token1] = await Promise.all([
      client.readContract({ address: lp, abi: minAbi, functionName: "token0" }),
      client.readContract({ address: lp, abi: minAbi, functionName: "token1" }),
    ]);
    let poolType = 0;
    let tick = 0;
    try {
      poolType = await client.readContract({ address: lp, abi: minAbi, functionName: "tickSpacing" });
      tick = (await client.readContract({ address: lp, abi: minAbi, functionName: "slot0" }))[1];
    } catch {
      /* pool clássico: sem ticks */
    }
    console.warn(`  aviso: byAddress falhou para ${lp} — usando leitura direta do pool`);
    return { symbol: "", poolType, tick, token0, token1, emissionsToken: AERO };
  }
}

async function readTokens(addrs: Address[]) {
  const out = new Map<Address, { symbol: string; decimals: number }>();
  const res = await client.multicall({
    contracts: addrs.flatMap((a) => [
      { address: a, abi: erc20Abi, functionName: "symbol" as const },
      { address: a, abi: erc20Abi, functionName: "decimals" as const },
    ]),
    allowFailure: true,
  });
  addrs.forEach((a, i) => {
    const sym = res[i * 2];
    const dec = res[i * 2 + 1];
    out.set(a, {
      symbol: sym.status === "success" ? (sym.result as string) : a.slice(0, 8),
      decimals: dec.status === "success" ? Number(dec.result) : 18,
    });
  });
  return out;
}

main().catch((e) => {
  console.error(`\nErro: ${(e as Error).message}`);
  process.exit(1);
});
