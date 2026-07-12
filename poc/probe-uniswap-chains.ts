/**
 * PoC da Receita B multi-rede (rodar ANTES de publicar): para cada rede
 * Uniswap nova:
 *  1. coerência de endereços: NFPM.factory() DEVE apontar para a factory
 *     da config (prova que os dois endereços são do mesmo deployment);
 *  2. garimpa uma carteira ativa nos mints recentes do NFPM;
 *  3. varre essa carteira com o adapter parametrizado.
 *
 *   npx tsx poc/probe-uniswap-chains.ts
 */

import { createPublicClient, fallback, http, parseAbi, parseAbiItem, type Address } from "viem";
import { createReader, rpcUrls } from "../core/chain";
import { chainInfo } from "../core/chains";
import { UniswapV3Adapter } from "../core/adapters/uniswap-v3/index";
import { UNISWAP_V3_ARBITRUM, UNISWAP_V3_ETHEREUM, UNISWAP_V3_OPTIMISM, type UniV3ChainConfig } from "../core/adapters/uniswap-v3/config";

const nfpmFactoryAbi = parseAbi(["function factory() view returns (address)"]);

const MINT_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)");

async function probe(config: UniV3ChainConfig): Promise<boolean> {
  const info = chainInfo(config.chainId);
  console.log(`\n━━ Uniswap v3 · ${info.label} (chainId ${config.chainId})`);
  const reader = createReader(config.chainId);

  // 1. coerência de endereços
  const factoryFromNfpm = (await reader.readContract({
    address: config.nfpm,
    abi: nfpmFactoryAbi,
    functionName: "factory",
  })) as Address;
  const coherent = factoryFromNfpm.toLowerCase() === config.factory.toLowerCase();
  console.log(`   NFPM.factory() = ${factoryFromNfpm} → ${coherent ? "✅ coerente com a config" : "❌ DIVERGE da config!"}`);
  if (!coherent) return false;

  // 2. carteira ativa nos mints recentes (cliente próprio p/ getLogs)
  const client = createPublicClient({
    chain: info.chain,
    transport: fallback(rpcUrls(config.chainId).map((u) => http(u, { timeout: 30_000 }))),
  });
  const latest = await client.getBlockNumber();
  // RPCs públicos do mainnet limitam a faixa do getLogs — tenta faixas decrescentes
  let mints: Awaited<ReturnType<typeof client.getLogs<typeof MINT_EVENT>>> = [];
  let span = 0n;
  for (const s of [1500n, 300n, 50n]) {
    try {
      mints = await client.getLogs({
        address: config.nfpm,
        event: MINT_EVENT,
        args: { from: "0x0000000000000000000000000000000000000000" },
        fromBlock: latest - s,
        toBlock: latest,
      });
      span = s;
      break;
    } catch {
      console.log(`   (getLogs de ${s} blocos recusado pelo RPC — tentando faixa menor)`);
    }
  }
  console.log(`   ${mints.length} mint(s) de posição nos últimos ${span} blocos`);
  if (mints.length === 0) {
    console.log("   (sem mints recentes — pulando varredura de carteira; coerência já validada)");
    return true;
  }
  const wallet = mints[mints.length - 1].args.to as Address;

  // 3. varredura real
  const warnings: string[] = [];
  const adapter = new UniswapV3Adapter(reader, { config, onWarn: (m) => warnings.push(m) });
  const t0 = Date.now();
  const positions = await adapter.getPositions(wallet);
  console.log(
    `   carteira ${wallet.slice(0, 10)}…: ${positions.length} posição(ões) em ${((Date.now() - t0) / 1000).toFixed(1)} s · avisos: ${warnings.length}`,
  );
  for (const p of positions.slice(0, 3)) {
    console.log(
    `   • ${p.poolSymbol} [${p.protocol}@${p.chainId}]${p.range ? (p.range.inRange ? " NA FAIXA" : " FORA DA FAIXA") : ""} · rewards: ${p.rewards.length}`,
    );
  }
  for (const w of warnings.slice(0, 3)) console.log(`   ⚠ ${w}`);
  return true;
}

async function main() {
  let ok = true;
  for (const config of [UNISWAP_V3_ETHEREUM, UNISWAP_V3_ARBITRUM, UNISWAP_V3_OPTIMISM]) {
    try {
      ok = (await probe(config)) && ok;
    } catch (e) {
      ok = false;
      console.log(`   ❌ exceção: ${(e as Error).message.split("\n")[0]}`);
    }
  }
  console.log(`\n${ok ? "✅ PoC multi-rede Uniswap OK" : "❌ PoC com falhas — NÃO publicar"}`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
