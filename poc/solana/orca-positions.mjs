/**
 * PoC Solana — posições na Orca (Whirlpools) de uma carteira.
 *
 * Pergunta que este PoC responde: dá para mostrar uma posição da Orca com o
 * MESMO conteúdo de um card do site (par, valor, faixa, em range, taxas e
 * recompensas a receber) usando só dado público + o SDK oficial?
 *
 * Programa oficial (github.com/orca-so/whirlpools, conferido em 26/09/2026):
 *   whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc — o SDK já usa este por padrão.
 *
 * Uso:  node orca-positions.mjs <endereço-solana>
 * RPC:  variável SOLANA_RPC (padrão: o público, que limita bastante — ver
 *       NOTAS.md nesta pasta).
 *
 * Isolado de propósito: tem package.json próprio, não mexe nas dependências
 * do site.
 */
import { address, createSolanaRpc } from "@solana/kit";
import { fetchPositionsForOwner } from "@orca-so/whirlpools";
import { fetchAllWhirlpool, fetchAllTickArray, getTickArrayAddress } from "@orca-so/whirlpools-client";
import {
  collectFeesQuote,
  collectRewardsQuote,
  decreaseLiquidityQuote,
  getTickArrayStartTickIndex,
  getTickIndexInArray,
  sqrtPriceToPrice,
  tickIndexToPrice,
} from "@orca-so/whirlpools-core";

const RPC = process.env.SOLANA_RPC ?? "https://api.mainnet-beta.solana.com";
const rpc = createSolanaRpc(RPC);
const dono = address(process.argv[2]);
const DEFAULT = "11111111111111111111111111111111"; // slot de recompensa vazio
const t0 = Date.now();

