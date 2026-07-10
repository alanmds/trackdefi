/**
 * Placeholder da landing. A interface de verdade é a Fase 4 — por enquanto
 * confirma que o app sobe e aponta para a API já funcional.
 */
export default function Home() {
  return (
    <main style={{ fontFamily: "system-ui, sans-serif", maxWidth: 640, margin: "4rem auto", padding: "0 1rem", lineHeight: 1.6 }}>
      <h1 style={{ marginBottom: 0 }}>trackdefi</h1>
      <p style={{ color: "#666", marginTop: 4 }}>Liquidity pool position tracker</p>
      <p>
        The API is live. Query a wallet at{" "}
        <code>/api/positions?address=0x…</code> (Base · Aerodrome).
      </p>
      <p style={{ color: "#888", fontSize: 14 }}>
        Read-only. We never ask for private keys or seed phrases. UI coming next.
      </p>
    </main>
  );
}
