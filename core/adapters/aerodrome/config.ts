/**
 * Configurações do ecossistema Sugar (Aerodrome/Velodrome e irmãs).
 * O MESMO adapter atende todas as redes do ecossistema — só muda esta
 * config (Receita A do playbook). Fonte: deployments/<chain>.env do repo
 * github.com/velodrome-finance/sugar.
 *
 * Sugar tem VERSÕES por chain — se a varredura quebrar numa rede, conferir
 * primeiro se o endereço mudou no repo.
 */

import type { Address } from "viem";

export interface SugarChainConfig {
  /** id do protocolo no DTO/UI (ex.: "aerodrome") */
  protocol: string;
  chainId: number;
  sugar: Address;
  /** factories (v2 + CL) — usadas só para contar pools e dimensionar a varredura */
  factories: Address[];
  /** token de emissões dos gauges (AERO na Base, VELO na Optimism) */
  emissionsToken: Address;
  /** carteira de teste do próprio repo sugar (PoC/bateria) */
  testWallet: Address;
}

/** Base — conferido em 10/07/2026 (deployments/base.env) */
export const AERODROME_BASE: SugarChainConfig = {
  protocol: "aerodrome",
  chainId: 8453,
  sugar: "0x69dD9db6d8f8E7d83887A704f447b1a584b599A1",
  factories: [
    "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
    "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
    "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a",
    "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef",
  ],
  emissionsToken: "0x940181a94A35A4569E4529A3CDfB74e38FD98631", // AERO
  testWallet: "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac",
};

/** Optimism — conferido em 12/07/2026 (deployments/optimism.env).
 * emissionsToken (VELO) não consta no env: candidato conhecido, VERIFICADO
 * on-chain no PoC da Receita A (symbol() precisa devolver "VELO"). */
export const VELODROME_OPTIMISM: SugarChainConfig = {
  protocol: "velodrome",
  chainId: 10,
  sugar: "0x347512180804A8B40AA7525AE932a31198F074aA",
  factories: [
    "0xF1046053aa5682b4F9a81b5481394DA16BE5FF5a",
    "0xCc0bDDB707055e04e497aB22a59c2aF4391cd12F",
  ],
  emissionsToken: "0x9560e827aF36c94D2Ac33a39bCE1Fe78631088Db", // VELO
  testWallet: "0x892Ff98a46e5bd141E2D12618f4B2Fe6284debac",
};

// compatibilidade com código/testes existentes (Base)
export const CHAIN_ID = AERODROME_BASE.chainId;
export const CHAIN_SLUG = "base";
export const LP_SUGAR = AERODROME_BASE.sugar;
export const FACTORIES = AERODROME_BASE.factories;
export const AERO = AERODROME_BASE.emissionsToken;
