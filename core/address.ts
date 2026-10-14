/**
 * Endereço de carteira: EVM (0x…) OU Solana (base58). Fonte única da regra,
 * usada pela busca (navegador), pela página da carteira e pela API.
 *
 * Existe desde a entrada da Solana (14/10/2026): até ali, "endereço válido"
 * era o `isAddress` do viem, e uma carteira Solana colada na busca recebia
 * "isso não parece um endereço". Sem dependência de SDK da Solana de
 * propósito — este arquivo vai para o bundle do navegador.
 */

import { getAddress, isAddress, type Address } from "viem";

export type WalletAddress = { kind: "evm"; address: Address } | { kind: "solana"; address: string };

export type AddressKind = WalletAddress["kind"];

const BASE58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

/** bytes de uma string base58; null = caractere fora do alfabeto */
function base58Bytes(s: string): number[] | null {
  const bytes: number[] = [];
  for (const ch of s) {
    let carry = BASE58.indexOf(ch);
    if (carry < 0) return null;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // cada "1" à esquerda é um byte zero
  for (let i = 0; i < s.length && s[i] === "1"; i++) bytes.push(0);
  return bytes;
}

/**
 * Chave pública da Solana: base58 que decodifica em EXATAMENTE 32 bytes.
 * Não diferencia carteira de conta de programa — nenhuma checagem offline
 * faz isso, e uma conta sem posição só devolve a lista vazia.
 */
export function isSolanaAddress(s: string): boolean {
  if (s.length < 32 || s.length > 44) return false;
  return base58Bytes(s)?.length === 32;
}

/**
 * Lê o que o visitante colou. EVM sai com checksum (como sempre saiu);
 * Solana sai como veio — base58 diferencia maiúscula de minúscula, então
 * "normalizar a caixa" ali seria trocar de endereço.
 */
export function parseWalletAddress(raw: string): WalletAddress | null {
  const s = raw.trim();
  if (isAddress(s)) return { kind: "evm", address: getAddress(s) };
  if (isSolanaAddress(s)) return { kind: "solana", address: s };
  return null;
}

/** "0x1234…abcd" / "8DT5…25AB" — mesma forma nas duas famílias */
export function shortAddress(a: string): string {
  return a.startsWith("0x") ? `${a.slice(0, 6)}…${a.slice(-4)}` : `${a.slice(0, 4)}…${a.slice(-4)}`;
}
