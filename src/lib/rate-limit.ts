/**
 * Token bucket: hasta `capacity` pedidos seguidos y después `capacity` por `windowMs`.
 * Vive en memoria de la instancia; si algún día corren varias instancias a la vez,
 * el cupo real es la suma de todas y hay que moverlo a un almacén compartido.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;
  private readonly ratePerMs: number;
  private queue: Promise<void> = Promise.resolve();

  constructor(
    private readonly capacity: number,
    windowMs: number,
    private readonly now: () => number = Date.now,
    private readonly sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
  ) {
    this.tokens = capacity;
    this.last = now();
    this.ratePerMs = capacity / windowMs;
  }

  private refill() {
    const t = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + (t - this.last) * this.ratePerMs);
    this.last = t;
  }

  /** Toma un permiso sin esperar. Devuelve false si no hay cupo. */
  tryTake(): boolean {
    this.refill();
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }

  /** Espera hasta que haya cupo. Los pedidos se atienden en orden de llegada. */
  take(): Promise<void> {
    const run = async () => {
      for (;;) {
        if (this.tryTake()) return;
        await this.sleep(Math.ceil((1 - this.tokens) / this.ratePerMs));
      }
    };
    const next = this.queue.then(run);
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** Permisos disponibles ahora (para diagnóstico y tests). */
  available(): number {
    this.refill();
    return Math.floor(this.tokens);
  }
}
