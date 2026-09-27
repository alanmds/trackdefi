/**
 * PoC Solana — plano B para achar carteira de TESTE: lista as posições de um
 * pool (getProgramAccounts com filtro) e descobre o dono de algumas pelo NFT
 * da posição. Dado público; nenhuma carteira de usuário do site.
 */
import { address, createSolanaRpc } from "@solana/kit";
import { fetchPositionsInWhirlpool, fetchPositionsForOwner } from "@orca-so/whirlpools";

const RPC = process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
const rpc = createSolanaRpc(RPC);
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

const t0 = Date.now();
const todas = await fetchPositionsInWhirlpool(rpc, address(process.argv[2]));
console.log(`${todas.length} posições no pool (${((Date.now() - t0) / 1000).toFixed(1)} s)`);

// as de maior liquidez primeiro: mais chance de ser uma carteira "de verdade"
console.log('exemplo:', todas[0].address, 'mint', todas[0].data.positionMint);
const maiores = todas.filter((p) => p.data.liquidity > 0n).sort((a, b) => (b.data.liquidity > a.data.liquidity ? 1 : -1)).slice(0, 12);
const achados = [];
for (const p of maiores) {
  if (achados.length >= 3) break;
  // o RPC público recusa getTokenLargestAccounts (429): o dono sai de quem
  // assinou a transação mais antiga do NFT da posição (a de abertura)
  const sigs = await rpc.getSignaturesForAddress(p.data.positionMint, { limit: 20 }).send().catch((e) => (console.log("  sigs:", e.message.slice(0, 80)), null));
  await dorme(1200);
  const primeira = sigs?.at(-1);
  if (!primeira) continue;
  const tx = await rpc.getTransaction(primeira.signature, { maxSupportedTransactionVersion: 0, encoding: "json" }).send().catch((e) => (console.log("  tx:", e.message.slice(0, 80)), null));
  await dorme(1200);
  const dono = tx?.transaction?.message?.accountKeys?.[0];
  if (!dono) continue;
  // dono pode ser um programa (cofre/ALM), não uma carteira: só conta se a
  // busca por dono achar a posição
  const pos = await fetchPositionsForOwner(rpc, address(dono)).catch(() => []);
  await dorme(1200);
  console.log(`  ${dono.slice(0, 12)}…${dono.slice(-4)}: ${pos.length} posição(ões) pela busca por dono`);
  if (pos.length > 0 && !achados.includes(dono)) achados.push(dono);
}
console.log(achados.length ? `\nCARTEIRAS DE TESTE:\n${achados.join("\n")}` : "\nnenhuma");
