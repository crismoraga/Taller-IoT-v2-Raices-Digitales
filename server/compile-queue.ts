/** One compiler process at a time; identical requests share its result. */
export class CompileQueueError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CompileQueueError";
  }
}

export interface CompileWorkContext {
  enqueuedAt: number;
  startedAt: number;
}

interface QueueOptions {
  maxQueued?: number;
  maxWaitMs?: number;
  maxCached?: number;
  cacheTtlMs?: number;
  now?: () => number;
}

interface Job<Input, Result> {
  key: string;
  input: Input;
  enqueuedAt: number;
  promise: Promise<Result>;
  resolve: (result: Result) => void;
  reject: (error: unknown) => void;
  timer?: ReturnType<typeof setTimeout>;
}

export class CompileQueue<Input, Result> {
  private active = false;
  private waiting: Job<Input, Result>[] = [];
  private jobs = new Map<string, Job<Input, Result>>();
  private cache = new Map<string, { value: Result; expiresAt: number }>();
  private readonly maxQueued: number;
  private readonly maxWaitMs: number;
  private readonly maxCached: number;
  private readonly cacheTtlMs: number;
  private readonly now: () => number;

  constructor(
    private readonly worker: (
      input: Input,
      context: CompileWorkContext,
    ) => Promise<Result>,
    options: QueueOptions = {},
  ) {
    this.maxQueued = options.maxQueued ?? 12;
    this.maxWaitMs = options.maxWaitMs ?? 40000;
    this.maxCached = options.maxCached ?? 24;
    this.cacheTtlMs = options.cacheTtlMs ?? 600000;
    this.now = options.now ?? Date.now;
  }

  run(key: string, input: Input): Promise<Result> {
    this.expireCache();
    const cached = this.cache.get(key);
    if (cached) {
      // Keep recently used successful sketches when the cache reaches its cap.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return Promise.resolve(cached.value);
    }
    const existing = this.jobs.get(key);
    if (existing) return existing.promise;
    if (this.active && this.waiting.length >= this.maxQueued)
      return Promise.reject(
        new CompileQueueError(
          "Hay varios grupos compilando. Espera un momento y vuelve a ejecutar tu programa.",
          429,
        ),
      );

    let resolve!: (result: Result) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<Result>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const job: Job<Input, Result> = {
      key,
      input,
      promise,
      resolve,
      reject,
      enqueuedAt: this.now(),
    };
    this.jobs.set(key, job);
    if (!this.active) void this.execute(job);
    else {
      this.waiting.push(job);
      job.timer = setTimeout(() => this.expireJob(job), this.maxWaitMs);
    }
    return promise;
  }

  private expireCache() {
    const now = this.now();
    for (const [key, entry] of this.cache)
      if (entry.expiresAt <= now) this.cache.delete(key);
  }

  private expireJob(job: Job<Input, Result>) {
    if (this.jobs.get(job.key) !== job) return;
    const index = this.waiting.indexOf(job);
    if (index < 0) return;
    this.waiting.splice(index, 1);
    this.jobs.delete(job.key);
    job.reject(
      new CompileQueueError(
        "Tu programa no alcanzó turno de compilación. Vuelve a intentarlo; tu código sigue guardado.",
        408,
      ),
    );
  }

  private drain() {
    while (!this.active && this.waiting.length) {
      const next = this.waiting[0];
      if (this.now() - next.enqueuedAt >= this.maxWaitMs) {
        if (next.timer) clearTimeout(next.timer);
        this.expireJob(next);
      } else {
        this.waiting.shift();
        void this.execute(next);
      }
    }
  }

  private async execute(job: Job<Input, Result>) {
    this.active = true;
    if (job.timer) clearTimeout(job.timer);
    try {
      const value = await this.worker(job.input, {
        enqueuedAt: job.enqueuedAt,
        startedAt: this.now(),
      });
      this.expireCache();
      if (this.maxCached > 0 && this.cacheTtlMs > 0) {
        this.cache.set(job.key, {
          value,
          expiresAt: this.now() + this.cacheTtlMs,
        });
        while (this.cache.size > this.maxCached)
          this.cache.delete(this.cache.keys().next().value!);
      }
      job.resolve(value);
    } catch (error) {
      job.reject(error);
    } finally {
      this.jobs.delete(job.key);
      this.active = false;
      this.drain();
    }
  }
}
