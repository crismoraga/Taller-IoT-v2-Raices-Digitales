import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Provider metadata fills defaults only. Explicit deployment configuration wins.
export function productionDefaults(environment) {
  const additions = {};
  if (!environment.APP_ORIGIN && environment.RENDER_EXTERNAL_URL) {
    const url = new URL(environment.RENDER_EXTERNAL_URL);
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) {
      throw new Error("RENDER_EXTERNAL_URL debe ser un origen HTTPS público sin ruta ni credenciales.");
    }
    additions.APP_ORIGIN = url.origin;
  }
  if (!environment.ARDUINO_SERVICE_URL && environment.ARDUINO_SERVICE_HOST) {
    const host = environment.ARDUINO_SERVICE_HOST;
    if (!/^[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(host) || host.length > 253 || host.includes("..")) {
      throw new Error("ARDUINO_SERVICE_HOST debe contener únicamente el hostname privado del compilador.");
    }
    additions.ARDUINO_SERVICE_URL = `http://${host}:3002`;
  }
  return additions;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await import("dotenv/config");
  Object.assign(process.env, productionDefaults(process.env));
  await import("../server/index.ts");
}
