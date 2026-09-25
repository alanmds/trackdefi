/**
 * PoC — locks veVELO / veAERO (veNFT) e suas recompensas de voto.
 *
 * POR QUÊ (25/09/2026): comparando a carteira demo com o Zerion, 77% da
 * diferença de cobertura (US$ 4.831 de US$ 6.300) é UM lock de veVELO. Quem
 * faz LP na Aerodrome/Velodrome quase sempre trava o token para votar — é o
 * modelo ve(3,3) —, então isso está no centro do tema do site, não fora dele.
 *
 * Endereços do repo oficial velodrome-finance/sugar, deployments/<rede>.env,
 * conferidos em 25/09/2026:
 *   VE_SUGAR_ADDRESS_8453      0x4d6A741cEE6A8cC5632B2d948C050303F6246D24
 *   VE_SUGAR_ADDRESS_10        0xFE0a44d356a9F52c9F1bE0ba0f0877d986438c9C
 *   REWARDS_SUGAR_ADDRESS_8453 0x1b121EfDaF4ABb8785a315C51D29BCE0552A7678
 *   REWARDS_SUGAR_ADDRESS_10   0x62CCFB2496f49A80B0184AD720379B529E9152fB
 * As redes-folha da Superchain NÃO têm VE_SUGAR (a governança mora na
 * Optimism), só REWARDS_SUGAR.
 *
 * O que este PoC precisa responder:
 *   1. o struct VeNFT do repo (main) bate com o contrato IMPLANTADO?
 *   2. o valor do lock bate com o Zerion (US$ 4.830,87 na Optimism)?
 *   3. recompensas de voto: perguntar só pelos pools VOTADOS basta, ou fica
 *      recompensa de época antiga para trás? (compara com a varredura total)
 *
 * Uso: npx tsx poc/probe-venft.ts [0xCARTEIRA]
 */

import { formatUnits, parseAbi, type Address } from "viem";
import { createReader } from "../core/chain";
import { CHAINS } from "../core/chains";
import { defillamaPrices } from "../core/prices/defillama";

const veSugarAbi = parseAbi([
  "struct LpVotes { address lp; uint256 weight; }",
  "struct VeNFT { uint256 id; address account; uint8 decimals; uint128 amount; uint256 voting_amount; uint256 governance_amount; uint256 rebase_amount; uint256 expires_at; uint256 voted_at; LpVotes[] votes; address token; bool permanent; uint256 delegate_id; uint256 managed_id; }",
  "function byAccount(address _account) view returns (VeNFT[])",
]);

const rewardsSugarAbi = parseAbi([
  "struct Reward { uint256 venft_id; address lp; uint256 amount; address token; address fee; address bribe; }",
  "function rewardsByAddress(uint256 _venft_id, address _pool) view returns (Reward[])",
  "function rewards(uint256 _limit, uint256 _offset, uint256 _venft_id) view returns (Reward[])",
]);

const erc20Abi = parseAbi(["function symbol() view returns (string)", "function decimals() view returns (uint8)"]);

const REDES = [
  { chainId: 8453, ve: "0x4d6A741cEE6A8cC5632B2d948C050303F6246D24", rewards: "0x1b121EfDaF4ABb8785a315C51D29BCE0552A7678" },
  { chainId: 10, ve: "0xFE0a44d356a9F52c9F1bE0ba0f0877d986438c9C", rewards: "0x62CCFB2496f49A80B0184AD720379B529E9152fB" },
] as const;

const data = (s: bigint) => (s === 0n ? "—" : new Date(Number(s) * 1000).toISOString().slice(0, 10));

