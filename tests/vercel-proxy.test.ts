import assert from "node:assert/strict";
import { createServer, request, type Server } from "node:http";
import { once } from "node:events";
import { test, vi } from "vitest";

const { createWorkshopProxy } = await import(
  new URL("../scripts/vercel-proxy.mjs", import.meta.url).href
);

async function listen(server: Server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}`;
}

async function fixture(options: Record<string, unknown> = {}) {
  const { parsedBody, ...proxyOptions } = options;
  let resumed = false;
  const commands: unknown[] = [];
  const sandbox = {
    runCommand: async (command: unknown) => {
      commands.push(command);
      resumed = true;
      return { exitCode: 0 };
    },
    domain: (port: number) => {
      assert.equal(port, 3001);
      assert.equal(resumed, true, "domain is resolved after restart finishes");
      return "https://sbx-workshop.vercel.run";
    },
  };
  const get = vi.fn(
    async (args: {
      name: string;
      resume: boolean;
      onResume: (box: typeof sandbox) => Promise<void>;
    }) => {
      assert.equal(args.name, "raices-persistent");
      assert.equal(args.resume, true);
      await args.onResume(sandbox);
      return sandbox;
    },
  );
  const create = vi.fn(() => {
    throw new Error("Must never recreate student data");
  });
  const handler = createWorkshopProxy({
    env: { RAICES_SANDBOX_NAME: "raices-persistent" },
    loadSDK: async () => ({ Sandbox: { get, create, getOrCreate: create } }),
    fetchImpl: async () =>
      new Response('{"ok":true}', {
        headers: { "content-type": "application/json" },
      }),
    ...proxyOptions,
  });
  const server = createServer((req, res) => {
    if (parsedBody !== undefined) Object.assign(req, { body: parsedBody });
    void handler(req, res);
  });
  const origin = await listen(server);
  return {
    origin,
    commands,
    get,
    create,
    close: async () => {
      server.closeAllConnections();
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    },
  };
}

test("proxy resumes only the existing sandbox, restarts it, and preserves body, Origin, cookies and query", async () => {
  const body = JSON.stringify({ code: "ñ".repeat(60000), board: "uno" });
  let upstreamFailure: unknown;
  const f = await fixture({
    fetchImpl: async (url: string, init: RequestInit & { duplex: string }) => {
      try {
        assert.equal(
          url,
          "https://sbx-workshop.vercel.run/api/session?value=a%2Bb&value=two",
        );
        assert.equal(init.method, "POST");
        const headers = new Headers(init.headers);
        assert.equal(headers.get("origin"), "https://raices.vercel.app");
        assert.equal(
          headers.get("cookie"),
          "raices_session=group-a; teacher=group-b",
        );
        assert.equal(headers.get("content-type"), "application/json");
        assert.equal(headers.get("connection"), null);
        assert.equal(headers.get("x-private-hop"), null);
        assert.equal(headers.get("host"), null);
        assert.equal(init.duplex, "half");
        const received: Buffer[] = [];
        for await (const chunk of init.body as unknown as AsyncIterable<Buffer>)
          received.push(chunk);
        assert.equal(Buffer.concat(received).toString("utf8"), body);
        const responseHeaders = new Headers({
          "content-type": "application/json",
          connection: "x-response-hop",
          "x-response-hop": "remove-me",
        });
        responseHeaders.append(
          "set-cookie",
          "raices_session=new; Path=/; HttpOnly; Secure; SameSite=Lax",
        );
        responseHeaders.append(
          "set-cookie",
          "teacher=active; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/; HttpOnly",
        );
        return new Response('{"saved":true}', {
          status: 201,
          headers: responseHeaders,
        });
      } catch (error) {
        upstreamFailure = error;
        throw error;
      }
    },
  });
  try {
    const response = await new Promise<Response>((resolve, reject) => {
      const client = request(
        `${f.origin}/api/session?value=a%2Bb&value=two`,
        {
          method: "POST",
          headers: {
            Origin: "https://raices.vercel.app",
            Cookie: "raices_session=group-a; teacher=group-b",
            "Content-Type": "application/json",
            Connection: "x-private-hop",
            "x-private-hop": "remove-me",
          },
        },
        (incoming) => {
          const chunks: Buffer[] = [];
          incoming.on("data", (chunk) => chunks.push(chunk));
          incoming.on("error", reject);
          incoming.on("end", () => {
            const headers = new Headers();
            for (let index = 0; index < incoming.rawHeaders.length; index += 2)
              headers.append(
                incoming.rawHeaders[index],
                incoming.rawHeaders[index + 1],
              );
            resolve(
              new Response(Buffer.concat(chunks), {
                status: incoming.statusCode,
                headers,
              }),
            );
          });
        },
      );
      client.on("error", reject);
      client.end(body);
    });
    if (upstreamFailure) throw upstreamFailure;
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { saved: true });
    assert.equal(response.headers.getSetCookie().length, 2);
    assert.ok(response.headers.getSetCookie()[1].includes("Wed, 21 Oct 2026"));
    assert.equal(response.headers.get("x-response-hop"), null);
    for (const name of [
      "cache-control",
      "cdn-cache-control",
      "vercel-cdn-cache-control",
    ])
      assert.equal(response.headers.get(name), "no-store");
    assert.deepEqual(f.commands, [
      {
        cmd: "bash",
        args: ["/vercel/sandbox/workshop/restart.sh"],
        detached: false,
      },
    ]);
    assert.equal(f.create.mock.calls.length, 0);
  } finally {
    await f.close();
  }
});

test("rewritten API paths remove the private routing parameter while retaining user query values", async () => {
  const urls: string[] = [];
  const f = await fixture({
    fetchImpl: async (url: string) => {
      urls.push(url);
      return new Response("ok");
    },
  });
  try {
    const response = await fetch(
      `${f.origin}/api/workshop?__raices_path=teacher%2Fgroups&filter=a%2Bb&filter=two`,
    );
    assert.equal(response.status, 200);
    assert.deepEqual(urls, [
      "https://sbx-workshop.vercel.run/api/teacher/groups?filter=a%2Bb&filter=two",
    ]);
  } finally {
    await f.close();
  }
});

test("Vercel original URLs accept a matching rewrite parameter and strip it before forwarding", async () => {
  const urls: string[] = [];
  const f = await fixture({
    fetchImpl: async (url: string) => {
      urls.push(url);
      return new Response("ok");
    },
  });
  try {
    for (const path of [
      "/api/health?__raices_path=health",
      "/api/session/export?x=1&__raices_path=session%2Fexport",
      "/api/session?text=a%20b&__raices_path=session&text=a%2Bb",
    ])
      assert.equal((await fetch(`${f.origin}${path}`)).status, 200, path);
    assert.deepEqual(urls, [
      "https://sbx-workshop.vercel.run/api/health",
      "https://sbx-workshop.vercel.run/api/session/export?x=1",
      "https://sbx-workshop.vercel.run/api/session?text=a%20b&text=a%2Bb",
    ]);
  } finally {
    await f.close();
  }
});

test("Vercel-parsed bodies preserve code and missing Origin is never invented", async () => {
  const parsedBody = { code: "print('raíces')\n".repeat(60000), board: "pico" };
  const f = await fixture({
    parsedBody,
    fetchImpl: async (_url: string, init: RequestInit) => {
      assert.deepEqual(JSON.parse(init.body as string), parsedBody);
      assert.equal(new Headers(init.headers).get("origin"), null);
      assert.equal(new Headers(init.headers).get("content-length"), null);
      return new Response('{"saved":true}');
    },
  });
  try {
    const response = await fetch(`${f.origin}/api/session`, {
      method: "POST",
      body: "{}",
    });
    assert.deepEqual(await response.json(), { saved: true });
  } finally {
    await f.close();
  }
});

test("failed restart refuses backend access, while a missing sandbox name does not load the SDK", async () => {
  const backend = vi.fn();
  const loadSDK = vi.fn(async () => ({
    Sandbox: {
      get: async (args: { onResume: (box: unknown) => Promise<void> }) => {
        await args.onResume({ runCommand: async () => ({ exitCode: 7 }) });
        throw new Error("Restart failure should have aborted get");
      },
    },
  }));
  const failed = await fixture({ loadSDK, fetchImpl: backend });
  try {
    assert.equal((await fetch(`${failed.origin}/api/health`)).status, 503);
    assert.equal(backend.mock.calls.length, 0);
  } finally {
    await failed.close();
  }
  loadSDK.mockClear();
  const missing = await fixture({ env: {}, loadSDK });
  try {
    assert.equal((await fetch(`${missing.origin}/api/health`)).status, 503);
    assert.equal(loadSDK.mock.calls.length, 0);
  } finally {
    await missing.close();
  }
});

test("invalid, ambiguous and traversal paths are rejected before SDK or backend access", async () => {
  const f = await fixture();
  try {
    for (const path of [
      "/other",
      "/api",
      "/api//session",
      "/api/%2e%2e/session",
      "/api/%252e%252e/session",
      "/api/session%2fexport",
      "/api/%5csession",
      "/api/session?__raices_path=health",
      "/api/session?__raices_path=session&__raices_path=session",
      "/api/workshop",
      "/api/workshop?__raices_path=session&__raices_path=health",
      "/api/workshop?__raices_path=..%2Fsecret",
    ]) {
      const response = await new Promise<number>((resolve, reject) => {
        request(`${f.origin}${path}`, (result) => {
          result.resume();
          resolve(result.statusCode!);
        })
          .on("error", reject)
          .end();
      });
      assert.equal(response, 400, path);
    }
    assert.equal(f.get.mock.calls.length, 0);
  } finally {
    await f.close();
  }
});

test("missing/expired snapshots fail closed without creating an empty replacement or revealing secrets", async () => {
  const get = vi.fn(async () => {
    throw new Error("expired snapshot secret-token-value");
  });
  const create = vi.fn();
  const backend = vi.fn();
  const f = await fixture({
    loadSDK: async () => ({ Sandbox: { get, getOrCreate: create, create } }),
    fetchImpl: backend,
  });
  try {
    const response = await fetch(`${f.origin}/api/session`);
    assert.equal(response.status, 503);
    const text = await response.text();
    assert.ok(!text.includes("secret-token-value"));
    assert.deepEqual(Object.keys(JSON.parse(text)), ["error"]);
    assert.equal(create.mock.calls.length, 0);
    assert.equal(backend.mock.calls.length, 0);
  } finally {
    await f.close();
  }
});

test("sandbox domains must be bare HTTPS origins on vercel.run", async () => {
  for (const domain of [
    "http://sbx.vercel.run",
    "https://example.com",
    "https://vercel.run",
    "https://user:secret@sbx.vercel.run",
    "https://sbx.vercel.run/path",
    "https://sbx.vercel.run?secret=x",
    "https://sbx.vercel.run:3001",
  ]) {
    const backend = vi.fn();
    const f = await fixture({
      loadSDK: async () => ({
        Sandbox: { get: async () => ({ domain: () => domain }) },
      }),
      fetchImpl: backend,
    });
    try {
      assert.equal(
        (await fetch(`${f.origin}/api/session`)).status,
        503,
        domain,
      );
      assert.equal(backend.mock.calls.length, 0);
    } finally {
      await f.close();
    }
  }
});

test("SSE reaches the client before upstream closes, then disconnect aborts and cancels upstream", async () => {
  let signal: AbortSignal | undefined;
  let canceled = false;
  const f = await fixture({
    fetchImpl: async (_url: string, init: RequestInit) => {
      signal = init.signal!;
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(
              new TextEncoder().encode('event: reading\ndata: {"soil":55}\n\n'),
            );
          },
          cancel() {
            canceled = true;
          },
        }),
        { headers: { "content-type": "text/event-stream; charset=utf-8" } },
      );
    },
  });
  try {
    const client = request(`${f.origin}/api/events`);
    client.end();
    const [response] = await once(client, "response");
    assert.equal(response.headers["x-accel-buffering"], "no");
    const [chunk] = await once(response, "data");
    assert.match(chunk.toString(), /event: reading/);
    response.destroy();
    await vi.waitFor(() => {
      assert.equal(signal?.aborted, true);
      assert.equal(canceled, true);
    });
  } finally {
    await f.close();
  }
});

test("stream backpressure bounds producer work while a client stops reading", async () => {
  let chunks = 0;
  let canceled = false;
  const f = await fixture({
    fetchImpl: async () =>
      new Response(
        new ReadableStream({
          pull(controller) {
            chunks++;
            controller.enqueue(new Uint8Array(65536));
          },
          cancel() {
            canceled = true;
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      ),
  });
  try {
    const client = request(`${f.origin}/api/events`);
    client.end();
    const [response] = await once(client, "response");
    response.pause();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.ok(
      chunks > 0 && chunks < 128,
      `producer ran ${chunks} chunks without backpressure`,
    );
    response.destroy();
    await vi.waitFor(() => assert.equal(canceled, true));
  } finally {
    await f.close();
  }
});

test("SSE lifetime closes and cancels streams while ordinary JSON responses keep their complete body", async () => {
  let canceled = false;
  const f = await fixture({
    sseLifetimeMs: 80,
    fetchImpl: async (url: string) =>
      url.endsWith("/events")
        ? new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("data: ready\n\n"));
              },
              cancel() {
                canceled = true;
              },
            }),
            { headers: { "content-type": "text/event-stream" } },
          )
        : new Response(
            new ReadableStream({
              start(controller) {
                setTimeout(() => {
                  controller.enqueue(
                    new TextEncoder().encode('{"complete":true}'),
                  );
                  controller.close();
                }, 120);
              },
            }),
            { headers: { "content-type": "application/json" } },
          ),
  });
  try {
    assert.equal(
      await (await fetch(`${f.origin}/api/events`)).text(),
      "data: ready\n\n",
    );
    await vi.waitFor(() => assert.equal(canceled, true));
    assert.deepEqual(await (await fetch(`${f.origin}/api/session`)).json(), {
      complete: true,
    });
  } finally {
    await f.close();
  }
});

test("compiler resumes before the workshop and its HTTPS domain reaches the main restart script", async () => {
  const calls: string[] = [];
  const compiler = {
    runCommand: async (command: unknown) => {
      assert.deepEqual(command, {
        cmd: "bash",
        args: ["/vercel/sandbox/compiler/restart.sh"],
        detached: false,
      });
      calls.push("compiler:restart");
      return { exitCode: 0 };
    },
    domain: (port: number) => {
      assert.equal(port, 3002);
      calls.push("compiler:domain");
      return "https://compiler-a.vercel.run";
    },
  };
  const main = {
    runCommand: async (command: unknown) => {
      assert.deepEqual(command, {
        cmd: "bash",
        args: [
          "/vercel/sandbox/workshop/restart.sh",
          "https://compiler-a.vercel.run",
        ],
        detached: false,
      });
      calls.push("main:restart");
      return { exitCode: 0 };
    },
    domain: (port: number) => {
      assert.equal(port, 3001);
      calls.push("main:domain");
      return "https://workshop-a.vercel.run";
    },
  };
  const get = vi.fn(
    async (args: {
      name: string;
      resume: boolean;
      signal?: AbortSignal;
      onResume: (box: unknown) => Promise<void>;
    }) => {
      assert.equal(args.resume, true);
      assert.equal(
        args.signal,
        undefined,
        "shared restoration must not inherit a client abort signal",
      );
      const box = args.name === "compiler" ? compiler : main;
      calls.push(args.name === "compiler" ? "compiler:get" : "main:get");
      await args.onResume(box);
      return box;
    },
  );
  const f = await fixture({
    env: {
      RAICES_SANDBOX_NAME: "workshop",
      RAICES_COMPILER_SANDBOX_NAME: "compiler",
    },
    loadSDK: async () => ({ Sandbox: { get } }),
  });
  try {
    assert.equal((await fetch(`${f.origin}/api/health`)).status, 200);
    assert.equal((await fetch(`${f.origin}/api/session`)).status, 200);
    assert.deepEqual(calls, [
      "compiler:get",
      "compiler:restart",
      "compiler:domain",
      "main:get",
      "main:restart",
      "main:domain",
    ]);
    assert.equal(
      get.mock.calls.length,
      2,
      "sequential requests reuse the 30-second routing cache",
    );
  } finally {
    await f.close();
  }
});

test("running sandboxes restart main once initially and again only when the compiler origin changes", async () => {
  let compilerOrigin = "https://compiler-a.vercel.run";
  const restart = vi.fn(async () => ({ exitCode: 0 }));
  const get = vi.fn(async (args: { name: string }) =>
    args.name === "compiler"
      ? { domain: (): string => compilerOrigin }
      : { domain: () => "https://workshop-a.vercel.run", runCommand: restart },
  );
  const f = await fixture({
    env: {
      RAICES_SANDBOX_NAME: "workshop",
      RAICES_COMPILER_SANDBOX_NAME: "compiler",
    },
    loadSDK: async () => ({ Sandbox: { get } }),
    cacheTtlMs: 15,
  });
  try {
    assert.equal((await fetch(`${f.origin}/api/health`)).status, 200);
    assert.equal((await fetch(`${f.origin}/api/session`)).status, 200);
    assert.equal(restart.mock.calls.length, 1);
    compilerOrigin = "https://compiler-b.vercel.run";
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal((await fetch(`${f.origin}/api/health`)).status, 200);
    assert.equal(restart.mock.calls.length, 2);
    assert.deepEqual(restart.mock.calls[1], [
      {
        cmd: "bash",
        args: [
          "/vercel/sandbox/workshop/restart.sh",
          "https://compiler-b.vercel.run",
        ],
        detached: false,
      },
    ]);
    await new Promise((resolve) => setTimeout(resolve, 25));
    assert.equal((await fetch(`${f.origin}/api/session`)).status, 200);
    assert.equal(
      restart.mock.calls.length,
      2,
      "unchanged compiler domain does not restart a running main process",
    );
  } finally {
    await f.close();
  }
});

test("simultaneous clients share restoration and one disconnect cannot cancel another client's setup", async () => {
  let release!: () => void;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const get = vi.fn(async (args: { name: string; signal?: AbortSignal }) => {
    assert.equal(args.signal, undefined);
    if (args.name === "compiler") {
      await ready;
      return { domain: (): string => "https://compiler-a.vercel.run" };
    }
    return {
      domain: (): string => "https://workshop-a.vercel.run",
      runCommand: async () => ({ exitCode: 0 }),
    };
  });
  const f = await fixture({
    env: {
      RAICES_SANDBOX_NAME: "workshop",
      RAICES_COMPILER_SANDBOX_NAME: "compiler",
    },
    loadSDK: async () => ({ Sandbox: { get } }),
  });
  try {
    const abandoned = request(`${f.origin}/api/health`);
    abandoned.on("error", () => {});
    abandoned.end();
    await vi.waitFor(() => assert.equal(get.mock.calls.length, 1));
    const active = fetch(`${f.origin}/api/session`);
    await new Promise((resolve) => setTimeout(resolve, 25));
    abandoned.destroy();
    release();
    assert.equal((await active).status, 200);
    assert.equal(
      get.mock.calls.length,
      2,
      "one compiler lookup plus one main lookup serves both requests",
    );
  } finally {
    release();
    await f.close();
  }
});

test("SANDBOX_NOT_LISTENING invalidates routing and restarts on the next request without replaying a POST", async () => {
  for (const location of ["header", "body"]) {
    const restart = vi.fn(async () => ({ exitCode: 0 }));
    const create = vi.fn();
    const get = vi.fn(async () => ({
      domain: () => "https://workshop-a.vercel.run",
      runCommand: restart,
    }));
    const backend = vi.fn(async () =>
      backend.mock.calls.length === 1
        ? new Response(
            location === "body" ? "SANDBOX_NOT_LISTENING" : "unavailable",
            {
              status: 502,
              headers:
                location === "header"
                  ? { "x-vercel-error": "SANDBOX_NOT_LISTENING" }
                  : {},
            },
          )
        : new Response("ready"),
    );
    const f = await fixture({
      loadSDK: async () => ({ Sandbox: { get, create, getOrCreate: create } }),
      fetchImpl: backend,
    });
    try {
      const first = await fetch(`${f.origin}/api/session`, {
        method: "POST",
        body: "{}",
      });
      assert.equal(first.status, 502);
      await first.text();
      assert.equal(
        backend.mock.calls.length,
        1,
        "mutating request must not automatically replay",
      );
      assert.equal((await fetch(`${f.origin}/api/health`)).status, 200);
      assert.equal(get.mock.calls.length, 2);
      assert.deepEqual(restart.mock.calls, [
        [
          {
            cmd: "bash",
            args: ["/vercel/sandbox/workshop/restart.sh"],
            detached: false,
          },
        ],
      ]);
      assert.equal(create.mock.calls.length, 0);
    } finally {
      await f.close();
    }
  }
});

test("an unavailable compiler snapshot does not resume main or recreate either student's VM", async () => {
  const create = vi.fn();
  const get = vi.fn(async (args: { name: string }) => {
    assert.equal(args.name, "compiler");
    throw new Error("snapshot unavailable confidential-detail");
  });
  const backend = vi.fn();
  const f = await fixture({
    env: {
      RAICES_SANDBOX_NAME: "workshop",
      RAICES_COMPILER_SANDBOX_NAME: "compiler",
    },
    loadSDK: async () => ({ Sandbox: { get, create, getOrCreate: create } }),
    fetchImpl: backend,
  });
  try {
    const response = await fetch(`${f.origin}/api/health`);
    assert.equal(response.status, 503);
    assert.ok(!(await response.text()).includes("confidential-detail"));
    assert.equal(get.mock.calls.length, 1);
    assert.equal(create.mock.calls.length, 0);
    assert.equal(backend.mock.calls.length, 0);
  } finally {
    await f.close();
  }
});
