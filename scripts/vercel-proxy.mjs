import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

const HOP_HEADERS = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
  "content-length",
]);
const PATH_PARAMETER = "__raices_path";

function apiTarget(rawUrl) {
  if (
    typeof rawUrl !== "string" ||
    !rawUrl.startsWith("/") ||
    /[\\\s#\u0000-\u001f\u007f]/.test(rawUrl)
  )
    throw new Error("Invalid API path");
  const question = rawUrl.indexOf("?");
  let path = question < 0 ? rawUrl : rawUrl.slice(0, question);
  const rawQuery = question < 0 ? "" : rawUrl.slice(question + 1);
  const query = new URLSearchParams(rawQuery);
  if (path === "/api/workshop") {
    const paths = query.getAll(PATH_PARAMETER);
    if (paths.length !== 1 || !paths[0]) throw new Error("Missing API path");
    path = `/api/${paths[0]}`;
    query.delete(PATH_PARAMETER);
  } else if (query.has(PATH_PARAMETER)) {
    // The router's private parameter must never be accepted as user input.
    throw new Error("Ambiguous API path");
  }
  if (!path.startsWith("/api/")) throw new Error("Invalid API path");
  // Decode once to detect traversal/separators, but retain the original query bytes.
  let decoded;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    throw new Error("Invalid API path");
  }
  if (
    !/^\/api\/[A-Za-z0-9_-]+(?:\/[A-Za-z0-9_-]+)*\/?$/.test(decoded) ||
    /%(?:2f|5c|25)/i.test(path)
  )
    throw new Error("Invalid API path");
  const search = rawUrl.startsWith("/api/workshop?")
    ? query.toString()
    : rawQuery;
  return `${decoded}${search ? `?${search}` : ""}`;
}

function sandboxOrigin(domain) {
  const url = new URL(domain);
  if (
    url.protocol !== "https:" ||
    !url.hostname.endsWith(".vercel.run") ||
    url.username ||
    url.password ||
    url.port ||
    url.pathname !== "/" ||
    url.search ||
    url.hash
  )
    throw new Error("Invalid sandbox domain");
  return url.origin;
}

function forwardHeaders(source, response = false) {
  const connection =
    source instanceof Headers ? source.get("connection") : source.connection;
  const blocked = new Set([
    ...HOP_HEADERS,
    ...String(connection || "")
      .toLowerCase()
      .split(",")
      .map((value) => value.trim()),
  ]);
  if (response) {
    blocked.add("content-encoding");
    blocked.add("set-cookie");
  }
  const result = new Headers();
  const entries =
    source instanceof Headers ? source.entries() : Object.entries(source);
  for (const [name, value] of entries) {
    if (blocked.has(name.toLowerCase()) || value === undefined) continue;
    if (Array.isArray(value))
      for (const item of value) result.append(name, item);
    else result.set(name, String(value));
  }
  return result;
}

function requestBody(req) {
  if (req.method === "GET" || req.method === "HEAD") return undefined;
  if (req.body !== undefined) {
    if (typeof req.body === "string" || req.body instanceof Uint8Array)
      return req.body;
    return JSON.stringify(req.body);
  }
  return req;
}

function jsonError(res, status, message) {
  if (res.destroyed || res.writableEnded) return;
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("CDN-Cache-Control", "no-store");
  res.setHeader("Vercel-CDN-Cache-Control", "no-store");
  res.end(JSON.stringify({ error: message }));
}

/** A thin streaming gateway; student data and credentials stay in the existing sandbox. */
export function createWorkshopProxy({
  env = process.env,
  loadSDK = () => import("@vercel/sandbox"),
  fetchImpl = globalThis.fetch,
  sseLifetimeMs = 280_000,
} = {}) {
  return async function workshopProxy(req, res) {
    const started = Date.now();
    let target;
    try {
      target = apiTarget(req.url);
    } catch {
      jsonError(res, 400, "Ruta de API no válida.");
      return;
    }
    const name = env.RAICES_SANDBOX_NAME;
    if (typeof name !== "string" || !name.trim()) {
      jsonError(
        res,
        503,
        "El servicio del taller no está disponible. Inténtalo nuevamente.",
      );
      return;
    }
    const controller = new AbortController();
    let timer;
    const disconnect = () => {
      if (!res.writableEnded) controller.abort();
    };
    req.once("aborted", disconnect);
    res.once("close", disconnect);
    try {
      const { Sandbox } = await loadSDK();
      const sandbox = await Sandbox.get({
        name,
        resume: true,
        signal: controller.signal,
        onResume: async (existing) => {
          const command = await existing.runCommand({
            cmd: "bash",
            args: ["/vercel/sandbox/workshop/restart.sh"],
            detached: false,
          });
          if (command.exitCode !== 0) throw new Error("Backend restart failed");
        },
      });
      if (controller.signal.aborted) return;
      const origin = sandboxOrigin(await sandbox.domain(3001));
      const body = requestBody(req);
      const upstream = await fetchImpl(`${origin}${target}`, {
        method: req.method,
        headers: forwardHeaders(req.headers),
        body,
        ...(body === req ? { duplex: "half" } : {}),
        signal: controller.signal,
        redirect: "manual",
      });
      if (controller.signal.aborted) {
        await upstream.body?.cancel();
        return;
      }
      res.statusCode = upstream.status;
      forwardHeaders(upstream.headers, true).forEach((value, key) =>
        res.setHeader(key, value),
      );
      const cookies = upstream.headers.getSetCookie();
      if (cookies.length) res.setHeader("Set-Cookie", cookies);
      for (const header of [
        "Cache-Control",
        "CDN-Cache-Control",
        "Vercel-CDN-Cache-Control",
      ])
        res.setHeader(header, "no-store");
      const sse = /^text\/event-stream(?:;|$)/i.test(
        upstream.headers.get("content-type") || "",
      );
      if (sse) {
        res.setHeader("X-Accel-Buffering", "no");
        res.flushHeaders();
        timer = setTimeout(
          () => {
            res.end();
            controller.abort();
          },
          Math.max(1, sseLifetimeMs - (Date.now() - started)),
        );
        timer.unref?.();
      }
      if (!upstream.body || req.method === "HEAD") {
        await upstream.body?.cancel();
        res.end();
      } else {
        await pipeline(Readable.fromWeb(upstream.body), res, {
          signal: controller.signal,
        });
      }
    } catch {
      if (!controller.signal.aborted)
        jsonError(
          res,
          503,
          "El servicio del taller no está disponible. Inténtalo nuevamente.",
        );
    } finally {
      clearTimeout(timer);
      req.off("aborted", disconnect);
      res.off("close", disconnect);
      controller.abort();
    }
  };
}

export const workshopProxy = createWorkshopProxy();
