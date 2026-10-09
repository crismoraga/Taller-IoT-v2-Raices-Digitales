import { beforeEach, afterEach, describe, it, expect } from "vitest";
import { mkdtemp, mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, resolve, sep, basename } from "node:path";
import { tmpdir } from "node:os";
import { X509Certificate } from "node:crypto";
import { buildApp } from "../server/app.ts";
import { hash } from "../server/database.ts";

const origin = "http://localhost:5173";
const reading = (value: number | null, status = "READING") => ({
  sensor: "soil",
  value,
  unit: "%",
  status,
});
let app: Awaited<ReturnType<typeof buildApp>>;
let directory: string;
let now: number;
const headers = (cookie?: string) => ({
  origin,
  ...(cookie ? { cookie } : {}),
});
async function session(groupNumber = 1) {
  const response = await app.inject({
    method: "POST",
    url: "/api/session",
    headers: headers(),
    payload: { groupNumber, name: `Equipo ${groupNumber}` },
  });
  expect(response.statusCode).toBe(200);
  return {
    cookie: String(response.headers["set-cookie"]).split(";")[0],
    session: response.json().session,
  };
}
async function pair(cookie: string) {
  const generated = await app.inject({
    method: "POST",
    url: "/api/pair",
    headers: headers(cookie),
    payload: {},
  });
  const paired = await app.inject({
    method: "POST",
    url: "/api/device/pair",
    payload: { code: generated.json().code },
  });
  expect(paired.statusCode).toBe(200);
  return { ...paired.json(), code: generated.json().code };
}
async function ingest(
  secret: string,
  value: number | null,
  status = "READING",
  source = "hardware",
) {
  return app.inject({
    method: "POST",
    url: "/api/device/ingest",
    headers: { authorization: `Bearer ${secret}` },
    payload: { source, readings: [reading(value, status)] },
  });
}
async function dashboard(cookie: string) {
  const response = await app.inject({
    url: "/api/dashboard?range=all",
    headers: headers(cookie),
  });
  expect(response.statusCode).toBe(200);
  return response.json();
}
async function addRule(cookie: string) {
  const response = await app.inject({
    method: "POST",
    url: "/api/rules",
    headers: headers(cookie),
    payload: { sensor: "soil", min: 20, max: 80, hysteresis: 5, cooldown: 10 },
  });
  expect(response.statusCode).toBe(200);
  return response.json().rule;
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "rd-backend-test-"));
  now = Date.parse("2026-10-07T15:00:00Z");
  app = await buildApp({
    databasePath: join(directory, "test.sqlite"),
    origins: [origin],
    secureCookies: false,
    teacherPassword: "test-only-password-123",
    encryptionKey: Buffer.alloc(32, 7).toString("base64"),
    now: () => now,
    logger: false,
  });
});
afterEach(async () => {
  await app.close();
  if (
    resolve(directory).startsWith(resolve(tmpdir()) + sep) &&
    basename(directory).startsWith("rd-backend-test-")
  )
    await rm(directory, { recursive: true, force: true });
});

