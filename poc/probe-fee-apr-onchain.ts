/**
 * PoC — fee APR do pool SEM DefiLlama, medido no próprio contrato.
 *
 * Pergunta: dá para trocar o `apyBase` da DefiLlama — que exige um casamento
 * ambíguo (9 candidatos medidos para WETH/USDC na Base, sem endereço de pool
 * no dataset grátis) — por leitura direta do pool? E o número bate?
 *
 * COMO FUNCIONA
 * `feeGrowthGlobal{0,1}X128` são acumuladores Q128: taxas por unidade de
 * liquidez, desde o nascimento do pool. Entre dois blocos:
 *
 *     taxas_do_pool = Δ feeGrowthGlobal × liquidez_ativa ÷ 2^128
 *     apyBase       = taxas_anualizadas ÷ TVL × 100
 *
 * TVL também sai on-chain (saldo dos dois tokens no pool). Nada de casar por
 * nome, nada de terceiro.
 *
 * LIMITES HONESTOS (leia antes de acreditar no número)
 * 1. Usa a liquidez ativa ATUAL para a janela inteira. Se ela mudou muito no
 *    período, o número desvia — é a maior fonte de erro do método.
 * 2. O denominador pode não ser o mesmo da DefiLlama: aqui o TVL é o saldo
 *    TOTAL do pool (inclui liquidez fora da faixa, que não ganha taxa). Se
 *    eles usam um denominador menor, o apyBase deles sai maior por
 *    construção — não por erro. Ver conclusão do PoC de 02/08/2026.
 * 3. Preço ainda vem da DefiLlama — este PoC troca o APR, não o preço.
 *
 *   npx tsx --env-file=.env.local poc/probe-fee-apr-onchain.ts --h=24 [0xPOOL ...]
 *
 * O --env-file é obrigatório para usar RPC com arquivo: o tsx não lê
 * .env.local sozinho, e sem ele a varredura cai nos RPCs públicos (só o
 * mainnet.base.org serve histórico, e recusa rajadas).
 */

export {}; // arquivo-script

import { createPublicClient, erc20Abi, http, parseAbi, type Address } from "viem";
import { createReader, rpcUrls } from "../core/chain";
import { chainInfo } from "../core/chains";
import { fetchUsdPrices } from "../core/prices/defillama";
import { getYieldsIndex } from "../core/yields/defillama";

const CHAIN = 8453; // Base
const Q128 = 2n ** 128n;
const YEAR_SEC = 365 * 24 * 3600;
const SEC_PER_BLOCK = 2; // Base
/** janela em horas — `--h=24`. RPC público trava em ~1 h; com arquivo, 24 h+. */
const HOURS = Number(process.argv.find((a) => a.startsWith("--h="))?.slice(4) ?? 24);
const LOOKBACK = BigInt(Math.round((HOURS * 3600) / SEC_PER_BLOCK));

/** pools grandes e conhecidos da Base — onde a DefiLlama deveria estar no seu melhor */
const DEFAULT_POOLS: Address[] = [
  "0xd0b53D9277642d899DF5C87A3966A349A798F224",
  "0x4C36388bE6F416A29C8d8Eee81C771cE6bE14B18",
  "0x6c561B446416E1A00E8E93E221854d6eA4171372",
  "0x9c087Eb773291e50CF6c6a90ef0F4500e349B903",
];

const poolAbi = parseAbi([
  "function feeGrowthGlobal0X128() view returns (uint256)",
  "function feeGrowthGlobal1X128() view returns (uint256)",
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function fee() view returns (uint24)",
]);

const pct = (n: number | null) => (n === null ? "      —" : `${n.toFixed(2).padStart(6)}%`);

/** nunca imprimir a chave: URL de RPC pago carrega credencial no caminho */
const mask = (u: string) => u.replace(/\/v2\/[^/?]+/, "/v2/***").replace(/([?&]api[-_]?key=)[^&]+/i, "$1***");

