/**
 * Locks de governança ve(3,3) — veAERO (Base) e veVELO (Optimism).
 *
 * Fonte: os contratos VeSugar e RewardsSugar do mesmo repo oficial do LP Sugar
 * (velodrome-finance/sugar). Endereços em `config.ts`, conferidos em 25/09/2026.
 *
 * O QUE O PoC (`poc/probe-venft.ts`) PROVOU, e que define o desenho daqui:
 * - o struct `VeNFT` do repo decodifica o contrato IMPLANTADO nas duas redes;
 * - o valor bate com o Zerion a 1,4% (a diferença é só a fonte de preço);
 * - recompensa de voto: perguntar pool a pool (`rewardsByAddress`) pelos
 *   pools em que o lock VOTOU achou o mesmo valor que a varredura de TODOS os
 *   pools (`rewards`), em 275 ms contra 4,6 s por lock. Por isso não varremos
 *   tudo.
 *
 * LIMITE CONHECIDO: um lock depositado num lock GERENCIADO (relay, campo
 * `managed_id`) aparece com quantidade 0 — o VELO dele mora no gerenciado, que
 * não é da carteira. Hoje ele só aparece se tiver rebase a receber.
 */

import { parseAbi, type Address } from "viem";
import type { LockPosition, LockReward, TokenInfo } from "../../types";

export const veSugarAbi = parseAbi([
  "struct LpVotes { address lp; uint256 weight; }",
  "struct VeNFT { uint256 id; address account; uint8 decimals; uint128 amount; uint256 voting_amount; uint256 governance_amount; uint256 rebase_amount; uint256 expires_at; uint256 voted_at; LpVotes[] votes; address token; bool permanent; uint256 delegate_id; uint256 managed_id; }",
  "function byAccount(address _account) view returns (VeNFT[])",
]);

export const rewardsSugarAbi = parseAbi([
  "struct Reward { uint256 venft_id; address lp; uint256 amount; address token; address fee; address bribe; }",
  "function rewardsByAddress(uint256 _venft_id, address _pool) view returns (Reward[])",
]);

/** o que o VeSugar devolve (subconjunto usado) */
export interface RawLock {
  id: bigint;
  amount: bigint;
  voting_amount: bigint;
  rebase_amount: bigint;
  expires_at: bigint;
  votes: readonly { lp: Address; weight: bigint }[];
  token: Address;
  permanent: boolean;
  managed_id: bigint;
}

/** o que o RewardsSugar devolve (subconjunto usado) */
export interface RawVoteReward {
  venft_id: bigint;
  amount: bigint;
  token: Address;
}

/**
 * Lock que vale mostrar: tem algo travado ou algo a receber. Lock vencido e
 * sacado (tudo zero) some da tela, como posição fechada sem taxa pendente.
 */
export function lockHasSubstance(l: RawLock, rewards: readonly RawVoteReward[]): boolean {
  return l.amount > 0n || l.rebase_amount > 0n || rewards.some((r) => r.amount > 0n);
}

/**
 * PURO e testável: monta o modelo normalizado a partir das leituras cruas.
 * Recompensas do mesmo token vindas de pools diferentes (ou de taxa + incentivo
 * no mesmo pool) são SOMADAS — o usuário resgata por token, não por fonte.
 */
export function buildLocks(
  raw: readonly RawLock[],
  rewardsByLock: ReadonlyMap<bigint, readonly RawVoteReward[]>,
  tokens: ReadonlyMap<string, TokenInfo>,
  protocol: string,
  chainId: number,
): LockPosition[] {
  const tk = (a: Address): TokenInfo =>
    tokens.get(a.toLowerCase()) ?? { address: a, symbol: a.slice(0, 8), decimals: 18 };

  const out: LockPosition[] = [];
  for (const l of raw) {
    const votos = rewardsByLock.get(l.id) ?? [];
    if (!lockHasSubstance(l, votos)) continue;

    const rewards: LockReward[] = [];
    if (l.rebase_amount > 0n) rewards.push({ token: tk(l.token), raw: l.rebase_amount, kind: "rebase" });

    const somaVoto = new Map<string, bigint>();
    for (const r of votos) {
      if (r.amount <= 0n) continue;
      const k = r.token.toLowerCase();
      somaVoto.set(k, (somaVoto.get(k) ?? 0n) + r.amount);
    }
    for (const [addr, raw] of somaVoto) rewards.push({ token: tk(addr as Address), raw, kind: "vote" });

    out.push({
      protocol,
      chainId,
      lockId: l.id.toString(),
      token: tk(l.token),
      amountRaw: l.amount,
      votingPowerRaw: l.voting_amount,
      expiresAt: Number(l.expires_at),
      permanent: l.permanent,
      managedId: l.managed_id > 0n ? l.managed_id.toString() : null,
      rewards,
    });
  }
  return out;
}
