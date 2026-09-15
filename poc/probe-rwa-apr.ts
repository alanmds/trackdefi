/**
 * PoC — por que a posição USDG/HIMS (RWA, Robinhood Chain) não mostra APR?
 *
 * Testa os DOIS caminhos de APR do projeto, separadamente:
 *   1) DefiLlama (yields.llama.fi) — cobertura da Robinhood Chain
 *   2) fee APR on-chain (Receita G) — o RPC serve estado histórico? até onde?
 *
 * Uso: npx tsx poc/probe-rwa-apr.ts
 */

import { parseAbi, type Address } from "viem";
import { createReader, rpcUrls } from "../core/chain";
import { UNISWAP_V3_ROBINHOOD } from "../core/adapters/uniswap-v3/config";
import { CHAINS } from "../core/chains";

const CHAIN_ID = 4663;
const NFT_ID = 1181755n;

const nfpmAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);
const factoryAbi = parseAbi([
  "function getPool(address tokenA, address tokenB, uint24 fee) view returns (address)",
]);
const poolAbi = parseAbi([
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
  "function liquidity() view returns (uint128)",
]);
const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);

async function parte1_defillama() {
  console.log("\n===== 1) DEFILLAMA: cobertura da Robinhood Chain =====\n");
  const res = await fetch("https://yields.llama.fi/pools");
  const body = (await res.json()) as { data?: any[] };
  const rows = body.data ?? [];
  console.log(`dataset: ${rows.length} pools no total`);

  const label = CHAINS[CHAIN_ID].yieldsLabel;
  const nossos = rows.filter((r) => r.chain === label);
  console.log(`linhas com chain === "${label}": ${nossos.length}`);

  // como a rede aparece escrita, se aparecer com outro nome
  const parecidos = new Set(
    rows.map((r) => String(r.chain)).filter((c) => /robin/i.test(c)),
  );
  console.log(`nomes de rede contendo "robin" no dataset: ${[...parecidos].join(", ") || "(nenhum)"}`);

  if (nossos.length > 0) {
    const porProjeto = new Map<string, number>();
    for (const r of nossos) porProjeto.set(r.project, (porProjeto.get(r.project) ?? 0) + 1);
    console.log("projetos nessa rede:", [...porProjeto.entries()].map(([p, n]) => `${p}=${n}`).join(", "));
    for (const r of nossos.slice(0, 25)) {
      console.log(
        `  ${r.project.padEnd(22)} ${String(r.symbol).padEnd(22)} meta=${String(r.poolMeta).padEnd(14)} ` +
          `tvl=$${Math.round(r.tvlUsd).toLocaleString("pt-BR").padStart(12)} apy=${r.apy} base=${r.apyBase} ` +
          `tokens=${r.underlyingTokens ? r.underlyingTokens.length : "null"}`,
      );
    }
  }

  // o par existe em QUALQUER rede do dataset?
  const hims = rows.filter((r) => /HIMS/i.test(String(r.symbol)));
  console.log(`\nlinhas com "HIMS" no símbolo (qualquer rede): ${hims.length}`);
  for (const r of hims.slice(0, 10)) console.log(`  ${r.chain} | ${r.project} | ${r.symbol} | tvl=$${Math.round(r.tvlUsd)} | apy=${r.apy}`);
}

async function parte2_onchain() {
  console.log("\n===== 2) FEE APR ON-CHAIN: o RPC da Robinhood serve arquivo? =====\n");
  console.log("RPCs em uso:", rpcUrls(CHAIN_ID).join(" | "));
  const reader = createReader(CHAIN_ID) as any;

  const pos = (await reader.readContract({
    address: UNISWAP_V3_ROBINHOOD.nfpm,
    abi: nfpmAbi,
    functionName: "positions",
    args: [NFT_ID],
  })) as any[];
  const [, , token0, token1, fee, tickLower, tickUpper, liquidity] = pos;
  console.log(`NFT #${NFT_ID}: token0=${token0} token1=${token1} fee=${fee} L=${liquidity}`);
  console.log(`  faixa de ticks: ${tickLower} .. ${tickUpper}`);

  for (const t of [token0, token1] as Address[]) {
    const [sym, dec] = await Promise.all([
      reader.readContract({ address: t, abi: erc20Abi, functionName: "symbol" }),
      reader.readContract({ address: t, abi: erc20Abi, functionName: "decimals" }),
    ]);
    console.log(`  ${t} = ${sym} (${dec} casas)`);
  }

  const pool = (await reader.readContract({
    address: UNISWAP_V3_ROBINHOOD.factory,
    abi: factoryAbi,
    functionName: "getPool",
    args: [token0, token1, fee],
  })) as Address;
  console.log(`pool: ${pool}`);

  const bloco = (await reader.getBlockNumber()) as bigint;
  const secPerBlock = CHAINS[CHAIN_ID].secPerBlock;
  console.log(`bloco atual: ${bloco} (secPerBlock configurado = ${secPerBlock})`);

  // o secPerBlock configurado bate com a realidade?
  const [b0, b1] = await Promise.all([
    reader.getBlock({ blockNumber: bloco }),
    reader.getBlock({ blockNumber: bloco - 10_000n }),
  ]);
  const realSec = Number(b0.timestamp - b1.timestamp) / 10_000;
  console.log(`secPerBlock MEDIDO em 10.000 blocos: ${realSec.toFixed(4)} s`);

  const agora = await reader.readContract({ address: pool, abi: poolAbi, functionName: "feeGrowthGlobal0X128" });
  console.log(`feeGrowthGlobal0X128 (latest): ${agora}`);

  // até onde o RPC devolve estado histórico?
  for (const horas of [0.1, 1, 6, 24]) {
    const blocos = BigInt(Math.round((horas * 3600) / secPerBlock));
    const alvo = bloco - blocos;
    try {
      const v = await reader.readContract({
        address: pool,
        abi: poolAbi,
        functionName: "feeGrowthGlobal0X128",
        blockNumber: alvo,
      });
      console.log(`  janela ${String(horas).padStart(4)}h (bloco ${alvo}, -${blocos}): OK   delta0=${(agora as bigint) - (v as bigint)}`);
    } catch (e) {
      console.log(`  janela ${String(horas).padStart(4)}h (bloco ${alvo}, -${blocos}): FALHA ${(e as Error).message.split("\n")[0].slice(0, 90)}`);
    }
  }
}

async function main() {
  await parte1_defillama();
  await parte2_onchain();
}

main().catch((e) => {
  console.error("ERRO:", e);
  process.exit(1);
});
