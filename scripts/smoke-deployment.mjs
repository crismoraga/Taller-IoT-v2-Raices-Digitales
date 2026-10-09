import assert from "node:assert/strict";

// Read-only by default. --exercise-session creates and deletes only its own
// temporary session; it never sends simulated readings or accesses other groups.
const args = process.argv.slice(2);
let cookie;
let origin;
async function request(path, options = {}) {
  const response = await fetch(`${origin}${path}`, {
    ...options,
    headers: {
      ...(cookie ? { cookie } : {}),
      ...(options.method ? { origin } : {}),
      ...(options.body !== undefined ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
    signal: options.signal || AbortSignal.timeout(20000),
  });
  return response;
}
async function json(path, options = {}) {
  const response = await request(path, options);
  assert.match(response.headers.get("content-type") || "", /application\/json/, `${path} devolvió HTML u otro formato en lugar de la API.`);
  const data = await response.json();
  assert.equal(response.ok, true, `${path} falló con HTTP ${response.status}.`);
  return { response, data };
}

try {
  const url = new URL(args[0]);
  assert.ok(!url.username && !url.password && !url.search && !url.hash && url.pathname === "/", "Indica sólo el origen del sitio, sin ruta ni credenciales.");
  assert.ok(url.protocol === "https:" || (args.includes("--allow-http") && url.protocol === "http:"), "La publicación requiere HTTPS. --allow-http es sólo para verificación local.");
  origin = url.origin;
  const home = await request("/");
  assert.equal(home.ok, true, "La portada no responde.");
  assert.match(await home.text(), /<title>[^<]*Raíces Digitales[^<]*Taller IoT/, "El dominio no corresponde a este taller.");
  const lesson = await request("/taller/welcome");
  assert.equal(lesson.ok, true, "La navegación directa a una lección falla.");
  assert.match(await lesson.text(), /<div id="root">/, "Falta el fallback SPA de las lecciones.");
  const { response: healthResponse, data: health } = await json("/api/health");
  assert.equal(health.ok, true, "La API no está lista.");
  assert.match(healthResponse.headers.get("cache-control") || "", /no-store/, "La CDN podría almacenar la API.");
  if (args.includes("--require-arduino")) assert.equal(health.arduinoAvailable, true, "El compilador Arduino no está disponible.");
  console.log(`Portada, navegación y API verificadas. Compilador Arduino: ${health.arduinoAvailable ? "disponible" : "no disponible"}.`);

  if (args.includes("--exercise-session")) {
    const created = await json("/api/session", {
      method: "POST",
      body: JSON.stringify({ name: "Verificación de publicación", groupNumber: 10 }),
    });
    const setCookie = created.response.headers.get("set-cookie") || "";
    cookie = setCookie.split(";")[0];
    assert.match(cookie, /^rd_session=/, "El proxy no entregó la cookie de sesión.");
    assert.match(setCookie, /HttpOnly/i);
    assert.match(setCookie, /SameSite=Strict/i);
    if (url.protocol === "https:") assert.match(setCookie, /;\s*Secure/i);
    const restored = await json("/api/session");
    assert.equal(restored.data.session.id, created.data.session.id, "No se recupera la misma sesión al enviar la cookie.");
    const isolated = await request("/api/session", { headers: { cookie: "" } });
    assert.equal(isolated.status, 401, "Una solicitud sin cookie accedió a la sesión.");
    const rejectedOrigin = await request("/api/session", {
      method: "PATCH",
      headers: { origin: "https://origin-no-autorizado.invalid" },
      body: JSON.stringify({ name: "No debe guardarse" }),
    });
    assert.equal(rejectedOrigin.status, 403, "No se rechazó un origen no autorizado.");
    await json("/api/dashboard");
    const controller = new AbortController();
    const streamDeadline = setTimeout(() => controller.abort(), 20000);
    try {
      const events = await request("/api/events", { signal: controller.signal });
      assert.equal(events.status, 200);
      assert.match(events.headers.get("content-type") || "", /text\/event-stream/);
      const reader = events.body.getReader();
      let firstEvent = "";
      while (!firstEvent.includes("\n\n")) {
        const chunk = await reader.read();
        assert.equal(chunk.done, false, "El proxy cerró SSE antes del primer evento.");
        firstEvent += new TextDecoder().decode(chunk.value);
      }
      assert.match(firstEvent, /event: update/);
      await reader.cancel();
    } finally {
      clearTimeout(streamDeadline);
      controller.abort();
    }
    await json("/api/session/export");
    console.log("Sesión/cookie, aislamiento, CSRF, dashboard, SSE y exportación verificados.");
  }
} catch (error) {
  console.error(`Verificación fallida: ${error.message}`);
  process.exitCode = 1;
} finally {
  if (cookie && origin) {
    try {
      await json("/api/session", { method: "DELETE" });
      console.log("Sesión temporal de verificación eliminada.");
    } catch {
      console.error("No se pudo eliminar la sesión temporal; elimínala desde la misma cookie o deja que expire.");
      process.exitCode = 1;
    }
  }
}
