/**
 * É VIÁVEL ligar o Uniswap v4 na BNB CHAIN?
 *
 * O bloqueio conhecido do v4 (ver comentário em core/adapters/uniswap-v4/config.ts):
 * o PositionManager NÃO é enumerável, então as posições da carteira saem de
 * uma varredura de `Transfer` do início da rede até hoje. Na Robinhood o RPC
 * público aceita a chain inteira numa chamada; na Base nenhum dos 8 RPCs
 * públicos aceitou. A BNB é o terceiro caso.
 *
 * Mede, nesta ordem:
 *   1. bloco de implantação do PositionManager (busca binária em getCode);
 *   2. maior faixa de `getLogs` que CADA RPC aceita (público e Alchemy);
 *   3. se a varredura inteira cabe no teto de `MAX_LOG_CALLS` (200);
 *   4. o adapter de verdade (`UniswapV4Adapter` + config provisória da BNB)
 *      rodando de ponta a ponta e devolvendo as posições.
 *
 *   npx tsx --env-file=.env.local poc/probe-v4-bnb-varredura.ts 0xCARTEIRA
 */

export {}; // arquivo-script

import { createPublicClient, fallback, http, type Address } from "viem";
import { bsc } from "viem/chains";
import { createReader } from "../core/chain";
import { MAX_LOG_CALLS, type UniV4ChainConfig } from "../core/adapters/uniswap-v4/config";
import { UniswapV4Adapter } from "../core/adapters/uniswap-v4/index";
import { transferEvent } from "../core/adapters/uniswap-v4/abi";

/** doc oficial: developers.uniswap.org → docs/protocols/v4/deployments → BNB Smart Chain: 56 */
const PM = "0x7a4a5c919ae2541aed11041a1aeee68f1287f95b" as Address;
const STATE_VIEW = "0xd13dd3d6e93f276fafc9db9e6bb47c1180aee0c4" as Address;
const POOL_MANAGER = "0x28e2ea090877bf75740558f6bfb36a5ffee9e9df" as Address;

/** config PROVISÓRIA do PoC — o registry só ganha a entrada quando isto aprovar */
const BSC: UniV4ChainConfig = { chainId: 56, positionManager: PM, stateView: STATE_VIEW, poolManager: POOL_MANAGER };

