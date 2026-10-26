/**
 * Anúncios — config central (mesmo papel do `app/donate.ts` para a doação).
 *
 * Rede: A-ADS (aads.com). Escolhida no mapa de banners (privado/) por três
 * motivos: entra sem aprovação, não põe cookie no visitante e entrega o
 * anúncio num IFRAME — nada de script de terceiro rodando na nossa página.
 * Na página de carteira isso importa: o endereço pesquisado está na URL
 * (/w/0x…), e um script de anúncio poderia juntá-lo ao IP de quem olha.
 *
 * ⚠️ Plano Hobby da Vercel: anúncio é uso comercial (fair use guidelines,
 * conferido em 13/10/2026). O Alan decidiu em 14/10/2026 ligar assim mesmo;
 * se a Vercel suspender, o plano B é o espelho da Netlify (privado/PLANO_ANUNCIOS.md).
 *
 * Código de inserção conferido na ajuda oficial da A-ADS em 14/10/2026
 * ("How to Place an Ad Unit Code Correctly"): iframe com `data-aa` = id do
 * espaço e `src` = //acceptable.a-ads.com/<id>/?size=Adaptive. O `data-aa`
 * não pode sair — é por ele que o robô deles acha o anúncio.
 */

/**
 * Id do espaço criado no painel da A-ADS (só dígitos). `null` = nenhum
 * anúncio no site. Um espaço só serve o domínio inteiro (ajuda da A-ADS:
 * "You only need to create one ad unit for your website").
 *
 * ⚠️ O espaço é cadastrado com UMA página para o robô conferir: use a HOME
 * (https://trackdefi.app/). É a única página onde o anúncio está no HTML que
 * o servidor entrega; na carteira ele só aparece depois do JavaScript.
 */
export const AADS_UNIT_ID: string | null = "2460082"; // criado em 26/10/2026, página: home

/**
 * Interruptor de emergência, sem mexer no código: `NEXT_PUBLIC_ADS=off` no
 * painel da Vercel + redeploy tira todos os anúncios (ex.: apareceu anúncio
 * de golpe). Vale no build, como toda variável NEXT_PUBLIC_.
 */
export function adsEnabled(
  unitId: string | null = AADS_UNIT_ID,
  flag: string | undefined = process.env.NEXT_PUBLIC_ADS,
): boolean {
  if (flag?.trim().toLowerCase() === "off") return false;
  return unitId !== null && /^\d+$/.test(unitId);
}

/** endereço do iframe, no formato da ajuda oficial */
export function adSrc(unitId: string): string {
  if (!/^\d+$/.test(unitId)) throw new Error(`id de espaço A-ADS inválido: ${unitId}`);
  return `https://acceptable.a-ads.com/${unitId}/?size=Adaptive`;
}

/**
 * O que o iframe do anúncio pode fazer. Sem `allow-top-navigation`: um
 * anúncio malicioso não consegue trocar a NOSSA página por outra (golpe
 * clássico de redirecionamento). Os pop-ups ficam, porque o clique no
 * anúncio abre o anunciante numa aba nova.
 */
export const AD_SANDBOX = "allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox";

/**
 * Onde há anúncio. No máximo UM visível por página (regra do mapa): na
 * carteira, o da varredura some antes de o do fim da lista existir.
 */
export type AdPlacement = "home" | "wallet-scan" | "wallet-end" | "how-it-works";
