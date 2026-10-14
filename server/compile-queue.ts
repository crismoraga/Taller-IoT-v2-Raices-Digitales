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
  signal: AbortSignal;
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
  controller: AbortController;
  consumers: Set<symbol>;
  persistentConsumer: boolean;
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

  run(key: string, input: Input, signal?: AbortSignal): Promise<Result> {
    if (signal?.aborted) return Promise.reject(this.cancelledError());
    this.expireCache();
    const cached = this.cache.get(key);
    if (cached) {
      // Keep recently used successful sketches when the cache reaches its cap.
      this.cache.delete(key);
      this.cache.set(key, cached);
      return Promise.resolve(cached.value);
    }
    const existing = this.jobs.get(key);
    if (existing) return this.subscribe(existing, signal);
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
      controller: new AbortController(),
      consumers: new Set(),
      persistentConsumer: false,
    };
    this.jobs.set(key, job);
    const result = this.subscribe(job, signal);
    if (!this.active) void this.execute(job);
    else {
      this.waiting.push(job);
      job.timer = setTimeout(() => this.expireJob(job), this.maxWaitMs);
    }
    return result;
  }

  private cancelledError() {
    return new CompileQueueError(
      "Se canceló la compilación de este programa.",
      499,
    );
  }

  private subscribe(
    job: Job<Input, Result>,
    signal?: AbortSignal,
  ): Promise<Result> {
    // A disconnected browser must not cancel a build shared by other groups.
    if (!signal) {
      job.persistentConsumer = true;
      return job.promise;
    }
    const consumer = Symbol();
    job.consumers.add(consumer);
    return new Promise((resolve, reject) => {
      let settled = false;
      const release = () => {
        settled = true;
        signal.removeEventListener("abort", abort);
        job.consumers.delete(consumer);
      };
      const abort = () => {
        if (settled) return;
        release();
        reject(this.cancelledError());
        if (!job.consumers.size && !job.persistentConsumer) {
          job.controller.abort();
          // Release the key immediately so a fresh attempt can queue while
          // the active worker finishes terminating its process.
          if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
          const index = this.waiting.indexOf(job);
          if (index >= 0) {
            this.waiting.splice(index, 1);
            if (job.timer) clearTimeout(job.timer);
            job.reject(this.cancelledError());
          }
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      job.promise.then(
        (value) => {
          if (settled) return;
          release();
          resolve(value);
        },
        (error) => {
          if (settled) return;
          release();
          reject(error);
        },
      );
    });
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
        signal: job.controller.signal,
      });
      if (job.controller.signal.aborted) throw this.cancelledError();
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
      if (this.jobs.get(job.key) === job) this.jobs.delete(job.key);
      this.active = false;
      this.drain();
    }
  }
}
