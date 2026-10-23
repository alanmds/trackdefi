/**
 * Lançamento do Aero (22/10/2026 00:00 UTC): Aerodrome e Velodrome viram um
 * protocolo só, e os gauges antigos são desligados.
 *
 * Fonte: aero.xyz/aero-upgrade (lida em 21/10/2026). Os textos dos avisos
 * foram aprovados pelo Alan no mesmo dia. Os avisos ficam em silêncio antes da
 * hora do lançamento — dizer "se fundiram" antes do fato seria falso.
 *
 * Os números de emissão NÃO dependem disto: o adapter lê o `periodFinish` de
 * cada gauge e zera o que parou de pagar. Aqui mora só o TEXTO que explica.
 */

import type { LockDTO, PositionDTO } from "../core/service";

/** 21/10/2026 20h EDT = 22/10/2026 00:00 UTC */
export const AERO_LAUNCH_SEC = Date.UTC(2026, 9, 22) / 1000;

/** os protocolos que o Aero substituiu */
const SUGAR_PROTOCOLS = new Set(["aerodrome", "velodrome"]);

/**
 * Redes-folha da Velodrome que seguem com troca e liquidez, sem gauges nem
 * token (aero.xyz/aero-upgrade). Mode, Swell, Metal L2 e Superseed ficam de
 * fora: a fonte oficial não diz nada sobre elas.
 */
export const VELODROME_NO_GAUGE_CHAINS = [130, 1868, 252, 42220, 1135] as const;

/** Lisk: a Velodrome pede o saque até 31/10/2026; o aviso some depois disso */
export const LISK_CHAIN_ID = 1135;
export const LISK_WITHDRAW_UNTIL_SEC = Date.UTC(2026, 10, 1) / 1000;

export function aeroLaunched(nowSec: number): boolean {
  return nowSec >= AERO_LAUNCH_SEC;
}

export function isSugarProtocol(protocol: string): boolean {
  return SUGAR_PROTOCOLS.has(protocol);
}

/** o gauge desta posição parou no lançamento do Aero (e não antes) */
export function stoppedByAero(p: PositionDTO): boolean {
  const end = p.earning?.emissionsEndedAt;
  return isSugarProtocol(p.protocol) && end !== undefined && end >= AERO_LAUNCH_SEC;
}

export interface AeroWalletNotices {
  /** aviso geral: a carteira tem posição ou lock na Aerodrome/Velodrome */
  merged: boolean;
  /** redes-folha (sem gauges) onde a carteira tem posição na Velodrome */
  leafChains: number[];
  /** a carteira tem posição na Velodrome da Lisk e o prazo não venceu */
  liskDeadline: boolean;
}

export function aeroWalletNotices(
  positions: PositionDTO[],
  locks: LockDTO[],
  nowSec: number,
): AeroWalletNotices {
  if (!aeroLaunched(nowSec)) return { merged: false, leafChains: [], liskDeadline: false };
  const velodromeChains = new Set(positions.filter((p) => p.protocol === "velodrome").map((p) => p.chainId));
  return {
    merged: positions.some((p) => isSugarProtocol(p.protocol)) || locks.some((l) => isSugarProtocol(l.protocol)),
    leafChains: VELODROME_NO_GAUGE_CHAINS.filter((id) => velodromeChains.has(id)),
    liskDeadline: velodromeChains.has(LISK_CHAIN_ID) && nowSec < LISK_WITHDRAW_UNTIL_SEC,
  };
}