async function main() {
  const pools = (process.argv.slice(2) as Address[]).filter((a) => a.startsWith("0x"));
  const alvos = pools.length > 0 ? pools : DEFAULT_POOLS;

  const reader = createReader(CHAIN);
  const client = reader as unknown as {
    getBlockNumber: () => Promise<bigint>;
    readContract: (a: unknown) => Promise<unknown>;
  };

  const latest = await client.getBlockNumber();
  const past = latest - LOOKBACK;
  const janelaSec = Number(LOOKBACK) * SEC_PER_BLOCK;
  console.log("Fee APR: on-chain vs DefiLlama — Base");
  console.log(`Janela: blocos ${past} → ${latest} (~${(janelaSec / 3600).toFixed(1)} h)\n`);

  const yields = await getYieldsIndex((m) => console.log(`   (aviso yields: ${m})`));

  /* Quais RPCs servem ESTADO HISTÓRICO? Decide se roda de graça ou exige
     chave. Testa um a um, sem fallback. */
  console.log("Estado histórico por RPC:");
  let archiveRpc: string | null = null;
  for (const url of rpcUrls(CHAIN)) {
    const solo = createPublicClient({ chain: chainInfo(CHAIN).chain, transport: http(url, { timeout: 20_000 }) });
    try {
      await solo.readContract({ address: alvos[0], abi: poolAbi, functionName: "feeGrowthGlobal0X128", blockNumber: past });
      console.log(`   OK   ${mask(url)}`);
      archiveRpc ??= url;
    } catch (e) {
      console.log(`   nao  ${mask(url)} — ${(e as Error).message.split("\n")[0].slice(0, 45)}`);
    }
  }
  console.log();
  if (!archiveRpc) {
    console.log("Nenhum RPC da lista serve estado histórico. Rode com --env-file=.env.local\n");
  }
  const hist = archiveRpc
    ? createPublicClient({ chain: chainInfo(CHAIN).chain, transport: http(archiveRpc, { timeout: 30_000 }) })
    : null;

  for (const pool of alvos) {
    const read = <T>(fn: string, bn?: bigint) =>
      (bn && hist
        ? hist.readContract({ address: pool, abi: poolAbi, functionName: fn, blockNumber: bn } as never)
        : client.readContract({ address: pool, abi: poolAbi, functionName: fn })) as Promise<T>;

    let token0: Address, token1: Address, fee: number, L: bigint;
    try {
      [token0, token1, fee, L] = await Promise.all([
        read<Address>("token0"),
        read<Address>("token1"),
        read<number>("fee"),
        read<bigint>("liquidity"),
      ]);
    } catch (e) {
      console.log(`${pool} — não parece um pool CL (${(e as Error).message.split("\n")[0].slice(0, 50)})\n`);
      continue;
    }

    const [sym0, dec0, sym1, dec1] = await Promise.all([
      client.readContract({ address: token0, abi: erc20Abi, functionName: "symbol" }) as Promise<string>,
      client.readContract({ address: token0, abi: erc20Abi, functionName: "decimals" }) as Promise<number>,
      client.readContract({ address: token1, abi: erc20Abi, functionName: "symbol" }) as Promise<string>,
      client.readContract({ address: token1, abi: erc20Abi, functionName: "decimals" }) as Promise<number>,
    ]);
    const nome = `${sym0}/${sym1} ${(fee / 10_000).toFixed(2)}%`;

    // TVL on-chain: saldo dos dois tokens no contrato do pool
    const [bal0, bal1] = await Promise.all([
      client.readContract({ address: token0, abi: erc20Abi, functionName: "balanceOf", args: [pool] }) as Promise<bigint>,
      client.readContract({ address: token1, abi: erc20Abi, functionName: "balanceOf", args: [pool] }) as Promise<bigint>,
    ]);
    const prices = await fetchUsdPrices(chainInfo(CHAIN).priceSlug, [token0, token1]);
    const p0 = prices.get(token0.toLowerCase()) ?? null;
    const p1 = prices.get(token1.toLowerCase()) ?? null;
    const amt = (raw: bigint, d: number) => Number(raw) / 10 ** d;
    const tvl = p0 !== null && p1 !== null ? amt(bal0, dec0) * p0 + amt(bal1, dec1) * p1 : null;

    let onchain: number | null = null;
    let motivo = "";
    /* SEQUENCIAL com repetição: RPC público que serve arquivo recusa rajada. */
    const readRetry = async <T>(fn: string, bn?: bigint): Promise<T> => {
      let ultimo: unknown;
      for (let tent = 0; tent < 4; tent++) {
        try {
          return await read<T>(fn, bn);
        } catch (e) {
          ultimo = e;
          await new Promise((r) => setTimeout(r, 800 * (tent + 1)));
        }
      }
      throw ultimo;
    };
    try {
      const g0n = await readRetry<bigint>("feeGrowthGlobal0X128");
      const g1n = await readRetry<bigint>("feeGrowthGlobal1X128");
      const g0o = await readRetry<bigint>("feeGrowthGlobal0X128", past);
      const g1o = await readRetry<bigint>("feeGrowthGlobal1X128", past);
      if (tvl === null || tvl <= 0) {
        motivo = "sem preço dos dois tokens";
      } else {
        const fees0 = ((g0n - g0o) * L) / Q128;
        const fees1 = ((g1n - g1o) * L) / Q128;
        const feesUsd = amt(fees0, dec0) * (p0 as number) + amt(fees1, dec1) * (p1 as number);
        onchain = ((feesUsd / janelaSec) * YEAR_SEC * 100) / tvl;
      }
    } catch (e) {
      motivo = `RPC recusou histórico (${(e as Error).message.split("\n")[0].slice(0, 40)})`;
    }

    const dl = yields?.match({
      chainId: CHAIN,
      protocol: "uniswap-v3",
      kind: "concentrated",
      poolSymbol: nome,
      token0,
      token1,
    });

    console.log(`== ${nome}  ${pool}`);
    console.log(`   TVL on-chain:  US$ ${(tvl ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`);
    console.log(`   TVL DefiLlama: US$ ${dl ? dl.tvlUsd.toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "—"}`);
    console.log(`   apyBase DefiLlama: ${pct(dl?.base ?? null)}`);
    console.log(`   apyBase on-chain:  ${pct(onchain)}${motivo ? `  (${motivo})` : ""}`);
    if (dl?.base && onchain !== null && dl.base > 0) {
      console.log(`   -> on-chain / DefiLlama = ${(onchain / dl.base).toFixed(2)}x`);
    }
    console.log();
  }

  console.log("Perto de 1x, concordam. Viés SISTEMÁTICO (todos abaixo) sugere");
  console.log("denominador diferente, não erro — ver limite 2 no topo do arquivo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
