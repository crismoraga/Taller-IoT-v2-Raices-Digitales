import {
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { request } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ArduinoCompiler, COMPILE_DEADLINE_HEADER } from "../server/arduino";
import { configuration } from "../server/config";
import { buildApp } from "../server/app";

const HEX = ":00000001FF\n";
const CODE = "void setup(){} void loop(){}";
const directories: string[] = [];
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function remote() {
  return new ArduinoCompiler(
    configuration({
      arduinoServiceUrl: "https://compiler.example",
      arduinoServiceToken: "private-test-token",
      secureCookies: false,
      logger: false,
    }),
  );
}
function abortableFetch() {
  return vi.fn(
    (_url: string, options: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = options.signal!;
        const abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        if (signal.aborted) abort();
      }),
  );
}
async function local() {
  const directory = await mkdtemp(join(tmpdir(), "rd-compiler-regression-"));
  directories.push(directory);
  const executable = join(directory, "fake-cli");
  const started = join(directory, "started.json");
  await writeFile(
    executable,
    `#!${process.execPath}\n${String.raw`
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const args = process.argv.slice(2);
const sketch = args.at(-1);
const code = readFileSync(join(sketch, "Raices.ino"), "utf8");
const output = args[args.indexOf("--output-dir") + 1];
if (code.includes("HANG")) {
  writeFileSync(STARTED, JSON.stringify({ pid: process.pid, directory: join(sketch, "..") }));
  setInterval(() => {}, 1000);
} else {
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, "Raices.ino.hex"), ":00000001FF\n");
  console.log(args[args.indexOf("--fqbn") + 1]);
}
`.replace("STARTED", JSON.stringify(started))}`,
  );
  await chmod(executable, 0o755);
  return {
    compiler: new ArduinoCompiler(
      configuration({
        arduinoCli: executable,
        arduinoServiceUrl: undefined,
        arduinoSandbox: false,
        secureCookies: false,
        logger: false,
      }),
    ),
    started,
  };
}
async function startedProcess(file: string) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      return JSON.parse(await readFile(file, "utf8")) as {
        pid: number;
        directory: string;
      };
    } catch {
      await delay(10);
    }
  }
  throw new Error("The regression CLI did not start");
}

