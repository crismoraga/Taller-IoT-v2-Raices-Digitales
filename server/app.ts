import Fastify, { type FastifyRequest, type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import staticFiles from "@fastify/static";
import rateLimit from "@fastify/rate-limit";
import { randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { Readable } from "node:stream";
import { z, ZodError } from "zod";
import { configuration, type Config } from "./config.ts";
import { Store, hash, token, type Session, type Row } from "./database.ts";
import { Alerts, Telegram } from "./alerts.ts";
import { ArduinoCompiler, CompileError } from "./arduino.ts";
import {
  sessionCreateSchema,
  sessionPatchSchema,
  readingBatchSchema,
  ingestSchema,
  ruleSchema,
} from "./validation.ts";

const SESSION_COOKIE = "rd_session";
const TEACHER_COOKIE = "rd_teacher";
const uuidSchema = z.string().uuid();
class HttpError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}
const csv = (value: unknown) => {
  const raw = value === null || value === undefined ? "" : String(value);
  const safe =
    typeof value === "string" &&
    (/^\s*[=+\-@]/u.test(raw) || /^[\t\r\n]/.test(raw))
      ? "'" + raw
      : raw;
  return `"${safe.replaceAll('"', '""')}"`;
};
export type BackendApp = Omit<FastifyInstance, "then"> & {
  store: Store;
  alerts: Alerts;
  telegram: Telegram;
  compiler: ArduinoCompiler;
  rdConfig: Config;
};

export async function buildApp(
  overrides: Partial<Config> = {},
): Promise<BackendApp> {
  const config = configuration(overrides);
  const app = Fastify({
    logger: config.logger,
    bodyLimit: 700000,
    requestTimeout: 65000,
    connectionTimeout: 15000,
    trustProxy: process.env.TRUST_PROXY?.split(",") || false,
  });
  const store = new Store(config);
  const sessions = new WeakMap<FastifyRequest, Session>();
  const streams = new Map<string, Set<NodeJS.WritableStream>>();
  const notify = (sessionId: string) => {
    for (const stream of streams.get(sessionId) || []) {
      if (
        !stream.write(
          `event: update\ndata: ${JSON.stringify({ at: new Date(config.now()).toISOString() })}\n\n`,
        )
      )
        stream.end();
    }
  };
  const telegram = new Telegram(store, config);
  const alerts = new Alerts(store, config, telegram, notify);
  const compiler = new ArduinoCompiler(config);
  await app.register(cookie);
  await app.register(rateLimit, {
    global: true,
    max: 180,
    timeWindow: 60000,
    allowList: (request) => !request.url.startsWith("/api/"),
    keyGenerator: (req) =>
      hash(req.cookies[SESSION_COOKIE] || req.headers.authorization || req.ip),
    errorResponseBuilder: () => ({
      statusCode: 429,
      message: "Demasiadas solicitudes. Espera antes de volver a intentar.",
    }),
  });
  const authSession = (request: FastifyRequest) => {
    const session = store.byCookie(request.cookies[SESSION_COOKIE]);
    if (!session)
      throw new HttpError(
        401,
        "Crea o recupera una sesión de grupo para continuar.",
      );
    sessions.set(request, session);
    return session;
  };
  const teacher = (request: FastifyRequest) => {
    const secret = request.cookies[TEACHER_COOKIE];
    if (
      !secret ||
      !store.db
        .prepare(
          "SELECT 1 FROM teacher_sessions WHERE cookie_hash=? AND expires_at>?",
        )
        .get(hash(secret), config.now())
    )
      throw new HttpError(403, "Se requiere acceso de profesor.");
  };
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: config.secureCookies,
    path: "/",
  };
  app.addHook("onRequest", async (request, reply) => {
    reply
      .header("X-Content-Type-Options", "nosniff")
      .header("Referrer-Policy", "same-origin")
      .header("X-Frame-Options", "DENY");
    reply.header(
      "Permissions-Policy",
      "serial=(self), camera=(), microphone=(), geolocation=()",
    );
    if (config.secureCookies)
      reply.header(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    if (request.url.startsWith("/api/"))
      reply.header("Cache-Control", "no-store");
    const path = request.url.split("?")[0];
    if (
      path.startsWith("/api/") &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      !["/api/device/ingest", "/api/device/pair"].includes(path)
    ) {
      if (
        !request.headers.origin ||
        !config.origins.includes(request.headers.origin)
      )
        throw new HttpError(
          403,
          "Origen no autorizado. Usa la plataforma desde APP_ORIGIN.",
        );
    }
  });
  app.addHook("preHandler", async (request) => {
    const path = request.url.split("?")[0];
    if (!path.startsWith("/api/")) return;
    if (path.startsWith("/api/teacher/") && path !== "/api/teacher/login") {
      teacher(request);
      return;
    }
    if (path === "/api/telegram" || path === "/api/telegram/test") {
      if (request.method !== "GET") teacher(request);
      else {
        const teacherCookie = request.cookies[TEACHER_COOKIE];
        if (
          teacherCookie &&
          store.db
            .prepare(
              "SELECT 1 FROM teacher_sessions WHERE cookie_hash=? AND expires_at>?",
            )
            .get(hash(teacherCookie), config.now())
        )
          teacher(request);
        else authSession(request);
      }
      return;
    }
    if (
      [
        "/api/health",
        "/api/firmware",
        "/api/teacher/login",
        "/api/device/pair",
        "/api/device/ingest",
      ].includes(path)
    )
      return;
    if (path === "/api/session" && request.method === "POST") return;
    authSession(request);
  });
  app.setErrorHandler(
    (error: Error & { statusCode?: number }, _request, reply) => {
      if (error instanceof ZodError)
        return reply.code(400).send({
          error: "Datos inválidos.",
          details: error.issues
            .map((issue) => ({
              path: issue.path.join("."),
              message: issue.message,
            }))
            .slice(0, 10),
        });
      const status =
        error.statusCode && error.statusCode >= 400 && error.statusCode <= 599
          ? error.statusCode
          : 500;
      if (status === 500) app.log.error({ err: error }, "Error interno");
      return reply.code(status).send({
        error: status === 500 ? "Ocurrió un error interno." : error.message,
      });
    },
  );
  app.get("/api/health", async () => ({
    ok: true,
    version: "1.0.0",
    telegramConfigured: telegram.publicStatus().configured,
    arduinoAvailable: await compiler.available(),
  }));
  app.post(
    "/api/session",
    {
      config: {
        rateLimit: {
          max: 15,
          timeWindow: 60000,
          keyGenerator: (req: FastifyRequest) => req.ip,
        },
      },
    },
    async (request, reply) => {
      const body = sessionCreateSchema.parse(request.body || {});
      const existing = store.byCookie(request.cookies[SESSION_COOKIE]);
      if (existing) return { session: store.patchSession(existing, body) };
      const created = store.createSession(body.name, body.groupNumber);
      reply.setCookie(SESSION_COOKIE, created.secret, {
        ...cookieOptions,
        maxAge: config.sessionDays * 86400,
      });
      return { session: created.session };
    },
  );
  app.get("/api/session", async (request) => ({
    session: sessions.get(request)!,
  }));
  app.patch("/api/session", async (request) => {
    const updated = store.patchSession(
      sessions.get(request)!,
      sessionPatchSchema.parse(request.body),
    );
    notify(updated.id);
    return { session: updated };
  });
  app.delete("/api/session", async (request, reply) => {
    const session = sessions.get(request)!;
    store.db.prepare("DELETE FROM sessions WHERE id=?").run(session.id);
    for (const stream of streams.get(session.id) || []) stream.end();
    streams.delete(session.id);
    reply.clearCookie(SESSION_COOKIE, cookieOptions);
    return { ok: true };
  });
  app.post(
    "/api/pair",
    { config: { rateLimit: { max: 10, timeWindow: 60000 } } },
    async (request) => {
      const session = sessions.get(request)!;
      const code = randomBytes(6).toString("hex").toUpperCase();
      const expiresAt = config.now() + config.pairingSeconds * 1000;
      store.transaction(() => {
        store.db
          .prepare("DELETE FROM pair_codes WHERE session_id=?")
          .run(session.id);
        store.db
          .prepare("INSERT INTO pair_codes VALUES(?,?,?)")
          .run(hash(code), session.id, expiresAt);
      });
      return { code, expiresAt: new Date(expiresAt).toISOString() };
    },
  );
  app.post(
    "/api/device/pair",
    {
      config: {
        rateLimit: {
          max: 20,
          timeWindow: 60000,
          keyGenerator: (req: FastifyRequest) => req.ip,
        },
      },
    },
    async (request) => {
      const body = z
        .object({
          code: z
            .string()
            .trim()
            .regex(/^[a-fA-F0-9]{12}$/),
        })
        .strict()
        .parse(request.body);
      const result = store.transaction(() => {
        const row = store.db
          .prepare(
            "SELECT * FROM pair_codes WHERE code_hash=? AND expires_at>?",
          )
          .get(hash(body.code.toUpperCase()), config.now()) as Row | undefined;
        if (!row || !store.byId(String(row.session_id)))
          throw new HttpError(
            401,
            "Código de conexión inválido, usado o vencido.",
          );
        const count = store.db
          .prepare(
            "SELECT COUNT(*) AS count FROM devices WHERE session_id=? AND revoked=0",
          )
          .get(String(row.session_id)) as Row;
        if (Number(count.count) >= 5)
          throw new HttpError(
            409,
            "Máximo cinco dispositivos activos por grupo. Revoca uno antes de conectar otro.",
          );
        const deviceId = randomUUID();
        const secret = token();
        store.db
          .prepare(
            "INSERT INTO devices(id,session_id,token_hash,name,source) VALUES(?,?,?,?,?)",
          )
          .run(
            deviceId,
            String(row.session_id),
            hash(secret),
            `Estación ${Number(count.count) + 1}`,
            "hardware",
          );
        store.db
          .prepare("DELETE FROM pair_codes WHERE code_hash=?")
          .run(hash(body.code.toUpperCase()));
        return { deviceId, token: secret, sessionId: String(row.session_id) };
      });
      notify(result.sessionId);
      return { deviceId: result.deviceId, token: result.token };
    },
  );
  app.post("/api/device/revoke", async (request) => {
    const body = z
      .object({ deviceId: uuidSchema })
      .strict()
      .parse(request.body);
    const changed = store.db
      .prepare("UPDATE devices SET revoked=1 WHERE id=? AND session_id=?")
      .run(body.deviceId, sessions.get(request)!.id);
    if (!changed.changes)
      throw new HttpError(404, "Dispositivo no encontrado.");
    notify(sessions.get(request)!.id);
    return { ok: true };
  });
  // Browser USB bridge is authorized by the group's HttpOnly session, not by
  // a device token exposed to JavaScript. A revoked bridge needs a new connect.
  const usbBridge = (sessionId: string, reconnect = false) =>
    store.transaction(() => {
      const active = store.db
        .prepare(
          "SELECT id FROM devices WHERE session_id=? AND name='Puente USB' AND revoked=0",
        )
        .get(sessionId) as Row | undefined;
      if (active) return String(active.id);
      const revoked = store.db
        .prepare(
          "SELECT id FROM devices WHERE session_id=? AND name='Puente USB' AND revoked=1",
        )
        .get(sessionId);
      if (revoked && !reconnect)
        throw new HttpError(
          403,
          "El puente USB fue revocado. Desconecta y vuelve a conectar para autorizarlo.",
        );
      const count = store.db
        .prepare(
          "SELECT COUNT(*) AS count FROM devices WHERE session_id=? AND revoked=0",
        )
        .get(sessionId) as Row;
      if (Number(count.count) >= 5)
        throw new HttpError(
          409,
          "Revoca un dispositivo antes de crear otro puente USB.",
        );
      const id = randomUUID();
      store.db
        .prepare(
          "INSERT INTO devices(id,session_id,token_hash,name,source) VALUES(?,?,?,?,?)",
        )
        .run(id, sessionId, hash(token()), "Puente USB", "hardware");
      return id;
    });
  app.post("/api/bridge/connect", async (request) => {
    const sessionId = sessions.get(request)!.id;
    const deviceId = usbBridge(sessionId, true);
    notify(sessionId);
    return { deviceId };
  });
  app.post(
    "/api/bridge/ingest",
    { config: { rateLimit: { max: 120, timeWindow: 60000 } } },
    async (request) => {
      const body = ingestSchema.omit({ source: true }).parse(request.body);
      const sessionId = sessions.get(request)!.id;
      const deviceId = usbBridge(sessionId);
      const readings = store.ingest(
        sessionId,
        deviceId,
        "hardware",
        body.readings,
        body.diagnostics,
      );
      alerts.evaluate(sessionId, readings);
      alerts.auditDevices(sessionId);
      notify(sessionId);
      return { ok: true, deviceId };
    },
  );
  app.post(
    "/api/device/ingest",
    { config: { rateLimit: { max: 120, timeWindow: 60000 } } },
    async (request) => {
      const authorization = request.headers.authorization;
      if (!authorization?.startsWith("Bearer ") || authorization.length > 256)
        throw new HttpError(401, "Token de dispositivo requerido.");
      const device = store.db
        .prepare("SELECT * FROM devices WHERE token_hash=? AND revoked=0")
        .get(hash(authorization.slice(7))) as Row | undefined;
      if (!device || !store.byId(String(device.session_id)))
        throw new HttpError(401, "Dispositivo no autorizado o revocado.");
      const body = ingestSchema.parse(request.body);
      const readings = store.ingest(
        String(device.session_id),
        String(device.id),
        body.source,
        body.readings,
        body.diagnostics,
      );
      alerts.evaluate(String(device.session_id), readings);
      alerts.auditDevices(String(device.session_id));
      notify(String(device.session_id));
      return { ok: true };
    },
  );
  app.post(
    "/api/simulation",
    { config: { rateLimit: { max: 60, timeWindow: 60000 } } },
    async (request) => {
      const body = readingBatchSchema.parse(request.body);
      const sessionId = sessions.get(request)!.id;
      const readings = store.ingest(
        sessionId,
        "simulation",
        "simulation",
        body.readings,
      );
      alerts.evaluate(sessionId, readings);
      notify(sessionId);
      return { ok: true };
    },
  );
  app.get("/api/dashboard", async (request) => {
    const { range } = z
      .object({
        range: z.enum(["15m", "1h", "6h", "24h", "all"]).default("1h"),
      })
      .parse(request.query);
    const spans = {
      "15m": 900000,
      "1h": 3600000,
      "6h": 21600000,
      "24h": 86400000,
      all: Infinity,
    };
    const id = sessions.get(request)!.id;
    const since = range === "all" ? 0 : config.now() - spans[range];
    const history = store.history(id, since);
    return {
      devices: store.devices(id),
      latest: store.latest(id),
      history,
      rules: store.rules(id),
      alerts: store.alerts(id),
      historyLimit: 5000,
      historyTruncated: history.length === 5000,
    };
  });
  app.get("/api/events", async (request, reply) => {
    const id = sessions.get(request)!.id;
    const open = streams.get(id) || new Set<NodeJS.WritableStream>();
    if (open.size >= 3)
      throw new HttpError(
        429,
        "Máximo tres conexiones de actualización por grupo.",
      );
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-store",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      "X-Content-Type-Options": "nosniff",
    });
    open.add(reply.raw);
    streams.set(id, open);
    reply.raw.write(
      `event: update\ndata: ${JSON.stringify({ connected: true })}\n\n`,
    );
    const interval = setInterval(() => {
      if (!store.byId(id)) {
        reply.raw.end();
        return;
      }
      if (!reply.raw.write(": heartbeat\n\n")) reply.raw.end();
    }, 15000);
    interval.unref();
    request.raw.on("close", () => {
      clearInterval(interval);
      open.delete(reply.raw);
      if (!open.size) streams.delete(id);
    });
  });
  app.get("/api/export", async (request, reply) => {
    const id = sessions.get(request)!.id;
    const snapshot = store.db
      .prepare(
        "SELECT COALESCE(MAX(id),0) AS max_id FROM readings WHERE session_id=?",
      )
      .get(id) as Row;
    const rows = store.db
      .prepare(
        "SELECT data FROM readings WHERE session_id=? AND id<=? ORDER BY id",
      )
      .iterate(id, Number(snapshot.max_id));
    function* data() {
      yield "\uFEFFtimestamp,deviceId,source,sensor,value,unit,status,raw,confidence,error\r\n";
      for (const row of rows) {
        const reading = JSON.parse(String(row.data));
        yield [
          "timestamp",
          "deviceId",
          "source",
          "sensor",
          "value",
          "unit",
          "status",
          "raw",
          "confidence",
          "error",
        ]
          .map((key) => csv(reading[key]))
          .join(",") + "\r\n";
      }
    }
    reply
      .header(
        "Content-Disposition",
        `attachment; filename="raices-grupo-${sessions.get(request)!.groupNumber}.csv"`,
      )
      .type("text/csv; charset=utf-8");
    return reply.send(Readable.from(data()));
  });
  app.get("/api/session/export", async (request, reply) => {
    const session = sessions.get(request)!;
    reply.header(
      "Content-Disposition",
      'attachment; filename="raices-sesion.json"',
    );
    return {
      session,
      devices: store.devices(session.id),
      latest: store.latest(session.id),
      rules: store.rules(session.id),
      alerts: store.alerts(session.id, 10000),
      exportedAt: new Date(config.now()).toISOString(),
      formatVersion: 1,
    };
  });
  app.post("/api/rules", async (request) => {
    const rule = ruleSchema.parse(request.body);
    const id = randomUUID();
    const sessionId = sessions.get(request)!.id;
    const count = store.rules(sessionId);
    if (count.length >= 20)
      throw new HttpError(409, "Máximo 20 umbrales por grupo.");
    if (count.some((item) => item.sensor === rule.sensor))
      throw new HttpError(
        409,
        "Ya existe un umbral para este sensor. Elimínalo antes de crear otro.",
      );
    store.db
      .prepare("INSERT INTO rules VALUES(?,?,?)")
      .run(id, sessionId, JSON.stringify(rule));
    notify(sessionId);
    return { rule: { id, ...rule } };
  });
  app.delete("/api/rules/:id", async (request) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    const sessionId = sessions.get(request)!.id;
    const changed = store.db
      .prepare("DELETE FROM rules WHERE id=? AND session_id=?")
      .run(id, sessionId);
    if (!changed.changes) throw new HttpError(404, "Umbral no encontrado.");
    notify(sessionId);
    return { ok: true };
  });
  app.post(
    "/api/teacher/login",
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: 900000,
          keyGenerator: (req: FastifyRequest) => req.ip,
        },
      },
    },
    async (request, reply) => {
      if (!config.teacherPassword)
        throw new HttpError(
          503,
          "El administrador debe configurar TEACHER_PASSWORD.",
        );
      const body = z
        .object({ password: z.string().min(1).max(256) })
        .strict()
        .parse(request.body);
      if (
        !timingSafeEqual(
          Buffer.from(hash(body.password)),
          Buffer.from(hash(config.teacherPassword)),
        )
      )
        throw new HttpError(401, "Contraseña incorrecta.");
      const previous = request.cookies[TEACHER_COOKIE];
      if (previous)
        store.db
          .prepare("DELETE FROM teacher_sessions WHERE cookie_hash=?")
          .run(hash(previous));
      const secret = token();
      store.db
        .prepare("INSERT INTO teacher_sessions VALUES(?,?)")
        .run(hash(secret), config.now() + 28800000);
      reply.setCookie(TEACHER_COOKIE, secret, {
        ...cookieOptions,
        maxAge: 28800,
      });
      return { ok: true };
    },
  );
  app.post("/api/teacher/logout", async (request, reply) => {
    store.db
      .prepare("DELETE FROM teacher_sessions WHERE cookie_hash=?")
      .run(hash(request.cookies[TEACHER_COOKIE]!));
    reply.clearCookie(TEACHER_COOKIE, cookieOptions);
    return { ok: true };
  });
  app.get("/api/teacher/groups", async () => {
    const groups = (
      store.db
        .prepare(
          "SELECT * FROM sessions WHERE expires_at>? ORDER BY group_number,created_at DESC",
        )
        .all(config.now()) as Row[]
    ).map((row) => {
      const session = store.session(row);
      const devices = store.devices(session.id);
      return {
        ...session,
        devices,
        latest: store.latest(session.id),
        alerts: store.alerts(session.id, 10),
      };
    });
    return { groups };
  });
  app.get("/api/teacher/groups/:id", async (request) => {
    const { id } = z.object({ id: uuidSchema }).parse(request.params);
    const session = store.byId(id);
    if (!session) throw new HttpError(404, "Grupo no encontrado.");
    return {
      session,
      devices: store.devices(id),
      latest: store.latest(id),
      alerts: store.alerts(id),
    };
  });
  app.get("/api/telegram", async () => telegram.publicStatus());
  app.post("/api/telegram", async (request) => {
    const body = z
      .object({
        token: z.string().regex(/^\d{5,20}:[A-Za-z0-9_-]{20,100}$/),
        chatId: z.string().regex(/^-?\d{1,20}$/),
      })
      .strict()
      .parse(request.body);
    if (!config.encryptionKey)
      throw new HttpError(
        503,
        "Configura SECRETS_KEY para cifrar las credenciales.",
      );
    telegram.save(body.token, body.chatId);
    return { ok: true };
  });
  app.post(
    "/api/telegram/test",
    { config: { rateLimit: { max: 3, timeWindow: 60000 } } },
    async () => {
      try {
        await telegram.send(
          "🌱 Raíces Digitales · conexión Telegram verificada. Las alertas reales de los grupos llegarán a este chat.",
        );
        return { ok: true };
      } catch (error) {
        throw new HttpError(
          502,
          error instanceof Error
            ? error.message
            : "No se pudo enviar el mensaje.",
        );
      }
    },
  );
  app.post(
    "/api/arduino/compile",
    { config: { rateLimit: { max: 6, timeWindow: 60000 } } },
    async (request) => {
      const body = z
        .object({
          code: z.string().min(1).max(60000),
          board: z.enum(["uno", "nano", "nano-old"]),
        })
        .strict()
        .parse(request.body);
      if (
        config.secureCookies &&
        !config.arduinoSandbox &&
        !config.arduinoServiceUrl
      )
        throw new CompileError(
          "La compilación en producción requiere un servicio aislado o ARDUINO_SANDBOX=docker. El administrador debe habilitar el compilador aislado.",
          503,
        );
      return compiler.compile(body.code, body.board);
    },
  );
  app.get("/api/firmware", async () => {
    const files: Record<string, string> = {};
    async function walk(directory: string) {
      for (const item of await readdir(directory, { withFileTypes: true })) {
        const path = join(directory, item.name);
        if (
          item.isDirectory() &&
          !item.name.startsWith(".") &&
          item.name !== "__pycache__"
        )
          await walk(path);
        else if (
          item.isFile() &&
          (item.name.endsWith(".py") || item.name === "ca.pem") &&
          item.name !== "config.py"
        )
          files[relative(config.firmwarePath, path).replaceAll("\\", "/")] =
            await readFile(path, "utf8");
      }
    }
    if (!existsSync(config.firmwarePath))
      throw new HttpError(503, "Firmware no instalado en el servidor.");
    await walk(config.firmwarePath);
    return { files };
  });
  if (existsSync(config.staticPath)) {
    await app.register(staticFiles, {
      root: config.staticPath,
      prefix: "/",
      index: ["index.html"],
    });
    app.setNotFoundHandler((request, reply) => {
      if (
        request.url.startsWith("/api/") ||
        !["GET", "HEAD"].includes(request.method) ||
        request.url.split("?")[0].includes(".")
      )
        return reply.code(404).send({ error: "Recurso no encontrado." });
      return reply.sendFile("index.html");
    });
  }
  store.cleanup();
  const cleanup = setInterval(() => {
    try {
      store.cleanup();
    } catch (error) {
      app.log.error({ err: error }, "No se completó la limpieza de retención");
    }
  }, 3600000);
  cleanup.unref();
  alerts.auditDevices();
  const monitor = setInterval(() => {
    try {
      alerts.auditDevices();
    } catch (error) {
      app.log.error(
        { err: error },
        "No se completó la auditoría de estaciones",
      );
    }
  }, config.deviceAuditSeconds * 1000);
  monitor.unref();
  app.addHook("preClose", async () => {
    for (const values of streams.values())
      for (const stream of values) stream.end();
    streams.clear();
  });
  app.addHook("onClose", async () => {
    clearInterval(cleanup);
    clearInterval(monitor);
    await alerts.close();
    store.close();
  });
  return Object.assign(app, {
    store,
    alerts,
    telegram,
    compiler,
    rdConfig: config,
  }) as BackendApp;
}
