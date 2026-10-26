import { AD_SANDBOX, AADS_UNIT_ID, adSrc, adsEnabled, type AdPlacement } from "../ads";

/**
 * Um espaço de anúncio (A-ADS, iframe isolado). Sem hook nem "use client":
 * serve tanto às páginas geradas no servidor (home, how-it-works — o robô da
 * A-ADS precisa ver o código no HTML) quanto à tela da carteira, que é de
 * navegador. O rótulo vem do dicionário do idioma (`ui.ads.label`).
 *
 * A caixa tem altura FIXA no CSS (.ad-slot): o anúncio carrega depois da
 * página, e sem a altura reservada ele empurraria o conteúdo (CLS).
 *
 * `referrerPolicy="strict-origin"`: a A-ADS recebe só `https://trackdefi.app`,
 * nunca o caminho — na carteira, o caminho é o endereço pesquisado.
 */
export default function AdSlot({ placement, label }: { placement: AdPlacement; label: string }) {
  if (!adsEnabled() || AADS_UNIT_ID === null) return null;
  return (
    <aside className={`ad-slot ad-${placement}`} aria-label={label}>
      <span className="ad-label">{label}</span>
      <iframe
        data-aa={AADS_UNIT_ID}
        src={adSrc(AADS_UNIT_ID)}
        title={label}
        sandbox={AD_SANDBOX}
        referrerPolicy="strict-origin"
        loading={placement === "wallet-scan" ? "eager" : "lazy"}
        className="ad-frame"
      />
    </aside>
  );
}
