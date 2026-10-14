import Fastify from "fastify";
import { timingSafeEqual } from "node:crypto";
import { z, ZodError } from "zod";
import {
  ArduinoCompiler,
  CompileError,
  COMPILE_DEADLINE_HEADER,
} from "./arduino.ts";
import { compileRequestCancellation } from "./compile-request.ts";
import { configuration } from "./config.ts";
import { hash } from "./database.ts";
import { ARDUINO_BOARDS } from "../shared/boards.ts";

// Separate process/container: no telemetry volume, database or teacher/Telegram secrets.
const secret = process.env.ARDUINO_SERVICE_TOKEN;
if (!secret || secret.length < 32)
  throw new Error("ARDUINO_SERVICE_TOKEN necesita al menos 32 caracteres.");
const compiler = new ArduinoCompiler(
  configuration({
    secureCookies: false,
    arduinoSandbox: false,
    arduinoServiceUrl: undefined,
    logger: false,
  }),
);
const app = Fastify({
  bodyLimit: 700000,
  requestTimeout: 65000,
  connectionTimeout: 65000,
  logger: false,
});
app.addHook("onRequest", async (request, reply) => {
  const received = request.headers.authorization || "";
  if (
    !timingSafeEqual(
      Buffer.from(hash(received)),
      Buffer.from(hash(`Bearer ${secret}`)),
    )
  )
    return reply.code(401).send({ error: "No autorizado." });
});
app.setErrorHandler((error: Error & { statusCode?: number }, _request, reply) =>
  reply.code(error instanceof ZodError ? 400 : error.statusCode || 500).send({
    error:
      error instanceof ZodError ? "Código o placa inválidos." : error.message,
  }),
);
app.get("/health", async () => {
  const ok = await compiler.available();
  return { ok };
});
app.post("/compile", async (request, reply) => {
  const body = z
    .object({
      code: z.string().min(1).max(60000),
      board: z.enum(ARDUINO_BOARDS),
    })
    .strict()
    .parse(request.body);
  const deadlineHeader = request.headers[COMPILE_DEADLINE_HEADER];
  if (
    deadlineHeader !== undefined &&
    (typeof deadlineHeader !== "string" ||
      !/^\d{1,16}$/.test(deadlineHeader) ||
      !Number.isSafeInteger(Number(deadlineHeader)))
  )
    throw new CompileError("El plazo de compilación no es válido.", 400);
  const cancellation = compileRequestCancellation(request.raw, reply.raw);
  try {
    return await compiler.compile(body.code, body.board, {
      signal: cancellation.signal,
      deadline:
        deadlineHeader === undefined ? undefined : Number(deadlineHeader),
    });
  } finally {
    cancellation.dispose();
  }
});
process.once("SIGTERM", async () => {
  await app.close();
  process.exit(0);
});
await app.listen({ host: "0.0.0.0", port: 3002 });
