/**
 * PoC Solana — acha carteiras de TESTE com posição na Orca, a partir de dado
 * público da blockchain (transações recentes de um pool). Nenhuma carteira de
 * usuário do site: o endereço sai daqui, não de print ou conversa.
 *
 * Uso: node find-lp.mjs <endereço-do-pool>
 * RPC: variável SOLANA_RPC (padrão: o público da Solana, com limite apertado).
 */
import { address, createSolanaRpc } from "@solana/kit";
import { fetchWhirlpool } from "@orca-so/whirlpools-client";
import { fetchPositionsForOwner } from "@orca-so/whirlpools";

const RPC = process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
const rpc = createSolanaRpc(RPC);
const pool = address(process.argv[2]);
const dorme = (ms) => new Promise((r) => setTimeout(r, ms));

const wp = await fetchWhirlpool(rpc, pool);
console.log(`pool ${pool}: mintA=${wp.data.tokenMintA} mintB=${wp.data.tokenMintB} tickSpacing=${wp.data.tickSpacing}`);

const sigs = await rpc.getSignaturesForAddress(pool, { limit: 60 }).send();
const LIQ = /Instruction: (IncreaseLiquidity|DecreaseLiquidity|CollectFees|OpenPosition)/;
const vistos = new Set();
const achados = [];
for (const s of sigs) {
  if (s.err || achados.length >= 3) continue;
  const tx = await rpc
    .getTransaction(s.signature, { maxSupportedTransactionVersion: 0, encoding: "json" })
    .send()
    .catch(() => null);
  await dorme(250); // o RPC público derruba rajadas
  const logs = tx?.meta?.logMessages ?? [];
  if (!logs.some((l) => LIQ.test(l))) continue;
  const pagador = tx.transaction.message.accountKeys[0];
  if (vistos.has(pagador)) continue;
  vistos.add(pagador);
  const pos = await fetchPositionsForOwner(rpc, address(pagador)).catch((e) => (console.log("  erro:", e.message), []));
  await dorme(250);
  console.log(`  ${pagador.slice(0, 6)}…${pagador.slice(-4)}: ${pos.length} posição(ões)`);
  if (pos.length > 0) achados.push(pagador);
}
console.log(achados.length ? `\nCARTEIRAS DE TESTE:\n${achados.join("\n")}` : "\nnenhuma carteira com posição nas transações lidas");