describe("API real: aislamiento, persistencia y seguridad", () => {
  it("combina escrituras desde un snapshot obsoleto y PATCH simultáneos sin perder claves", async () => {
    const a = await session(1),
      b = await session(2);
    const stale = app.store.byId(a.session.id)!;
    app.store.patchSession(stale, {
      drafts: { "led.python": "print('A')" },
      calibrations: { soil: { dry: 52000, wet: 24000 } },
      sensorEnabled: { soil: true },
    });
    app.store.patchSession(stale, {
      drafts: { "blink.python": "print('B')" },
      calibrations: { water_level: { dry: 500, wet: 22000 } },
      sensorEnabled: { water_level: true },
    });
    const afterStale = app.store.byId(a.session.id)!;
    expect(afterStale.drafts).toEqual({
      "led.python": "print('A')",
      "blink.python": "print('B')",
    });
    expect(afterStale.calibrations).toEqual({
      soil: { dry: 52000, wet: 24000 },
      water_level: { dry: 500, wet: 22000 },
    });
    expect(afterStale.sensorEnabled).toEqual({ soil: true, water_level: true });

    const patches = [
      {
        drafts: { "soil.python": "print('suelo')" },
        sensorEnabled: { light: true },
      },
      {
        drafts: { "water.python": "print('agua')" },
        calibrations: { light: { dry: 64000, wet: 12000 } },
      },
      {
        lastRun: {
          lessonId: "led",
          board: "pico",
          code: "print('última ejecución')",
          at: "2026-10-08T13:00:00Z",
        },
      },
    ];
    const results = await Promise.all(
      patches.map((payload) =>
        app.inject({
          method: "PATCH",
          url: "/api/session",
          headers: headers(a.cookie),
          payload,
        }),
      ),
    );
    expect(results.map((result) => result.statusCode)).toEqual([200, 200, 200]);
    const final = (
      await app.inject({ url: "/api/session", headers: headers(a.cookie) })
    ).json().session;
    expect(final.drafts).toEqual({
      "led.python": "print('A')",
      "blink.python": "print('B')",
      "soil.python": "print('suelo')",
      "water.python": "print('agua')",
    });
    expect(final.calibrations).toEqual({
      soil: { dry: 52000, wet: 24000 },
      water_level: { dry: 500, wet: 22000 },
      light: { dry: 64000, wet: 12000 },
    });
    expect(final.sensorEnabled).toEqual({
      soil: true,
      water_level: true,
      light: true,
    });
    expect(final.lastRun.code).toBe("print('última ejecución')");
    expect(app.store.byId(b.session.id)?.drafts).toEqual({});
  });

  it("mantiene un puente USB por grupo, valida sus lotes y respeta revocación y CSRF", async () => {
    const a = await session(1),
      b = await session(2);
    const connect = () =>
      app.inject({
        method: "POST",
        url: "/api/bridge/connect",
        headers: headers(a.cookie),
        payload: {},
      });
    const first = await connect();
    expect(first.statusCode).toBe(200);
    const second = await connect();
    expect(second.json().deviceId).toBe(first.json().deviceId);
    const send = (
      h: Record<string, string>,
      payload: Record<string, unknown> = { readings: [reading(45)] },
    ) =>
      app.inject({
        method: "POST",
        url: "/api/bridge/ingest",
        headers: h,
        payload,
      });
    expect((await send(headers(a.cookie))).statusCode).toBe(200);
    expect((await dashboard(a.cookie)).latest[0].source).toBe("hardware");
    expect((await dashboard(b.cookie)).latest).toHaveLength(0);
    expect((await send({ origin })).statusCode).toBe(401);
    expect(
      (await send({ cookie: a.cookie, origin: "https://evil.invalid" }))
        .statusCode,
    ).toBe(403);
    expect(
      (
        await send(headers(a.cookie), {
          readings: [reading(3)],
          sessionId: b.session.id,
        })
      ).statusCode,
    ).toBe(400);
    await app.inject({
      method: "POST",
      url: "/api/device/revoke",
      headers: headers(a.cookie),
      payload: { deviceId: first.json().deviceId },
    });
    expect((await send(headers(a.cookie))).statusCode).toBe(403);
    const reconnected = await connect();
    expect(reconnected.json().deviceId).not.toBe(first.json().deviceId);
    expect((await send(headers(a.cookie))).statusCode).toBe(200);
  });
  it("conserva el último programa ejecutado en su sesión y lo recupera tras reiniciar", async () => {
    const a = await session(1),
      b = await session(2);
    const lastRun = {
      lessonId: "led",
      board: "pico",
      code: 'print("Raíces")\n',
      at: new Date(now).toISOString(),
    };
    const saved = await app.inject({
      method: "PATCH",
      url: "/api/session",
      headers: headers(a.cookie),
      payload: { lastRun },
    });
    expect(saved.statusCode).toBe(200);
    expect(saved.json().session.lastRun).toEqual(lastRun);
    expect(
      (
        await app.inject({ url: "/api/session", headers: headers(b.cookie) })
      ).json().session.lastRun,
    ).toBeUndefined();
    const config = app.rdConfig;
    await app.close();
    app = await buildApp(config);
    expect(
      (
        await app.inject({ url: "/api/session", headers: headers(a.cookie) })
      ).json().session.lastRun,
    ).toEqual(lastRun);
  });
  it("permite precargar assets desde una IP compartida y mantiene el límite de la API", async () => {
    const config = app.rdConfig;
    await app.close();
    const staticPath = join(directory, "static");
    await mkdir(staticPath);
    await writeFile(
      join(staticPath, "index.html"),
      "<main>Raíces Digitales</main>",
    );
    await writeFile(join(staticPath, "lesson.js"), 'console.log("curso");');
    app = await buildApp({ ...config, staticPath });

    // Ten new browsers behind one NAT can request more than 180 offline assets.
    for (let request = 0; request < 210; request++) {
      const asset = await app.inject({ url: `/lesson.js?precache=${request}` });
      expect(asset.statusCode).toBe(200);
      expect(asset.payload).toBe('console.log("curso");');
    }
    for (let request = 0; request < 180; request++) {
      const api = await app.inject({ url: "/api/session" });
      expect(api.statusCode).toBe(401);
    }
    expect((await app.inject({ url: "/api/session" })).statusCode).toBe(429);
    expect((await app.inject({ url: "/lesson.js" })).statusCode).toBe(200);
  });

  it("aísla dos grupos, tokens opacos, borrado y revocación", async () => {
    const a = await session(1);
    const b = await session(2);
    const device = await pair(a.cookie);
    const result = await ingest(device.token, 43);
    expect(result.statusCode).toBe(200);
    expect((await dashboard(a.cookie)).latest[0]).toMatchObject({
      value: 43,
      source: "hardware",
      deviceId: device.deviceId,
    });
    expect((await dashboard(b.cookie)).latest).toEqual([]);
    const guessed = await app.inject({
      url: "/api/session",
      headers: { cookie: `rd_session=${a.session.id}` },
    });
    expect(guessed.statusCode).toBe(401);
    const stolenRevoke = await app.inject({
      method: "POST",
      url: "/api/device/revoke",
      headers: headers(b.cookie),
      payload: { deviceId: device.deviceId },
    });
    expect(stolenRevoke.statusCode).toBe(404);
    const revoked = await app.inject({
      method: "POST",
      url: "/api/device/revoke",
      headers: headers(a.cookie),
      payload: { deviceId: device.deviceId },
    });
    expect(revoked.statusCode).toBe(200);
    expect((await ingest(device.token, 99)).statusCode).toBe(401);
    const raw = await readFile(join(directory, "test.sqlite-wal"));
    expect(raw.includes(Buffer.from(device.token))).toBe(false);
    expect(raw.includes(Buffer.from(a.cookie.split("=")[1]))).toBe(false);
    expect(
      (
        await app.inject({
          method: "DELETE",
          url: "/api/session",
          headers: headers(a.cookie),
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await app.inject({ url: "/api/session", headers: headers(a.cookie) }))
        .statusCode,
    ).toBe(401);
  });
  it("rechaza tokens inválidos, payload desconocido, sensor ajeno y datos malformados", async () => {
    const a = await session();
    const device = await pair(a.cookie);
    expect((await ingest("invalid", 10)).statusCode).toBe(401);
    for (const readings of [
      [{ ...reading(10), sensor: "invented" }],
      [{ ...reading(10), value: null }],
      [{ ...reading(10), value: 100001 }],
      [{ ...reading(10), deviceId: device.deviceId }],
      [reading(10), reading(20)],
      [{ ...reading(10), unit: "cm" }],
      [],
    ]) {
      const response = await app.inject({
        method: "POST",
        url: "/api/device/ingest",
        headers: { authorization: `Bearer ${device.token}` },
        payload: { source: "hardware", readings },
      });
      expect(response.statusCode).toBe(400);
    }
    expect((await ingest(device.token, null, "NO_RESPONSE")).statusCode).toBe(
      200,
    );
    expect((await dashboard(a.cookie)).latest[0].value).toBeNull();
  });
  it("códigos de pairing expiran, son de un uso y nueva generación invalida anteriores", async () => {
    const a = await session();
    const first = await pair(a.cookie);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/device/pair",
          payload: { code: first.code },
        })
      ).statusCode,
    ).toBe(401);
    const old = await app.inject({
      method: "POST",
      url: "/api/pair",
      headers: headers(a.cookie),
      payload: {},
    });
    const newer = await app.inject({
      method: "POST",
      url: "/api/pair",
      headers: headers(a.cookie),
      payload: {},
    });
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/device/pair",
          payload: { code: old.json().code },
        })
      ).statusCode,
    ).toBe(401);
    now += 301000;
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/device/pair",
          payload: { code: newer.json().code },
        })
      ).statusCode,
    ).toBe(401);
  });
  it("protege mutaciones con Origin y mantiene profesor separado", async () => {
    const a = await session();
    for (const requestHeaders of [
      { cookie: a.cookie },
      { cookie: a.cookie, origin: "https://evil.invalid" },
    ])
      expect(
        (
          await app.inject({
            method: "PATCH",
            url: "/api/session",
            headers: requestHeaders,
            payload: { name: "Otro" },
          })
        ).statusCode,
      ).toBe(403);
    expect(
      (
        await app.inject({
          url: "/api/teacher/groups",
          headers: headers(a.cookie),
        })
      ).statusCode,
    ).toBe(403);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/teacher/login",
          headers: headers(),
          payload: { password: "wrong" },
        })
      ).statusCode,
    ).toBe(401);
    const login = await app.inject({
      method: "POST",
      url: "/api/teacher/login",
      headers: headers(),
      payload: { password: "test-only-password-123" },
    });
    expect(login.statusCode).toBe(200);
    const teacherCookie = String(login.headers["set-cookie"]).split(";")[0];
    const groups = await app.inject({
      url: "/api/teacher/groups",
      headers: headers(teacherCookie),
    });
    expect(groups.json().groups[0].id).toBe(a.session.id);
    const telegramStatus = await app.inject({
      url: "/api/telegram",
      headers: headers(teacherCookie),
    });
    expect(telegramStatus.statusCode).toBe(200);
    expect(telegramStatus.json()).toEqual({ configured: false });
    expect(groups.payload).not.toContain("cookie_hash");
    await app.inject({
      method: "POST",
      url: "/api/teacher/logout",
      headers: headers(teacherCookie),
      payload: {},
    });
    expect(
      (
        await app.inject({
          url: "/api/teacher/groups",
          headers: headers(teacherCookie),
        })
      ).statusCode,
    ).toBe(403);
  });
  it("persiste edición parcial, calibración, lectura, umbral y token tras reiniciar SQLite", async () => {
    const a = await session();
    const device = await pair(a.cookie);
    const rule = await addRule(a.cookie);
    const patch = await app.inject({
      method: "PATCH",
      url: "/api/session",
      headers: headers(a.cookie),
      payload: {
        name: "Mi planta",
        drafts: { led: "print(42)" },
        calibrations: { soil: { dry: 60000, wet: 18000 } },
        sensorEnabled: { soil: true },
        progress: ["led"],
      },
    });
    expect(patch.statusCode).toBe(200);
    await ingest(device.token, 42);
    await app.close();
    app = await buildApp({ ...app.rdConfig, logger: false });
    const restored = (
      await app.inject({ url: "/api/session", headers: headers(a.cookie) })
    ).json().session;
    expect(restored).toMatchObject({
      name: "Mi planta",
      drafts: { led: "print(42)" },
      sensorEnabled: { soil: true },
      calibrations: { soil: { dry: 60000, wet: 18000 } },
    });
    expect((await dashboard(a.cookie)).rules[0].id).toBe(rule.id);
    expect((await dashboard(a.cookie)).latest[0].value).toBe(42);
    expect((await ingest(device.token, 44)).statusCode).toBe(200);
  });
  it("exporta CSV completo con etiquetas y JSON sin secretos; limpieza respeta retención", async () => {
    const a = await session();
    const device = await pair(a.cookie);
    await ingest(device.token, 40);
    await app.inject({
      method: "POST",
      url: "/api/simulation",
      headers: headers(a.cookie),
      payload: {
        readings: [{ ...reading(10), error: ' \t=HYPERLINK("evil")' }],
      },
    });
    const output = await app.inject({
      url: "/api/export",
      headers: headers(a.cookie),
    });
    expect(output.statusCode).toBe(200);
    expect(output.headers["content-type"]).toContain("text/csv");
    expect(output.payload).toContain("hardware");
    expect(output.payload).toContain("simulation");
    expect(output.payload).toContain("' \t=HYPERLINK");
    const exported = await app.inject({
      url: "/api/session/export",
      headers: headers(a.cookie),
    });
    expect(exported.json().session.id).toBe(a.session.id);
    expect(exported.payload).not.toContain(device.token);
    now += 31 * 86400000;
    app.store.cleanup();
    expect(
      app.store.db.prepare("SELECT COUNT(*) AS count FROM readings").get()!
        .count,
    ).toBe(0);
    expect(
      (await app.inject({ url: "/api/session", headers: headers(a.cookie) }))
        .statusCode,
    ).toBe(401);
  });
  it("limita intentos de profesor y sensores/calibraciones inválidos", async () => {
    for (let i = 0; i < 5; i++)
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/teacher/login",
            headers: headers(),
            payload: { password: "wrong" },
          })
        ).statusCode,
      ).toBe(401);
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/teacher/login",
          headers: headers(),
          payload: { password: "wrong" },
        })
      ).statusCode,
    ).toBe(429);
    const a = await session();
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/session",
          headers: headers(a.cookie),
          payload: { calibrations: { soil: { dry: 10, wet: 10 } } },
        })
      ).statusCode,
    ).toBe(400);
    const drafts = Object.fromEntries(
      Array.from({ length: 50 }, (_, i) => [`example${i}`, "print(42)"]),
    );
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/session",
          headers: headers(a.cookie),
          payload: { drafts },
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await app.inject({
          method: "PATCH",
          url: "/api/session",
          headers: headers(a.cookie),
          payload: { drafts: { additional: "print(43)" } },
        })
      ).statusCode,
    ).toBe(400);
  });
});

