import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

// Generate before `vercel deploy`: Vercel rewrites are deployment configuration,
// not runtime environment variables. Never invent a backend or publish a demo.
export function vercelConfiguration(backendOrigin) {
  let url;
  try {
    url = new URL(backendOrigin);
  } catch {
    throw new Error("Indica el origen HTTPS real del backend persistente.");
  }
  if (
    url.protocol !== "https:" ||
    url.username || url.password || url.search || url.hash ||
    url.pathname !== "/" || url.port ||
    url.hostname === "localhost" || url.hostname.endsWith(".localhost") ||
    url.hostname.endsWith(".invalid") || url.hostname.endsWith(".example") ||
    url.hostname.startsWith("127.") || url.hostname === "[::1]" ||
    url.hostname.endsWith(".vercel.app")
  ) {
    throw new Error("Usa un origen HTTPS público propio, sin ruta, credenciales ni parámetros, que ejecute la API persistente; no otro frontend Vercel.");
  }
  return {
    ...frontendConfiguration(),
    rewrites: [
      { source: "/api/:path*", destination: `${url.origin}/api/:path*` },
      { source: "/:path*", destination: "/index.html" },
    ],
  };
}

function frontendConfiguration() {
  const security = [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "same-origin" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "serial=(self), camera=(), microphone=(), geolocation=()" },
    { key: "Strict-Transport-Security", value: "max-age=31536000" },
    { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests" },
  ];
  return {
    $schema: "https://openapi.vercel.sh/vercel.json",
    framework: "vite",
    buildCommand: "npm run build",
    outputDirectory: "dist",
    installCommand: "npm ci",
    headers: [
      { source: "/:path*", headers: security },
      { source: "/api/:path*", headers: [
        { key: "Cache-Control", value: "no-store" },
        { key: "CDN-Cache-Control", value: "no-store" },
        { key: "Vercel-CDN-Cache-Control", value: "no-store" },
      ] },
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache" }] },
      { source: "/assets/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }] },
    ],
  };
}

export function sandboxVercelConfiguration() {
  return {
    ...frontendConfiguration(),
    functions: { "api/workshop.ts": { maxDuration: 300 } },
    rewrites: [
      { source: "/api/:path*", destination: "/api/workshop?__raices_path=:path*" },
      { source: "/:path*", destination: "/index.html" },
    ],
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const config = process.argv[2] === "--sandbox"
      ? sandboxVercelConfiguration()
      : vercelConfiguration(process.argv[2] || process.env.VERCEL_BACKEND_ORIGIN);
    await mkdir(".vercel", { recursive: true });
    await writeFile(".vercel/workshop.json", `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    console.log("Configuración creada en .vercel/workshop.json. Revisa el backend y añade el dominio Vercel exacto a APP_ORIGIN antes de publicar.");
    console.log("Despliega con: vercel --local-config .vercel/workshop.json --prod");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