// 1) posições da carteira (inclui NFTs do token clássico E do Token-2022, e bundles)
const cruas = await fetchPositionsForOwner(rpc, dono);
const posicoes = cruas.flatMap((p) => (p.isPositionBundle ? p.positions : [p]));
console.log(`${posicoes.length} posição(ões) na Orca (${cruas.length} NFT/bundle) — ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (posicoes.length === 0) process.exit(0);

// 2) pools
const enderecosPools = [...new Set(posicoes.map((p) => p.data.whirlpool))];
const pools = new Map((await fetchAllWhirlpool(rpc, enderecosPools)).map((w) => [w.address, w]));

// 3) casas decimais dos tokens, lidas no próprio mint (byte 44 no layout de
//    Mint, igual no token clássico e no Token-2022)
const mints = new Set();
for (const w of pools.values()) {
  mints.add(w.data.tokenMintA);
  mints.add(w.data.tokenMintB);
  for (const r of w.data.rewardInfos) if (r.mint !== DEFAULT) mints.add(r.mint);
}
const listaMints = [...mints];
const contasMint = await rpc.getMultipleAccounts(listaMints, { encoding: "base64" }).send();
const decimais = new Map(
  listaMints.map((m, i) => {
    const dado = contasMint.value[i]?.data?.[0];
    return [m, dado ? Buffer.from(dado, "base64")[44] : null];
  }),
);

// 4) preço e símbolo pela DefiLlama — o mesmo provedor do site, chave "solana:<mint>"
const lhama = await fetch(`https://coins.llama.fi/prices/current/${listaMints.map((m) => `solana:${m}`).join(",")}`).then((r) => r.json());
const precoDe = (m) => lhama.coins?.[`solana:${m}`]?.price ?? null;
const simbolo = (m) => lhama.coins?.[`solana:${m}`]?.symbol ?? `${m.slice(0, 4)}…`;

// 5) ticks das pontas de cada posição (necessários para taxas e recompensas)
const arrays = new Map();
for (const p of posicoes) {
  const w = pools.get(p.data.whirlpool);
  for (const t of [p.data.tickLowerIndex, p.data.tickUpperIndex]) {
    const inicio = getTickArrayStartTickIndex(t, w.data.tickSpacing);
    const [end] = await getTickArrayAddress(w.address, inicio);
    arrays.set(end, null);
  }
}
for (const a of await fetchAllTickArray(rpc, [...arrays.keys()])) arrays.set(a.address, a);
async function tickDe(w, t) {
  const inicio = getTickArrayStartTickIndex(t, w.data.tickSpacing);
  const [end] = await getTickArrayAddress(w.address, inicio);
  return arrays.get(end).data.ticks[getTickIndexInArray(t, inicio, w.data.tickSpacing)];
}

// 6) um "card" por posição
const agora = BigInt(Math.floor(Date.now() / 1000));
const human = (raw, d) => Number(raw) / 10 ** d;
const usd = (n) => (n === null ? "—" : `$${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`);
let total = 0;
let totalRec = 0;
let semPreco = 0;
for (const p of posicoes) {
  const w = pools.get(p.data.whirlpool);
  const { tokenMintA: mA, tokenMintB: mB } = w.data;
  const dA = decimais.get(mA);
  const dB = decimais.get(mB);
  const [pA, pB] = [precoDe(mA), precoDe(mB)];

  const q = decreaseLiquidityQuote(p.data.liquidity, 0, w.data.sqrtPrice, p.data.tickLowerIndex, p.data.tickUpperIndex);
  const [aA, aB] = [human(q.tokenEstA, dA), human(q.tokenEstB, dB)];
  const valor = pA !== null && pB !== null ? aA * pA + aB * pB : null;
  if (valor === null) semPreco++;
  else total += valor;

  const [baixo, cima] = [await tickDe(w, p.data.tickLowerIndex), await tickDe(w, p.data.tickUpperIndex)];
  const taxas = collectFeesQuote(w.data, p.data, baixo, cima);
  const recs = collectRewardsQuote(w.data, p.data, baixo, cima, agora);
  const emRange = w.data.tickCurrentIndex >= p.data.tickLowerIndex && w.data.tickCurrentIndex < p.data.tickUpperIndex;

  const linhasRec = [
    [mA, taxas.feeOwedA, "fees"],
    [mB, taxas.feeOwedB, "fees"],
    ...w.data.rewardInfos.map((r, i) => [r.mint, recs.rewards[i]?.rewardsOwed ?? 0n, "rewards"]).filter(([m]) => m !== DEFAULT),
  ]
    .filter(([, raw]) => raw > 0n)
    .map(([m, raw, tipo]) => {
      const amt = human(raw, decimais.get(m) ?? 0);
      const v = precoDe(m) === null ? null : amt * precoDe(m);
      if (v !== null) totalRec += v;
      return `${simbolo(m)} ${tipo} ${amt.toPrecision(4)} ${usd(v)}`;
    });

  const preco = (t) => tickIndexToPrice(t, dA, dB).toPrecision(6);
  console.log(`\n${simbolo(mA)}/${simbolo(mB)} ${(w.data.feeRate / 10_000).toString()}%  ${usd(valor)}  ${emRange ? "✓ in range" : "⚠ out of range"}  NFT ${p.data.positionMint.slice(0, 4)}…`);
  console.log(`   ${simbolo(mA)} ${aA.toPrecision(6)} ${usd(pA === null ? null : aA * pA)} · ${simbolo(mB)} ${aB.toPrecision(6)} ${usd(pB === null ? null : aB * pB)}`);
  console.log(`   faixa ${preco(p.data.tickLowerIndex)} — agora ${sqrtPriceToPrice(w.data.sqrtPrice, dA, dB).toPrecision(6)} — ${preco(p.data.tickUpperIndex)} ${simbolo(mB)}/${simbolo(mA)}`);
  console.log(`   a receber: ${linhasRec.length ? linhasRec.join(" · ") : "nada"}`);
}
console.log(`\nTOTAL em pools: ${usd(total)}${semPreco ? ` (+ ${semPreco} sem preço)` : ""} · a receber: ${usd(totalRec)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