describe("alertas reales y transporte SSE", () => {
  it("audita ausencia de telemetría, persiste transición, deduplica y detecta recuperación real", async () => {
    const a = await session();
    const b = await session(2);
    const hardware = await pair(a.cookie);
    const simulatedDevice = await pair(b.cookie);
    await ingest(hardware.token, 40);
    await ingest(simulatedDevice.token, 50, "READING", "simulation");
    now += 119000;
    app.alerts.auditDevices();
    expect((await dashboard(a.cookie)).alerts).toHaveLength(0);
    expect((await dashboard(a.cookie)).devices[0].online).toBe(true);
    now += 1000;
    app.alerts.auditDevices();
    app.alerts.auditDevices();
    let data = await dashboard(a.cookie);
    expect(data.devices[0].online).toBe(false);
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0]).toMatchObject({
      type: "DEVICE_OFFLINE",
      sensor: "device",
      source: "hardware",
      deviceId: hardware.deviceId,
    });
    expect((await dashboard(b.cookie)).alerts).toHaveLength(0);
    await app.close();
    app = await buildApp({ ...app.rdConfig, logger: false });
    expect((await dashboard(a.cookie)).alerts).toHaveLength(1);
    expect((await ingest(hardware.token, 42)).statusCode).toBe(200);
    data = await dashboard(a.cookie);
    expect(data.devices[0].online).toBe(true);
    expect(data.alerts).toHaveLength(2);
    expect(data.alerts[0]).toMatchObject({
      type: "DEVICE_RECOVERY",
      source: "hardware",
    });
    app.alerts.auditDevices();
    expect((await dashboard(a.cookie)).alerts).toHaveLength(2);
    await app.inject({
      method: "POST",
      url: "/api/device/revoke",
      headers: headers(a.cookie),
      payload: { deviceId: hardware.deviceId },
    });
    now += 200000;
    app.alerts.auditDevices();
    expect((await dashboard(a.cookie)).alerts).toHaveLength(2);
  });
  it("aplica histéresis, cooldown, recuperación y separa simulación", async () => {
    const a = await session();
    const device = await pair(a.cookie);
    await addRule(a.cookie);
    await ingest(device.token, 10);
    expect((await dashboard(a.cookie)).alerts).toHaveLength(1);
    now += 9000;
    await ingest(device.token, 12);
    expect((await dashboard(a.cookie)).alerts).toHaveLength(1);
    now += 1000;
    await ingest(device.token, 12);
    expect((await dashboard(a.cookie)).alerts).toHaveLength(2);
    await ingest(device.token, 22);
    expect((await dashboard(a.cookie)).alerts).toHaveLength(2);
    await ingest(device.token, 25);
    expect((await dashboard(a.cookie)).alerts[0].type).toBe("RECOVERY");
    await ingest(device.token, 90);
    await ingest(device.token, 78);
    expect((await dashboard(a.cookie)).alerts[0].type).toBe("ABOVE_MAX");
    await ingest(device.token, 75);
    expect((await dashboard(a.cookie)).alerts[0].type).toBe("RECOVERY");
    await app.inject({
      method: "POST",
      url: "/api/simulation",
      headers: headers(a.cookie),
      payload: { readings: [reading(5)] },
    });
    expect((await dashboard(a.cookie)).alerts[0]).toMatchObject({
      source: "simulation",
      delivery: "simulation",
    });
    expect((await dashboard(a.cookie)).latest).toHaveLength(2);
  });
  it("diagnostica fallo verificable, lo recupera y no interpreta calibración pendiente como alarma", async () => {
    const a = await session();
    const device = await pair(a.cookie);
    await addRule(a.cookie);
    expect(
      (await ingest(device.token, null, "NEEDS_CALIBRATION")).statusCode,
    ).toBe(200);
    expect((await ingest(device.token, null, "UNVERIFIED")).statusCode).toBe(
      200,
    );
    expect((await dashboard(a.cookie)).alerts).toHaveLength(0);
    await ingest(device.token, null, "NO_RESPONSE");
    expect((await dashboard(a.cookie)).alerts[0].type).toBe("SENSOR_FAULT");
    await ingest(device.token, 50);
    expect((await dashboard(a.cookie)).alerts[0].type).toBe("SENSOR_RECOVERY");
  });
  it("entrega un evento SSE real por HTTP y no publica datos ajenos", async () => {
    const a = await session();
    const b = await session();
    await app.listen({ host: "127.0.0.1", port: 0 });
    const address = app.server.address() as { port: number };
    const controller = new AbortController();
    const response = await fetch(
      `http://127.0.0.1:${address.port}/api/events`,
      { headers: { cookie: a.cookie }, signal: controller.signal },
    );
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain("event: update");
    await app.inject({
      method: "POST",
      url: "/api/simulation",
      headers: headers(b.cookie),
      payload: { readings: [reading(20)] },
    });
    await app.inject({
      method: "POST",
      url: "/api/simulation",
      headers: headers(a.cookie),
      payload: { readings: [reading(40)] },
    });
    const second = await reader.read();
    const text = new TextDecoder().decode(second.value);
    expect(text).toContain("event: update");
    expect(text).not.toContain("soil");
    await reader.cancel();
    controller.abort();
  });
  it("distribuye firmware real sin configuración y mantiene CA compatible con Caddy", async () => {
    const response = await app.inject({ url: "/api/firmware" });
    expect(response.statusCode).toBe(200);
    const files = response.json().files;
    expect(files["main.py"]).toContain("load_config");
    expect(files["drivers.py"]).toContain("class AnalogSensor");
    expect(files["config.json"]).toBeUndefined();
    expect(files["config.py"]).toBeUndefined();
    const ca = new X509Certificate(files["ca.pem"]);
    expect(ca.subject).toContain("CN=ISRG Root X1");
    expect(ca.fingerprint256).toBe(
      "96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6",
    );
    const proxy = await readFile(resolve("Caddyfile"), "utf8");
    expect(proxy).toContain("issuer acme");
    expect(proxy).toContain('root_common_name "ISRG Root X1"');
  });
  it("cifra Telegram en SQLite, nunca devuelve el token y restringe configuración a profesor", async () => {
    const a = await session();
    const botToken = "123456789:abcdefghijklmnopqrstuvwxyz_123456789";
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/telegram",
          headers: headers(a.cookie),
          payload: { token: botToken, chatId: "-123456" },
        })
      ).statusCode,
    ).toBe(403);
    const login = await app.inject({
      method: "POST",
      url: "/api/teacher/login",
      headers: headers(),
      payload: { password: "test-only-password-123" },
    });
    const teacherCookie = String(login.headers["set-cookie"]).split(";")[0];
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/telegram",
          headers: headers(teacherCookie),
          payload: { token: botToken, chatId: "-123456" },
        })
      ).statusCode,
    ).toBe(200);
    const stored = app.store.db
      .prepare("SELECT value FROM settings WHERE key=?")
      .get("telegram")!;
    expect(stored.value).not.toContain(botToken);
    expect(stored.value).not.toContain("-123456");
    expect(app.telegram.credentials()).toEqual({
      token: botToken,
      chatId: "-123456",
    });
    const status = await app.inject({
      url: "/api/telegram",
      headers: headers(a.cookie),
    });
    expect(status.json()).toEqual({ configured: true, chatId: "-123456" });
    expect(status.payload).not.toContain(botToken);
  });
  it("rechaza inclusión arbitraria de archivos y compila Arduino si el CLI real fue instalado", async () => {
    const a = await session();
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/arduino/compile",
          headers: headers(a.cookie),
          payload: {
            code: '#include "/etc/passwd"\nvoid setup(){}\nvoid loop(){}',
            board: "uno",
          },
        })
      ).statusCode,
    ).toBe(400);
    if (existsSync(app.rdConfig.arduinoCli)) {
      const compiled = await app.inject({
        method: "POST",
        url: "/api/arduino/compile",
        headers: headers(a.cookie),
        payload: {
          code: "void setup(){pinMode(LED_BUILTIN,OUTPUT);} void loop(){digitalWrite(LED_BUILTIN,HIGH);delay(100);digitalWrite(LED_BUILTIN,LOW);delay(100);}",
          board: "uno",
        },
      });
      expect(compiled.statusCode, compiled.payload).toBe(200);
      expect(compiled.json().hex).toMatch(/^:[0-9A-F]+/);
    } else {
      expect(
        (
          await app.inject({
            method: "POST",
            url: "/api/arduino/compile",
            headers: headers(a.cookie),
            payload: { code: "void setup(){} void loop(){}", board: "uno" },
          })
        ).statusCode,
      ).toBe(503);
    }
  });
});
