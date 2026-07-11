/**
 * Garimpa carteiras com atividade LP recente na Aerodrome para a bateria da
 * Fase 5: lê eventos Transfer (mint de NFT do Slipstream) e Mint de pools v2
 * nos últimos blocos e imprime endereços candidatos.
 *
 *   npx tsx poc/find-wallets.ts
 */

import { createPublicClient, http, parseAbiItem, type Address } from "viem";
import { base } from "viem/chains";

// NFPM do Slipstream na Base (dono dos NFTs de posição concentrada).
// Passe outro NFPM como argumento p/ garimpar outros protocolos
// (ex.: Uniswap V3 na Base = 0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1).
const NFPM: Address = (process.argv[2] as Address) ?? "0x827922686190790b37229fd06084350E74485b72";

const client = createPublicClient({ chain: base, transport: http("https://mainnet.base.org", { timeout: 30_000 }) });

async function main() {
  const latest = await client.getBlockNumber();
  const span = 3000n; // ~100 min de Base (blocos de 2 s)
  console.log(`Blocos ${latest - span}..${latest} (Base)`);

  const mints = await client.getLogs({
    address: NFPM,
    event: parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 indexed tokenId)"),
    args: { from: "0x0000000000000000000000000000000000000000" },
    fromBlock: latest - span,
    toBlock: latest,
  });

  const counts = new Map<string, number>();
  for (const log of mints) {
    const to = (log.args.to as string).toLowerCase();
    counts.set(to, (counts.get(to) ?? 0) + 1);
  }

  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);
  console.log(`\n${mints.length} mints de posição concentrada; ${counts.size} carteiras únicas. Top candidatos:`);
  for (const [addr, n] of ranked) console.log(`  ${addr}  (${n} mint${n > 1 ? "s" : ""})`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
