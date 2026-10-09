import { test } from "vitest";
import assert from "node:assert/strict";
const { vercelConfiguration } = await import(new URL("../scripts/prepare-vercel.mjs", import.meta.url).href);
const { productionDefaults } = await import(new URL("../scripts/start-production.mjs", import.meta.url).href);
const { sandboxVercelConfiguration } = await import(new URL("../scripts/prepare-vercel.mjs", import.meta.url).href);
type Header = { key: string; value: string };

test("Vercel Sandbox gateway routes API before the SPA and gives streaming requests their runtime", () => {
  const config = sandboxVercelConfiguration();
  assert.deepEqual(config.rewrites[0], { source: "/api/:path*", destination: "/api/workshop?__raices_path=:path*" });
  assert.equal(config.rewrites[1].destination, "/index.html");
  assert.equal(config.functions["api/workshop.ts"].maxDuration, 300);
  const rule = config.headers.find((item: { source: string }) => item.source === "/api/:path*");
  assert.ok(rule.headers.every((item: Header) => item.value === "no-store"));
});

test("Vercel sends API requests to the configured HTTPS backend before the SPA", () => {
  const config = vercelConfiguration("https://api.raices.test/");
  assert.deepEqual(config.rewrites[0], {
    source: "/api/:path*",
    destination: "https://api.raices.test/api/:path*",
  });
  assert.equal(config.rewrites[1].destination, "/index.html");
  assert.equal(config.installCommand, "npm ci");
  assert.equal(config.framework, "vite");
});

test("managed-host startup derives exact HTTPS and private compiler defaults without replacing explicit config", () => {
  assert.deepEqual(productionDefaults({
    RENDER_EXTERNAL_URL: "https://taller-raices.onrender.com/",
    ARDUINO_SERVICE_HOST: "raices-compiler-private",
  }), {
    APP_ORIGIN: "https://taller-raices.onrender.com",
    ARDUINO_SERVICE_URL: "http://raices-compiler-private:3002",
  });
  assert.deepEqual(productionDefaults({
    APP_ORIGIN: "https://taller.raices.test,https://web.raices.test",
    RENDER_EXTERNAL_URL: "https://other.onrender.com",
    ARDUINO_SERVICE_URL: "http://compiler:3002",
    ARDUINO_SERVICE_HOST: "other-compiler",
  }), {});
  assert.deepEqual(productionDefaults({}), {});
});

test("managed-host startup rejects unsafe provider metadata instead of assembling arbitrary URLs", () => {
  for (const origin of ["http://taller.onrender.com", "https://user:secret@taller.onrender.com", "https://taller.onrender.com/api", "https://taller.onrender.com?token=secret"]) {
    assert.throws(() => productionDefaults({ RENDER_EXTERNAL_URL: origin }));
  }
  for (const host of ["compiler:3002", "compiler/path", "user@compiler", "compiler?secret", "compiler..invalid", "$(whoami)"]) {
    assert.throws(() => productionDefaults({ ARDUINO_SERVICE_HOST: host }));
  }
});

test("Vercel does not cache sessions/API and permits only same-origin browser connections", () => {
  const config = vercelConfiguration("https://api.raices.test");
  const apiHeaders = config.headers.find((rule: { source: string }) => rule.source === "/api/:path*").headers;
  assert.ok(apiHeaders.every((header: Header) => header.value === "no-store"));
  const csp = config.headers[0].headers.find((header: Header) => header.key === "Content-Security-Policy").value;
  assert.ok(csp.includes("connect-src 'self'"));
  assert.ok(csp.includes("frame-ancestors 'none'"));
  assert.equal(config.headers[0].headers.find((header: Header) => header.key === "Permissions-Policy").value.includes("serial=(self)"), true);
});

test("Vercel config rejects missing, insecure, credentialed, non-origin and fake backends", () => {
  for (const origin of [undefined, "", "http://api.raices.test", "https://user:secret@api.raices.test", "https://api.raices.test/api", "https://api.raices.test?token=secret", "https://api.raices.test#secret", "https://localhost", "https://127.0.0.1", "https://[::1]", "https://api.example.invalid", "https://another-frontend.vercel.app", "https://api.raices.test:3001"]) {
    assert.throws(() => vercelConfiguration(origin), String(origin));
  }
});
