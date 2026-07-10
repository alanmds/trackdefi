/**
 * Proteções de borda genéricas (sem dependência de framework), com relógio
 * injetável para teste determinístico.
 *
 * LIMITAÇÃO: estado em memória do processo. Em serverless (Vercel) cada
 * instância tem o seu — reduz repetição dentro de uma instância quente, mas
 * não é um cache/limite global. Trocar por KV/Redis só se o tráfego pedir.
 */

export class TtlCache<V> {
  private store = new Map<string, { at: number; value: V }>();
  constructor(
    private ttlMs: number,
    private now: () => number = Date.now,
  ) {}

  get(key: string): V | undefined {
    const e = this.store.get(key);
    if (!e) return undefined;
    if (this.now() - e.at >= this.ttlMs) {
      this.store.delete(key);
      return undefined;
    }
    return e.value;
  }

  set(key: string, value: V): void {
    this.store.set(key, { at: this.now(), value });
  }
}

/**
 * Limite de trabalhos simultâneos por instância (ex.: varreduras on-chain).
 * Protege a cota do RPC contra rajadas de endereços diferentes.
 */
export class Semaphore {
  private inUse = 0;
  constructor(private max: number) {}

  tryAcquire(): boolean {
    if (this.inUse >= this.max) return false;
    this.inUse++;
    return true;
  }

  release(): void {
    this.inUse = Math.max(0, this.inUse - 1);
  }
}

/** Janela fixa por chave (ex.: IP). check() retorna true se a requisição é permitida. */
export class FixedWindowLimiter {
  private hits = new Map<string, number[]>();
  constructor(
    private windowMs: number,
    private max: number,
    private now: () => number = Date.now,
  ) {}

  check(key: string): boolean {
    const t = this.now();
    const recent = (this.hits.get(key) ?? []).filter((ts) => t - ts < this.windowMs);
    if (recent.length >= this.max) {
      this.hits.set(key, recent);
      return false;
    }
    recent.push(t);
    this.hits.set(key, recent);
    return true;
  }
}
