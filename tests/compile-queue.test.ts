import { afterEach, describe, expect, it, vi } from "vitest";
import { CompileQueue, CompileQueueError } from "../server/compile-queue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}

afterEach(() => vi.useRealTimers());

describe("compilación compartida durante un taller", () => {
  it("gives ten groups the same firmware after one actual worker request", async () => {
    const build = deferred<{ hex: string; output: string }>();
    const worker = vi.fn(() => build.promise);
    const queue = new CompileQueue(worker);
    const groups = Array.from({ length: 10 }, () =>
      queue.run("uno-led", "led"),
    );
    expect(worker).toHaveBeenCalledTimes(1);
    const result = { hex: ":00000001FF", output: "firmware verified" };
    build.resolve(result);
    expect(await Promise.all(groups)).toEqual(Array(10).fill(result));
    expect(worker).toHaveBeenCalledTimes(1);
  });

  it("runs different programs in arrival order with at most one active worker", async () => {
    const builds = new Map(
      ["led", "soil", "temperature"].map((id) => [id, deferred<string>()]),
    );
    const order: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const queue = new CompileQueue(async (program: string) => {
      order.push(program);
      maximumActive = Math.max(maximumActive, ++active);
      try {
        return await builds.get(program)!.promise;
      } finally {
        active--;
      }
    });
    const first = queue.run("led", "led");
    const second = queue.run("soil", "soil");
    const third = queue.run("temperature", "temperature");
    expect(order).toEqual(["led"]);
    builds.get("led")!.resolve("LED HEX");
    expect(await first).toBe("LED HEX");
    expect(order).toEqual(["led", "soil"]);
    builds.get("soil")!.resolve("SOIL HEX");
    expect(await second).toBe("SOIL HEX");
    expect(order).toEqual(["led", "soil", "temperature"]);
    builds.get("temperature")!.resolve("TEMPERATURE HEX");
    expect(await third).toBe("TEMPERATURE HEX");
    expect(maximumActive).toBe(1);
  });

  it("never shares an identical sketch between ATmega328P and ATmega168", async () => {
    const worker = vi.fn(
      async ({ board }: { board: string; code: string }) => `${board}:HEX`,
    );
    const queue = new CompileQueue(worker);
    const code = "void setup(){} void loop(){}";
    expect(await queue.run(`uno:${code}`, { board: "uno", code })).toBe(
      "uno:HEX",
    );
    expect(
      await queue.run(`nano-168:${code}`, { board: "nano-168", code }),
    ).toBe("nano-168:HEX");
    expect(await queue.run(`uno:${code}`, { board: "uno", code })).toBe(
      "uno:HEX",
    );
    expect(worker).toHaveBeenCalledTimes(2);
  });

  it("a failed shared build rejects its groups, allows the next job and is retried", async () => {
    const build = deferred<string>();
    let calls = 0;
    const worker = vi.fn((program: string) => {
      calls++;
      return calls === 1
        ? build.promise
        : Promise.resolve(`${program} recovered`);
    });
    const queue = new CompileQueue(worker);
    const first = queue.run("broken", "broken").catch((error) => error);
    const duplicate = queue.run("broken", "broken").catch((error) => error);
    const next = queue.run("next", "next");
    const failed = new Error("C++ syntax error");
    build.reject(failed);
    expect(await first).toBe(failed);
    expect(await duplicate).toBe(failed);
    expect(await next).toBe("next recovered");
    expect(await queue.run("broken", "broken")).toBe("broken recovered");
    expect(worker).toHaveBeenCalledTimes(3);
  });

  it("accepts twelve waiting programs and still deduplicates a job when full", async () => {
    const firstBuild = deferred<string>();
    const worker = vi.fn((program: string) =>
      program === "first" ? firstBuild.promise : Promise.resolve(program),
    );
    const queue = new CompileQueue(worker);
    const first = queue.run("first", "first");
    const waiting = Array.from({ length: 12 }, (_, index) =>
      queue.run(`job-${index}`, `job-${index}`),
    );
    const duplicate = queue.run("job-5", "job-5");
    expect(duplicate).toBe(waiting[5]);
    await expect(queue.run("overflow", "overflow")).rejects.toMatchObject({
      statusCode: 429,
    });
    firstBuild.resolve("first");
    expect(await first).toBe("first");
    expect(await Promise.all(waiting)).toHaveLength(12);
    expect(await duplicate).toBe("job-5");
    expect(worker).toHaveBeenCalledTimes(13);
  });

  it("expires a waiting job at forty seconds without running it or blocking a retry", async () => {
    vi.useFakeTimers();
    const firstBuild = deferred<string>();
    const worker = vi.fn((program: string) =>
      program === "first"
        ? firstBuild.promise
        : Promise.resolve(`${program} HEX`),
    );
    const queue = new CompileQueue(worker);
    const first = queue.run("first", "first");
    const waiting = queue.run("later", "later").catch((error) => error);
    await vi.advanceTimersByTimeAsync(39999);
    expect(worker).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    const timeout = await waiting;
    expect(timeout).toBeInstanceOf(CompileQueueError);
    expect(timeout.statusCode).toBe(408);
    expect(worker).toHaveBeenCalledTimes(1);
    const retry = queue.run("later", "later");
    firstBuild.resolve("first HEX");
    expect(await first).toBe("first HEX");
    expect(await retry).toBe("later HEX");
    expect(worker).toHaveBeenCalledTimes(2);
  });

  it("passes time already spent waiting to the worker's remaining request budget", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(100000);
    const firstBuild = deferred<string>();
    const contexts: number[] = [];
    const queue = new CompileQueue(async (program: string, context) => {
      contexts.push(context.startedAt - context.enqueuedAt);
      return program === "first" ? firstBuild.promise : "second HEX";
    });
    const first = queue.run("first", "first");
    const second = queue.run("second", "second");
    await vi.advanceTimersByTimeAsync(30000);
    firstBuild.resolve("first HEX");
    await Promise.all([first, second]);
    expect(contexts).toEqual([0, 30000]);
  });

  it("reuses successful builds for ten minutes without extending their age on a hit", async () => {
    vi.useFakeTimers();
    const worker = vi.fn(async () => ":00000001FF");
    const queue = new CompileQueue(worker);
    await queue.run("led", "led");
    await vi.advanceTimersByTimeAsync(599999);
    await queue.run("led", "led");
    expect(worker).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await queue.run("led", "led");
    expect(worker).toHaveBeenCalledTimes(2);
  });

  it("bounds the cache to twenty-four builds while keeping a recently reused lesson", async () => {
    const worker = vi.fn(async (program: string) => `${program} HEX`);
    const queue = new CompileQueue(worker);
    for (let index = 0; index < 24; index++)
      await queue.run(`job-${index}`, `job-${index}`);
    await queue.run("job-0", "job-0");
    await queue.run("job-24", "job-24");
    await queue.run("job-0", "job-0");
    expect(worker).toHaveBeenCalledTimes(25);
    await queue.run("job-1", "job-1");
    expect(worker).toHaveBeenCalledTimes(26);
  });

  it("recovers when a worker throws before returning its promise", async () => {
    let attempts = 0;
    const queue = new CompileQueue<string, string>((program) => {
      if (++attempts === 1) throw new Error("CLI failed to start");
      return Promise.resolve(`${program} HEX`);
    });
    await expect(queue.run("led", "led")).rejects.toThrow(
      "CLI failed to start",
    );
    expect(await queue.run("led", "led")).toBe("led HEX");
    expect(attempts).toBe(2);
  });
});
