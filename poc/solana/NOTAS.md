# PoC Solana — Orca Whirlpools (26/09/2026)

Pasta isolada: `package.json` próprio (`@orca-so/whirlpools` 8.x +
`@solana/kit` 5.x). **Não mexe nas dependências do site.** Para rodar:
`cd poc/solana && npm install && node orca-positions.mjs <endereço-solana>`.

Programa oficial conferido em github.com/orca-so/whirlpools:
`whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc` (o SDK usa por padrão).

## O que funcionou

- `fetchPositionsForOwner` (SDK oficial) acha as posições da carteira nos dois
  programas de token (clássico e Token-2022) e em bundles. ~0,7 s.
- Card completo com dado público: par, taxa do pool, valor em US$, em range,
  quantidade de cada token (`decreaseLiquidityQuote`), faixa de preço
  (`tickIndexToPrice`), taxas a receber (`collectFeesQuote`) e recompensas do
  pool (`collectRewardsQuote`). Carteira inteira em 1,3–2,2 s.
- Preço e símbolo pela DefiLlama com chave `solana:<mint>` — o mesmo provedor
  do site. Coerência medida: preço do SOL pela DefiLlama x preço lido no pool
  divergem 0,05%.
- Casas decimais lidas no próprio mint (byte 44, igual nos dois programas).

## O que o PoC ensinou (entra na estimativa)

1. **RPC público não serve para produção.** Recusou (429) consultas pesadas
   depois de poucas chamadas. O caminho do site (busca por dono) passou, mas
   com 3 visitantes simultâneos cairia. Precisa de provedor com conta
   (Helius, QuickNode… — plano grátis existe) → conta do Alan + variável na
   Vercel.
2. **Motor novo, não config nova.** Nada do `ChainReader` (viem, multicall,
   ABI) se aplica. Endereço base58, sem chainId numérico, contas em vez de
   contratos.
3. **O SDK oficial resolve o pior** (layout das contas, matemática das
   quantidades e taxas, tick arrays fixos e dinâmicos). O adapter fica fino.
4. **Não há gauge/emissão** no sentido Aerodrome; o equivalente são as
   "rewards" do pool (até 3 tokens), que o SDK já calcula.
5. **Medição de taxa em janela (24 h / 15 min) não existe pronta** — no
   começo, "Earning now" só por estimativa.
6. Símbolo da DefiLlama vem em caixa baixa às vezes ("usdc") — normalizar.

## Não coberto ainda

- Posição fora da faixa, recompensa de pool ativa, token sem preço
  (o código trata; faltou carteira de teste com esses casos).
- Raydium e Meteora (formatos próprios; um PoC cada).
- Conferência contra a interface da Orca (o cálculo é o do SDK oficial).

`find-lp.mjs` / `find-lp2.mjs`: como achar carteira de TESTE em dado público
(posições de um pool → primeira transação do NFT → quem assinou). As
carteiras achadas ficam em `privado/`, nunca no repo.
