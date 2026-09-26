/**
 * PoC da Sessão B, parte 2 — achar a idade da posição SEM estourar o orçamento.
 *
 * O PoC anterior mostrou o problema: busca binária ingênua = ~20 IDAS E VOLTAS
 * sequenciais por posição (23 s no RPC público da Robinhood). Numa carteira com
 * 10 posições isso não cabe nos 50 s da API.
 *
 * A ideia testada aqui: o custo não é o número de LEITURAS, é o número de
 * IDAS E VOLTAS. Então:
 *
 *   Fase 1 — sondagem em LOTE: todas as posições da rede são lidas no MESMO
 *   bloco passado, por multicall. Uma ida e volta por degrau de tempo
 *   (15 min, 1 h, 4 h, 1 d, 4 d, 16 d, 64 d, 256 d) coloca CADA posição na sua
 *   faixa, qualquer que seja a idade dela.
 *
 *   Fase 2 — refino: bisseção dentro da faixa, parando quando a precisão
 *   relativa chega em 5%. Para um APR anualizado, 5% de erro no tempo é ruído
 *   irrelevante — não precisamos do bloco exato, precisamos da duração.
 *
 * Uso: npx tsx poc/probe-idade-lote.ts [chainId] [tokenId,tokenId,...]
 */

import { parseAbi } from "viem";
import { createReader } from "../core/chain";
import { CHAINS } from "../core/chains";
import { UNISWAP_V3_CHAINS } from "../core/adapters/uniswap-v3/config";

// NFT por argumento, sem padrão: um NFT fixo num repo público liga o
// projeto à carteira dona dele (limpeza de 26/09/2026)
function die(msg: string): never {
  throw new Error(msg);
}

const nfpmAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

/** degraus da sondagem em lote, em horas — cobrem de 15 min a ~8 meses */
const DEGRAUS_H = [0.25, 1, 4, 24, 96, 384, 1536, 6144];
const PRECISAO = 0.05; // 5% na duração é ruído para um APR anualizado

const fmtDur = (s: number) =>
  s < 3600 ? `${(s / 60).toFixed(1)} min` : s < 86400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} dias`;

async function main() {
  const chainId = Number(process.argv[2] ?? 4663);
  const ids = (process.argv[3] ?? die("uso: npx tsx poc/probe-idade-lote.ts <chainId> <nft-id[,nft-id…]>")).split(",").map((s) => BigInt(s.trim()));
  const info = CHAINS[chainId];
  const cfg = UNISWAP_V3_CHAINS.find((c) => c.chainId === chainId)!;
  const r = createReader(chainId) as any;

  let idasEVoltas = 0;
  const t0 = Date.now();

  const blocoAtual = (await r.getBlockNumber()) as bigint;
  const agora = await r.getBlock({ blockNumber: blocoAtual });
  idasEVoltas += 2;

  const leEmLote = async (bloco: bigint | null, alvos: bigint[]) => {
    idasEVoltas++;
    const res = (await r.multicall({
      contracts: alvos.map((id) => ({ address: cfg.nfpm, abi: nfpmAbi, functionName: "positions", args: [id] })),
      allowFailure: true,
      ...(bloco === null ? {} : { blockNumber: bloco }),
    })) as Array<{ status: string; result?: any }>;
    // null = não existia naquele bloco (ou falhou a leitura)
    return res.map((x) => (x.status === "success" ? ((x.result as any[])[8] as bigint) : null));
  };

  const atual = await leEmLote(null, ids);
  console.log(`rede ${info.label} · ${ids.length} posição(ões) · bloco ${blocoAtual}\n`);

  // -------------------------------------------------- Fase 1: sondagem em lote
  // para cada posição: [maisRecenteQueMudou, maisAntigoIgual]
  const faixa = ids.map(() => ({ antes: null as bigint | null, depois: blocoAtual }));
  let pendentes = ids.map((_, i) => i);

  for (const h of DEGRAUS_H) {
    if (pendentes.length === 0) break;
    const blocos = BigInt(Math.round((h * 3600) / info.secPerBlock));
    if (blocoAtual <= blocos) break;
    const alvo = blocoAtual - blocos;
    const vals = await leEmLote(alvo, pendentes.map((i) => ids[i]));
    const aindaPendentes: number[] = [];
    pendentes.forEach((idx, k) => {
      if (vals[k] === null || vals[k] !== atual[idx]) faixa[idx].antes = alvo; // mudou: toque está DEPOIS daqui
      else {
        faixa[idx].depois = alvo; // igual: toque está antes ou igual a este bloco
        aindaPendentes.push(idx);
      }
    });
    pendentes = aindaPendentes;
  }
  console.log(`Fase 1 (lote): ${idasEVoltas} idas e voltas, ${pendentes.length} posição(ões) mais antigas que o maior degrau`);

  // -------------------------------------------------- Fase 2: refino por posição
  for (let i = 0; i < ids.length; i++) {
    const f = faixa[i];
    if (f.antes === null) {
      console.log(`  NFT #${ids[i]}: mais antiga que ${DEGRAUS_H[DEGRAUS_H.length - 1] / 24} dias — mostrar ">8 meses"`);
      continue;
    }
    let antes = f.antes;
    let depois = f.depois;
    while (true) {
      const idadeMax = Number(blocoAtual - antes) * info.secPerBlock;
      const idadeMin = Number(blocoAtual - depois) * info.secPerBlock;
      if (idadeMax <= 0 || (idadeMax - idadeMin) / idadeMax <= PRECISAO) break;
      const meio = (antes + depois) / 2n;
      const v = (await leEmLote(meio, [ids[i]]))[0];
      if (v === null || v !== atual[i]) antes = meio;
      else depois = meio;
    }
    const b = await r.getBlock({ blockNumber: depois });
    idasEVoltas++;
    const idade = Number(agora.timestamp - b.timestamp);
    console.log(`  NFT #${ids[i]}: aberta/tocada há ${fmtDur(idade)} (bloco ~${depois}, ±${(PRECISAO * 100).toFixed(0)}%)`);
  }

  console.log(`\nTOTAL: ${idasEVoltas} idas e voltas em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  console.log(`(a busca binária ingênua do PoC anterior gastou ~20 idas e voltas para UMA posição)`);
}

main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
