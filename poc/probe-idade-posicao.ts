/**
 * PoC da Sessão B — como descobrir QUANDO a posição foi aberta (ou tocada pela
 * última vez), que é o que falta para dois pedidos do Alan:
 *
 *   1. posição com menos de 15 min: "medindo desde a abertura (8 min)" em vez
 *      de um card mudo;
 *   2. posição de 3 meses: "rendeu US$ X em taxas em 94 dias = Y% a.a.".
 *
 * As taxas desde o último toque já sabemos exatas e de graça (contraprova de
 * 15/09 bateu com o "a receber"). Falta só o TEMPO. Este PoC mede os dois
 * caminhos candidatos e compara custo:
 *
 *   A) getLogs filtrando pelo tokenId (resposta exata, 1 chamada por evento)
 *   B) busca binária no feeGrowthInside0LastX128 (não depende de getLogs,
 *      mas gasta ~log2(faixa) leituras de ARQUIVO)
 *
 * Uso: npx tsx poc/probe-idade-posicao.ts [chainId] [tokenId]
 */

import { parseAbi, parseAbiItem, type Address } from "viem";
import { createReader, rpcUrls } from "../core/chain";
import { CHAINS } from "../core/chains";
import { UNISWAP_V3_CHAINS } from "../core/adapters/uniswap-v3/config";

const nfpmAbi = parseAbi([
  "function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)",
]);

const EVENTOS = {
  Transfer: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
  IncreaseLiquidity: parseAbiItem("event IncreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"),
  DecreaseLiquidity: parseAbiItem("event DecreaseLiquidity(uint256 indexed tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)"),
  Collect: parseAbiItem("event Collect(uint256 indexed tokenId, address recipient, uint256 amount0, uint256 amount1)"),
} as const;

const fmtDur = (s: number) =>
  s < 3600 ? `${(s / 60).toFixed(1)} min` : s < 86400 ? `${(s / 3600).toFixed(1)} h` : `${(s / 86400).toFixed(1)} dias`;

async function main() {
  const chainId = Number(process.argv[2] ?? 4663);
  const tokenId = BigInt(process.argv[3] ?? "1181755");
  const info = CHAINS[chainId];
  const cfg = UNISWAP_V3_CHAINS.find((c) => c.chainId === chainId);
  if (!cfg) throw new Error(`sem Uniswap v3 configurado na rede ${chainId}`);
  const r = createReader(chainId) as any;

  console.log(`rede ${info.label} (${chainId}) · NFT #${tokenId} · NFPM ${cfg.nfpm}`);
  console.log(`RPCs: ${rpcUrls(chainId)[0]}…\n`);

  const pos = (await r.readContract({ address: cfg.nfpm, abi: nfpmAbi, functionName: "positions", args: [tokenId] })) as any[];
  const L = pos[7] as bigint;
  const blocoAtual = (await r.getBlockNumber()) as bigint;
  const agora = await r.getBlock({ blockNumber: blocoAtual });
  console.log(`L=${L}  bloco atual ${blocoAtual}  feeGrowthInside0Last=${pos[8]}`);
  console.log(`tokensOwed: ${pos[10]} / ${pos[11]}\n`);

  // ---------------------------------------------------------- caminho A
  console.log("=== A) getLogs filtrando por tokenId ===");
  const achados: Array<{ nome: string; bloco: bigint }> = [];
  for (const [nome, evento] of Object.entries(EVENTOS)) {
    const t0 = Date.now();
    try {
      const logs = (await r.getLogs({
        address: cfg.nfpm,
        event: evento,
        args: { tokenId },
        fromBlock: 0n,
        toBlock: blocoAtual,
      })) as Array<{ blockNumber: bigint }>;
      const ms = Date.now() - t0;
      const blocos = logs.map((l) => l.blockNumber);
      console.log(`  ${nome.padEnd(18)} ${String(logs.length).padStart(2)} evento(s) em ${String(ms).padStart(6)} ms  ${blocos.length ? `blocos ${blocos.join(", ")}` : ""}`);
      for (const b of blocos) achados.push({ nome, bloco: b });
    } catch (e) {
      console.log(`  ${nome.padEnd(18)} FALHOU em ${Date.now() - t0} ms: ${(e as Error).message.split("\n")[0].slice(0, 70)}`);
    }
  }

  if (achados.length > 0) {
    const mint = achados.filter((a) => a.nome === "Transfer").map((a) => a.bloco).sort((x, y) => (x < y ? -1 : 1))[0];
    const ultimoToque = achados.map((a) => a.bloco).sort((x, y) => (x < y ? 1 : -1))[0];
    const bMint = await r.getBlock({ blockNumber: mint });
    const bToque = await r.getBlock({ blockNumber: ultimoToque });
    const idade = Number(agora.timestamp - bMint.timestamp);
    const desdeToque = Number(agora.timestamp - bToque.timestamp);
    console.log(`\n  ABERTA no bloco ${mint} — há ${fmtDur(idade)}`);
    console.log(`  ÚLTIMO TOQUE no bloco ${ultimoToque} — há ${fmtDur(desdeToque)}`);
    console.log(`  (se os dois batem, a posição nunca foi coletada → taxas desde o toque = taxas da VIDA TODA)`);
  }

  // ---------------------------------------------------------- caminho B
  console.log("\n=== B) busca binária no feeGrowthInside0LastX128 ===");
  const alvo = pos[8] as bigint;
  let leituras = 0;
  const valorEm = async (b: bigint): Promise<bigint | null> => {
    leituras++;
    try {
      const p = (await r.readContract({ address: cfg.nfpm, abi: nfpmAbi, functionName: "positions", args: [tokenId], blockNumber: b })) as any[];
      return p[8] as bigint;
    } catch {
      return null; // NFT ainda não existia (ou RPC sem arquivo)
    }
  };

  const t0 = Date.now();
  // 1) achar um bloco ANTES do último toque, dobrando o passo
  let passo = BigInt(Math.round(900 / info.secPerBlock)); // começa em 15 min
  let baixo: bigint | null = null;
  let alto = blocoAtual;
  for (let i = 0; i < 20 && passo < blocoAtual; i++) {
    const cand = blocoAtual - passo;
    const v = await valorEm(cand);
    if (v === null || v !== alvo) { baixo = cand; break; }
    alto = cand;
    passo *= 4n;
  }
  if (baixo === null) {
    console.log(`  não achei o toque em ${leituras} leituras (posição muito antiga ou RPC sem arquivo profundo)`);
  } else {
    // 2) binária entre baixo (antes) e alto (depois)
    while (alto - baixo > 1n) {
      const meio = (alto + baixo) / 2n;
      const v = await valorEm(meio);
      if (v === null || v !== alvo) baixo = meio;
      else alto = meio;
    }
    const b = await r.getBlock({ blockNumber: alto });
    console.log(`  toque no bloco ${alto} — há ${fmtDur(Number(agora.timestamp - b.timestamp))}`);
    console.log(`  custo: ${leituras} leituras de arquivo em ${Date.now() - t0} ms`);
  }
}

main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