const PUBLICOS = ["https://bsc-dataseed.bnbchain.org", "https://bsc-rpc.publicnode.com"];
const alchemy = (process.env.BSC_RPC_URLS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter((u) => u.includes("alchemy.com"));

const cliente = (rpcs: string[]) =>
  createPublicClient({ chain: bsc, transport: fallback(rpcs.map((u) => http(u, { timeout: 60_000 }))) });

const BLOCO_VAZIO = "0x";

/** busca binária do primeiro bloco em que o PM tem código */
async function blocoImplantacao(): Promise<bigint | null> {
  const c = cliente(PUBLICOS);
  const head = await c.getBlockNumber();
  let lo = 0n, hi = head; // lo = sem código, hi = com código
  if ((await c.getCode({ address: PM, blockNumber: hi })) === BLOCO_VAZIO) return null;
  while (lo + 1n < hi) {
    const mid = (lo + hi) / 2n;
    try {
      const code = await c.getCode({ address: PM, blockNumber: mid });
      if (code && code !== BLOCO_VAZIO) hi = mid; else lo = mid;
    } catch {
      return null; // RPC sem estado histórico para getCode
    }
  }
  return hi;
}

/** maior faixa (em blocos) que o RPC aceita numa única chamada de getLogs */
async function janelaMaxima(rpcs: string[], head: bigint, conta: Address): Promise<{ ok: boolean; span: bigint; detalhe: string }> {
  const c = cliente(rpcs);
  for (const span of [head, 20_000_000n, 5_000_000n, 1_000_000n, 250_000n, 50_000n, 10_000n, 2_000n, 500n, 100n, 10n]) {
    const from = span >= head ? 0n : head - span;
    try {
      await c.getLogs({ address: PM, event: transferEvent, args: { to: conta }, fromBlock: from, toBlock: head });
      return { ok: true, span: span >= head ? head + 1n : span, detalhe: span >= head ? "chain inteira" : `${span} blocos` };
    } catch (e) {
      const msg = (e as Error).message.split("\n")[0].slice(0, 90);
      if (span === 10n) return { ok: false, span: 0n, detalhe: `nem 10 blocos: ${msg}` };
    }
  }
  return { ok: false, span: 0n, detalhe: "sem faixa aceita" };
}

async function rodaAdapter(rotulo: string, conta: Address) {
  const avisos: string[] = [];
  const adapter = new UniswapV4Adapter(createReader(56), { config: BSC, onWarn: (m) => avisos.push(m) });
  const t = Date.now();
  try {
    const pos = await adapter.getPositions(conta);
    console.log(`\n[${rotulo}] adapter → ${pos.length} posição(ões) em ${((Date.now() - t) / 1000).toFixed(1)} s`);
    for (const p of pos)
      console.log(
        `   · ${p.poolSymbol} (NFT #${p.positionId}) · ${p.amount0Raw > 0n ? p.token0.symbol : ""}${p.amount0Raw > 0n ? " " : ""}` +
          `${p.amount1Raw > 0n ? p.token1.symbol : ""} · na faixa: ${p.range?.inRange ? "sim" : "não"}`,
      );
  } catch (e) {
    console.log(`\n[${rotulo}] adapter ERROU: ${(e as Error).message.split("\n")[0].slice(0, 140)}`);
  }
  for (const a of avisos) console.log(`   aviso: ${a}`);
}

async function main() {
  const conta = (process.argv[2] ?? "") as Address;
  if (!conta) throw new Error("uso: npx tsx --env-file=.env.local poc/probe-v4-bnb-varredura.ts 0xCARTEIRA");

  const c = cliente(PUBLICOS);
  const head = await c.getBlockNumber();
  console.log(`Uniswap v4 na BNB Chain — viabilidade da varredura de histórico`);
  console.log(`Carteira: ${conta} · bloco atual: ${head}`);

  console.log("\n1. bloco de implantação do PositionManager…");
  const impl = await blocoImplantacao();
  if (impl === null) console.log("   não deu para achar (RPC sem estado histórico) — sem cálculo de viabilidade");
  else console.log(`   implantado no bloco ${impl} → histórico a varrer: ${head - impl} blocos (~${(Number(head - impl) * 450 / 86_400_000).toFixed(1)} dias)`);

  console.log("\n2. maior faixa de getLogs aceita…");
  const pub = await janelaMaxima(PUBLICOS, head, conta);
  console.log(`   público (bsc-dataseed/publicnode): ${pub.ok ? pub.detalhe : "❌ " + pub.detalhe}`);
  const alc = alchemy.length ? await janelaMaxima(alchemy, head, conta) : null;
  if (alc) console.log(`   Alchemy (BSC_RPC_URLS):            ${alc.ok ? alc.detalhe : "❌ " + alc.detalhe}`);

  if (impl !== null) {
    console.log("\n3. cabe no teto de chamadas?");
    for (const [nome, j] of [["público", pub], ["Alchemy", alc ?? null]] as const) {
      if (!j || !j.ok) { console.log(`   ${nome}: — (sem janela) → varredura viável: NÃO`); continue; }
      const precisa = Math.ceil(Number(head - impl) / Number(j.span));
      console.log(
        `   ${nome}: ${precisa} chamada(s) contra teto de ${MAX_LOG_CALLS} → ${precisa <= MAX_LOG_CALLS ? "✅ VIÁVEL" : "❌ NÃO VIÁVEL"}`,
      );
    }
  }

  console.log("\n4. adapter de ponta a ponta…");
  await rodaAdapter("com BSC_RPC_URLS (Alchemy)", conta);
  const guardado = process.env.BSC_RPC_URLS;
  delete process.env.BSC_RPC_URLS;
  await rodaAdapter("só RPC público", conta);
  if (guardado !== undefined) process.env.BSC_RPC_URLS = guardado;

  console.log("\n5. enumeração por ÍNDICE (alchemy_getAssetTransfers, sem varrer bloco a bloco)…");
  await viaIndice(alchemy[0], conta);
}

/**
 * A hipótese do `poc/probe-alchemy-indexers.ts` para o caso "v4 sem RPC que
 * aguente histórico": a API indexada devolve as transferências de ERC-721 PARA
 * a carteira direto, paginado, sem limite de faixa de blocos. Mesma semântica
 * do getLogs (candidatos → ownerOf confirma), então o resto do adapter serve.
 */
async function viaIndice(rpcUrl: string | undefined, conta: Address) {
  if (!rpcUrl) return console.log("   sem BSC_RPC_URLS com Alchemy — caminho indisponível (é o que o aviso do adapter diz hoje)");
  const key = rpcUrl.split("/").filter(Boolean).pop();
  const endpoint = rpcUrl.replace(/\/v2\/.*$/, "");
  const ids = new Set<string>();
  let pageKey: string | undefined, paginas = 0, erro = "";
  const t = Date.now();
  do {
    const r = await fetch(`${endpoint}/v2/${key}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "alchemy_getAssetTransfers",
        params: [
          {
            fromBlock: "0x0",
            toBlock: "latest",
            category: ["erc721"],
            toAddress: conta,
            contractAddresses: [PM],
            withMetadata: false,
            pageKey,
            page_size: 100,
          },
        ],
      }),
    });
    const j = (await r.json().catch(() => ({}))) as {
      result?: { transfers?: Array<{ tokenId?: string }>; pageKey?: string };
      error?: { message: string };
    };
    if (j.error) { erro = j.error.message; break; }
    for (const tr of j.result?.transfers ?? []) if (tr.tokenId) ids.add(tr.tokenId);
    pageKey = j.result?.pageKey;
    paginas++;
  } while (pageKey && paginas < 50);

  const esperado = await cliente([...PUBLICOS, ...alchemy]).readContract({
    address: PM,
    abi: [{ type: "function", name: "balanceOf", inputs: [{ type: "address", name: "" }], outputs: [{ type: "uint256", name: "" }], stateMutability: "view" }],
    functionName: "balanceOf",
    args: [conta],
  });
  console.log(
    `   ${ids.size} tokenId(s) em ${paginas} página(s), ${((Date.now() - t) / 1000).toFixed(1)} s · balanceOf on-chain = ${esperado}` +
      `${erro ? ` · erro: ${erro}` : ""}`,
  );
  console.log(`   ids: ${[...ids].join(", ")}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
