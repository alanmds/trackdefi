/**
 * Avisos do lançamento do Aero (22/10/2026 00:00 UTC). O que importa travar:
 * nada aparece antes da hora (seria falso), nada aparece para quem não tem
 * Aerodrome/Velodrome, e o prazo da Lisk some depois de 31/10.
 */

import { describe, expect, it } from "vitest";
import { AERO_LAUNCH_SEC, aeroWalletNotices, stoppedByAero } from "../app/aero";
import type { LockDTO, PositionDTO } from "../core/service";

const pos = (protocol: string, chainId: number, emissionsEndedAt?: number): PositionDTO =>
  ({
    protocol,
    chainId,
    earning: emissionsEndedAt === undefined ? null : { emissionsEndedAt },
  }) as unknown as PositionDTO;
const lock = (protocol: string): LockDTO => ({ protocol, chainId: 10 }) as unknown as LockDTO;

const ANTES = AERO_LAUNCH_SEC - 60;
const DEPOIS = AERO_LAUNCH_SEC + 60;

describe("avisos do Aero na carteira", () => {
  it("antes do lançamento, nenhum aviso", () => {
    const a = aeroWalletNotices([pos("velodrome", 1135)], [lock("aerodrome")], ANTES);
    expect(a).toEqual({ merged: false, leafChains: [], liskDeadline: false });
  });

  it("carteira só com Uniswap não recebe aviso", () => {
    const a = aeroWalletNotices([pos("uniswap-v3", 8453)], [], DEPOIS);
    expect(a.merged).toBe(false);
  });

  it("um lock basta para o aviso geral", () => {
    expect(aeroWalletNotices([], [lock("velodrome")], DEPOIS).merged).toBe(true);
  });

  it("redes-folha sem gauge: só as citadas pela fonte oficial", () => {
    const a = aeroWalletNotices(
      [pos("velodrome", 42220), pos("velodrome", 34443), pos("velodrome", 130)],
      [],
      DEPOIS,
    );
    expect(a.leafChains).toEqual([130, 42220]); // Mode (34443) não é citada
  });

  it("prazo da Lisk aparece até 31/10 e some depois", () => {
    expect(aeroWalletNotices([pos("velodrome", 1135)], [], DEPOIS).liskDeadline).toBe(true);
    expect(aeroWalletNotices([pos("velodrome", 1135)], [], Date.UTC(2026, 10, 1) / 1000).liskDeadline).toBe(false);
  });
});

describe("frase do gauge desligado", () => {
  it("gauge parado NO lançamento usa a frase do Aero; parado antes, a genérica", () => {
    expect(stoppedByAero(pos("aerodrome", 8453, AERO_LAUNCH_SEC))).toBe(true);
    expect(stoppedByAero(pos("velodrome", 130, Date.UTC(2026, 9, 1) / 1000))).toBe(false);
    expect(stoppedByAero(pos("ramses-v3", 46630, AERO_LAUNCH_SEC))).toBe(false);
  });
});