async function main() {
  const conta = (process.argv[2] ?? "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac") as Address;
  console.log(`carteira ${conta}\n`);

  for (const rede of REDES) {
    const info = CHAINS[rede.chainId];
    const r = createReader(rede.chainId) as any;
    console.log(`=================== ${info.label} ===================`);

    // ---------------------------------------------------- 1) os locks
    let t0 = Date.now();
    let locks: any[];
    try {
      locks = (await r.readContract({ address: rede.ve, abi: veSugarAbi, functionName: "byAccount", args: [conta] })) as any[];
    } catch (e) {
      console.log(`  byAccount FALHOU: ${(e as Error).message.split("\n")[0].slice(0, 120)}`);
      console.log(`  (se for erro de decodificação, o struct do repo não bate com o implantado)\n`);
      continue;
    }
    console.log(`  byAccount: ${locks.length} lock(s) em ${Date.now() - t0} ms`);
    if (locks.length === 0) { console.log(); continue; }

    // preço do token travado
    const tokens = [...new Set(locks.map((l) => l.token as Address))];
    const precos = await defillamaPrices.fetchUsdPrices(info.priceSlug, tokens);

    for (const l of locks) {
      const sym = (await r.readContract({ address: l.token, abi: erc20Abi, functionName: "symbol" })) as string;
      const qtd = Number(formatUnits(l.amount, l.decimals));
      const voto = Number(formatUnits(l.voting_amount, l.decimals));
      const rebase = Number(formatUnits(l.rebase_amount, l.decimals));
      const p = precos.get((l.token as string).toLowerCase()) ?? null;
      console.log(`\n  ── veNFT #${l.id} (${sym})`);
      console.log(`     travado:       ${qtd.toLocaleString("pt-BR", { maximumFractionDigits: 2 })} ${sym}  ≈ ${p === null ? "sem preço" : "US$ " + (qtd * p).toFixed(2)}`);
      console.log(`     poder de voto: ${voto.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}  ${l.permanent ? "(lock PERMANENTE)" : `vence ${data(l.expires_at)}`}`);
      console.log(`     rebase a receber: ${rebase.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} ${sym}  ≈ ${p === null ? "—" : "US$ " + (rebase * p).toFixed(2)}`);
      console.log(`     votou em ${data(l.voted_at)} · ${l.votes.length} pool(s) · delegate ${l.delegate_id} · managed ${l.managed_id}`);

      // ---------------------------------------------------- 3a) recompensas SÓ dos pools votados
      t0 = Date.now();
      const porVoto: any[] = [];
      for (const v of l.votes) {
        try {
          const rs = (await r.readContract({ address: rede.rewards, abi: rewardsSugarAbi, functionName: "rewardsByAddress", args: [l.id, v.lp] })) as any[];
          porVoto.push(...rs);
        } catch (e) {
          console.log(`     rewardsByAddress(${v.lp.slice(0, 10)}) falhou: ${(e as Error).message.split("\n")[0].slice(0, 70)}`);
        }
      }
      console.log(`\n     recompensas de voto (só pools votados): ${porVoto.length} item(ns) em ${Date.now() - t0} ms`);

      // ---------------------------------------------------- 3b) varredura TOTAL, paginada
      t0 = Date.now();
      const total: any[] = [];
      let paginas = 0;
      for (let off = 0; off < 5000; off += 300) {
        try {
          const rs = (await r.readContract({ address: rede.rewards, abi: rewardsSugarAbi, functionName: "rewards", args: [300n, BigInt(off), l.id] })) as any[];
          paginas++;
          total.push(...rs);
        } catch (e) {
          console.log(`     rewards(offset ${off}) parou: ${(e as Error).message.split("\n")[0].slice(0, 70)}`);
          break;
        }
      }
      console.log(`     recompensas de voto (varredura TOTAL): ${total.length} item(ns), ${paginas} página(s), ${Date.now() - t0} ms`);

      // ---------------------------------------------------- valores
      const agrega = async (lista: any[]) => {
        const porToken = new Map<string, bigint>();
        for (const x of lista) porToken.set((x.token as string).toLowerCase(), (porToken.get((x.token as string).toLowerCase()) ?? 0n) + (x.amount as bigint));
        const ps = await defillamaPrices.fetchUsdPrices(info.priceSlug, [...porToken.keys()] as Address[]);
        let usd = 0;
        const linhas: string[] = [];
        for (const [tk, amt] of porToken) {
          const [s, d] = await Promise.all([
            r.readContract({ address: tk, abi: erc20Abi, functionName: "symbol" }) as Promise<string>,
            r.readContract({ address: tk, abi: erc20Abi, functionName: "decimals" }) as Promise<number>,
          ]);
          const q = Number(formatUnits(amt, d));
          const pr = ps.get(tk) ?? null;
          if (pr !== null) usd += q * pr;
          linhas.push(`${s} ${q.toLocaleString("pt-BR", { maximumFractionDigits: 4 })} (${pr === null ? "sem preço" : "US$ " + (q * pr).toFixed(2)})`);
        }
        return { usd, linhas };
      };
      const a = await agrega(porVoto);
      const b = await agrega(total);
      console.log(`\n     só votados:  US$ ${a.usd.toFixed(2)}  →  ${a.linhas.join(" · ") || "(nada)"}`);
      console.log(`     total:       US$ ${b.usd.toFixed(2)}  →  ${b.linhas.join(" · ") || "(nada)"}`);
      console.log(`     ${Math.abs(a.usd - b.usd) < 0.01 ? "✅ perguntar só pelos votados BASTA" : "⚠️ os votados NÃO bastam — há recompensa de pool fora do voto atual"}`);
    }
    console.log();
  }
  console.log("Zerion (25/09 13:07): Velodrome · Optimism · Locked US$ 4.830,87; recompensas VELO 48,95 + 18,34 + 0,36, OP 0,58, Tarot 0,43");
}

main().catch((e) => { console.error("ERRO:", e); process.exit(1); });
