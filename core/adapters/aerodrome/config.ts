/**
 * Endereços da Aerodrome na Base (chainId 8453).
 * Fonte: deployments/base.env do repo github.com/velodrome-finance/sugar,
 * conferido em 10/07/2026. O Sugar tem versões — se a varredura quebrar,
 * conferir primeiro se este endereço mudou.
 */

import type { Address } from "viem";

export const CHAIN_ID = 8453;
export const CHAIN_SLUG = "base"; // slug usado pela DefiLlama

export const LP_SUGAR: Address = "0x69dD9db6d8f8E7d83887A704f447b1a584b599A1";

/** V2 factory + 3 CL factories — usadas só para contar pools e dimensionar a varredura */
export const FACTORIES: Address[] = [
  "0x420DD381b31aEf6683db6B902084cB0FFECe40Da",
  "0x5e7BB104d84c7CB9B682AaC2F3d509f5F406809A",
  "0xaDe65c38CD4849aDBA595a4323a8C7DdfE89716a",
  "0xf8f2eB4940CFE7d13603DDDD87f123820Fc061Ef",
];

/** Token de emissões da Aerodrome — sempre AERO */
export const AERO: Address = "0x940181a94A35A4569E4529A3CDfB74e38FD98631";