async function workshop() {
  const directory = await mkdtemp(
    join(tmpdir(), "rd-compile-http-regression-"),
  );
  directories.push(directory);
  const app = await buildApp({
    databasePath: join(directory, "test.sqlite"),
    origins: ["http://localhost:5173"],
    secureCookies: false,
    logger: false,
    arduinoServiceUrl: "https://compiler.example",
    arduinoServiceToken: "test-only-service-token",
    teacherPassword: "test-only-teacher-password",
  });
  const origin = await app.listen({ host: "127.0.0.1", port: 0 });
  const cookies: string[] = [];
  for (let groupNumber = 1; groupNumber <= 10; groupNumber++) {
    const response = await app.inject({
      method: "POST",
      url: "/api/session",
      headers: { origin: "http://localhost:5173" },
      payload: { groupNumber, name: `HTTP test ${groupNumber}` },
    });
    expect(response.statusCode).toBe(200);
    cookies.push(String(response.headers["set-cookie"]).split(";")[0]);
  }
  return { app, origin, cookies };
}
function httpCompile(origin: string, cookie: string, code = CODE) {
  let client!: ReturnType<typeof request>;
  const response = new Promise<{ statusCode?: number; body: string }>(
    (resolve, reject) => {
      const payload = JSON.stringify({ code, board: "uno" });
      client = request(
        `${origin}/api/arduino/compile`,
        {
          method: "POST",
          headers: {
            origin: "http://localhost:5173",
            cookie,
            "content-type": "application/json",
            "content-length": Buffer.byteLength(payload),
          },
        },
        (incoming) => {
          let body = "";
          incoming.on("data", (chunk) => {
            body += chunk;
          });
          incoming.on("end", () =>
            resolve({ statusCode: incoming.statusCode, body }),
          );
          incoming.on("error", reject);
        },
      );
      client.on("error", reject);
      client.end(payload);
    },
  );
  return { client, response: response.catch((error: Error) => error) };
}

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("Arduino compiler request budgets", () => {
  it("forwards the original deadline to the isolated compiler instead of resetting it", async () => {
    const fetch = vi.fn(async (_url: string, _options: RequestInit) =>
      Response.json({ hex: HEX, output: "compiled" }),
    );
    vi.stubGlobal("fetch", fetch);
    const deadline = Date.now() + 1000;
    expect(await remote().compile(CODE, "uno", { deadline })).toEqual({
      hex: HEX,
      output: "compiled",
    });
    expect(fetch.mock.calls[0][1].headers).toMatchObject({
      [COMPILE_DEADLINE_HEADER]: String(deadline),
    });
  });

  it("reports a slow remote build as a compile timeout, then runs the next program", async () => {
    const slow = abortableFetch();
    const fetch = vi
      .fn()
      .mockImplementationOnce(slow)
      .mockResolvedValue(Response.json({ hex: HEX }));
    vi.stubGlobal("fetch", fetch);
    const compiler = remote();
    const first = compiler
      .compile(CODE, "uno", { deadline: Date.now() + 50 })
      .catch((error) => error);
    const second = compiler.compile(`${CODE}\n// next`, "uno");
    expect(await first).toMatchObject({ statusCode: 408 });
    expect(await second).toMatchObject({ hex: HEX });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it("applies the deadline through a stalled response body, not only response headers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url, options: RequestInit) => {
        const signal = options.signal!;
        return new Response(
          new ReadableStream({
            start(controller) {
              signal.addEventListener(
                "abort",
                () => controller.error(signal.reason),
                { once: true },
              );
            },
          }),
          { headers: { "content-type": "application/json" } },
        );
      }),
    );
    await expect(
      remote().compile(CODE, "uno", { deadline: Date.now() + 50 }),
    ).rejects.toMatchObject({ statusCode: 408 });
  });

  it("does not send a queued request after its inherited deadline has expired", async () => {
    let finish!: (value: Response) => void;
    const fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetch);
    const compiler = remote();
    const first = compiler.compile(CODE, "uno");
    const second = compiler
      .compile(`${CODE}\n// later`, "uno", { deadline: Date.now() + 30 })
      .catch((error) => error);
    await delay(45);
    finish(Response.json({ hex: HEX }));
    expect(await first).toMatchObject({ hex: HEX });
    expect(await second).toMatchObject({ statusCode: 408 });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("classifies an invalid remote response and retries it without poisoning the cache", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(new Response("<html>gateway</html>"))
      .mockResolvedValueOnce(Response.json(null))
      .mockResolvedValueOnce(
        Response.json({ hex: HEX, output: { unexpected: true } }),
      );
    vi.stubGlobal("fetch", fetch);
    const compiler = remote();
    await expect(compiler.compile(CODE, "uno")).rejects.toMatchObject({
      statusCode: 502,
    });
    await expect(compiler.compile(CODE, "uno")).rejects.toMatchObject({
      statusCode: 502,
    });
    expect(await compiler.compile(CODE, "uno")).toEqual({
      hex: HEX,
      output: "",
    });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it("closing one of ten teams keeps their single remote compilation running", async () => {
    let finish!: (value: Response) => void;
    let workerSignal!: AbortSignal;
    const fetch = vi.fn((_url, options: RequestInit) => {
      workerSignal = options.signal!;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    vi.stubGlobal("fetch", fetch);
    const compiler = remote();
    const controllers = Array.from({ length: 10 }, () => new AbortController());
    const groups = controllers.map((controller) =>
      compiler
        .compile(CODE, "uno", { signal: controller.signal })
        .catch((error) => error),
    );
    controllers[0].abort();
    expect(await groups[0]).toMatchObject({ statusCode: 499 });
    expect(workerSignal.aborted).toBe(false);
    finish(Response.json({ hex: HEX }));
    expect(await Promise.all(groups.slice(1))).toEqual(
      Array(9).fill({ hex: HEX, output: "" }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("one group's shorter deadline does not stop a shared build needed by another group", async () => {
    let finish!: (value: Response) => void;
    let workerSignal!: AbortSignal;
    const fetch = vi.fn((_url, options: RequestInit) => {
      workerSignal = options.signal!;
      return new Promise<Response>((resolve) => {
        finish = resolve;
      });
    });
    vi.stubGlobal("fetch", fetch);
    const compiler = remote();
    const first = compiler.compile(CODE, "uno");
    const second = compiler
      .compile(CODE, "uno", { deadline: Date.now() + 50 })
      .catch((error) => error);
    expect(await second).toMatchObject({ statusCode: 408 });
    expect(workerSignal.aborted).toBe(false);
    finish(Response.json({ hex: HEX }));
    expect(await first).toMatchObject({ hex: HEX });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("cancelling all remote consumers aborts the fetch and allows the next build", async () => {
    const fetch = vi
      .fn()
      .mockImplementationOnce(abortableFetch())
      .mockResolvedValue(Response.json({ hex: HEX }));
    vi.stubGlobal("fetch", fetch);
    const compiler = remote();
    const controller = new AbortController();
    const abandoned = compiler
      .compile(CODE, "uno", { signal: controller.signal })
      .catch((error) => error);
    const next = compiler.compile(`${CODE}\n// next`, "uno");
    controller.abort();
    expect(await abandoned).toMatchObject({ statusCode: 499 });
    expect(await next).toMatchObject({ hex: HEX });
  });

  it("terminates a local CLI on cancellation before the next sketch runs, and removes its scratch files", async () => {
    const { compiler, started } = await local();
    const controller = new AbortController();
    const abandoned = compiler
      .compile(`${CODE}\n// HANG`, "uno", { signal: controller.signal })
      .catch((error) => error);
    const process = await startedProcess(started);
    const next = compiler.compile(CODE, "nano-168");
    controller.abort();
    expect(await abandoned).toMatchObject({ statusCode: 499 });
    expect(await next).toMatchObject({
      hex: HEX,
      output: "arduino:avr:nano:cpu=atmega168\n",
    });
    expect(() => globalThis.process.kill(process.pid, 0)).toThrow();
    await expect(
      readFile(join(process.directory, "Raices", "Raices.ino")),
    ).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("terminates a timed-out local CLI and still completes a queued sketch", async () => {
    const { compiler, started } = await local();
    const expired = compiler
      .compile(`${CODE}\n// HANG`, "uno", { deadline: Date.now() + 300 })
      .catch((error) => error);
    const process = await startedProcess(started);
    const next = compiler.compile(CODE, "uno");
    expect(await expired).toMatchObject({ statusCode: 408 });
    expect(await next).toMatchObject({ hex: HEX });
    expect(() => globalThis.process.kill(process.pid, 0)).toThrow();
  });

  it("removes only the cancelled build's named Docker container before starting the next build", async () => {
    const directory = await mkdtemp(
      join(tmpdir(), "rd-docker-compile-regression-"),
    );
    directories.push(directory);
    const executable = join(directory, "docker");
    const started = join(directory, "started.json");
    const cleaned = join(directory, "cleaned.json");
    await writeFile(
      executable,
      `#!${process.execPath}\nimport { existsSync, writeFileSync } from "node:fs"; import { join } from "node:path";
      const args = process.argv.slice(2); const started = ${JSON.stringify(started)};
      if (args[0] === "rm") { writeFileSync(${JSON.stringify(cleaned)}, JSON.stringify(args)); }
      else if (!existsSync(started)) {
        writeFileSync(started, JSON.stringify({ pid: process.pid, name: args[args.indexOf("--name") + 1] }));
        setInterval(() => {}, 1000);
      } else {
        const directory = args[args.indexOf("-v") + 1].split(":")[0];
        writeFileSync(join(directory, "output", "Raices.ino.hex"), ${JSON.stringify(HEX)});
      }`,
    );
    await chmod(executable, 0o755);
    vi.stubEnv("PATH", `${directory}${delimiter}${process.env.PATH || ""}`);
    const compiler = new ArduinoCompiler(
      configuration({
        arduinoSandbox: true,
        arduinoServiceUrl: undefined,
        secureCookies: false,
        logger: false,
      }),
    );
    const controller = new AbortController();
    const abandoned = compiler
      .compile(CODE, "uno", { signal: controller.signal })
      .catch((error) => error);
    await startedProcess(started);
    const original = JSON.parse(await readFile(started, "utf8")) as {
      pid: number;
      name: string;
    };
    const next = compiler.compile(`${CODE}\n// next container`, "uno");
    controller.abort();
    expect(await abandoned).toMatchObject({ statusCode: 499 });
    expect(await next).toMatchObject({ hex: HEX });
    expect(JSON.parse(await readFile(cleaned, "utf8"))).toEqual([
      "rm",
      "--force",
      original.name,
    ]);
    expect(original.name).toMatch(/^raices-compile-[0-9a-f-]{36}$/);
    expect(() => process.kill(original.pid, 0)).toThrow();
  });

  it("serves ten real HTTP groups with one build even if one browser closes", async () => {
    let finish!: (value: Response) => void;
    let workerSignal!: AbortSignal;
    const fetch = vi.fn((_url, options: RequestInit) => {
      workerSignal = options.signal!;
      return new Promise<Response>((resolve, reject) => {
        finish = resolve;
        workerSignal.addEventListener(
          "abort",
          () => reject(workerSignal.reason),
          { once: true },
        );
      });
    });
    vi.stubGlobal("fetch", fetch);
    const { app, origin, cookies } = await workshop();
    const groups = cookies.map((cookie) => httpCompile(origin, cookie));
    try {
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      // Ensure all ten requests reached the shared build before closing one.
      await delay(50);
      groups[0].client.destroy();
      await delay(20);
      expect(workerSignal.aborted).toBe(false);
      finish(Response.json({ hex: HEX }));
      const results = await Promise.all(
        groups.slice(1).map((group) => group.response),
      );
      for (const result of results) {
        expect(result).toMatchObject({ statusCode: 200 });
        expect(JSON.parse((result as { body: string }).body)).toMatchObject({
          hex: HEX,
        });
      }
      expect(fetch).toHaveBeenCalledTimes(1);
    } finally {
      groups.forEach((group) => group.client.destroy());
      await app.close();
    }
  });

  it("a browser disconnect cancels its last HTTP consumer and frees the compiler for another team", async () => {
    let workerSignal!: AbortSignal;
    const fetch = vi
      .fn()
      .mockImplementationOnce((_url, options: RequestInit) => {
        workerSignal = options.signal!;
        return new Promise<Response>((_resolve, reject) =>
          workerSignal.addEventListener(
            "abort",
            () => reject(workerSignal.reason),
            { once: true },
          ),
        );
      })
      .mockResolvedValue(Response.json({ hex: HEX }));
    vi.stubGlobal("fetch", fetch);
    const { app, origin, cookies } = await workshop();
    const first = httpCompile(origin, cookies[0]);
    try {
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      first.client.destroy();
      await vi.waitFor(() => expect(workerSignal.aborted).toBe(true));
      const next = httpCompile(origin, cookies[1], `${CODE}\n// next team`);
      expect(await next.response).toMatchObject({ statusCode: 200 });
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      first.client.destroy();
      await app.close();
    }
  });
});
