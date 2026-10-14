import { spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  readdir,
  chmod,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, basename, resolve, sep } from "node:path";
import type { Config } from "./config.ts";
import { AVR_BOARD_PROFILES, type ArduinoBoard } from "../shared/boards.ts";
import { CompileQueue, type CompileWorkContext } from "./compile-queue.ts";

export const COMPILE_BUDGET_MS = 60000;
export const COMPILE_DEADLINE_HEADER = "x-raices-compile-deadline";
type CompileOptions = { signal?: AbortSignal; deadline?: number };

export class CompileError extends Error {
  constructor(
    message: string,
    public statusCode = 422,
  ) {
    super(message);
  }
}
function run(
  executable: string,
  args: string[],
  timeout: number,
  env?: NodeJS.ProcessEnv,
  signal?: AbortSignal,
  cleanupTerminated?: () => Promise<void>,
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        new CompileError("Se canceló la compilación de este programa.", 499),
      );
      return;
    }
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let done = false;
    let terminationError: Error | undefined;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const terminate = () => {
      if (!child.pid) return;
      if (process.platform === "win32") {
        const killer = spawn(
          "taskkill",
          ["/PID", String(child.pid), "/T", "/F"],
          { shell: false, windowsHide: true, stdio: "ignore" },
        );
        killer.on("error", () => child.kill("SIGKILL"));
      } else {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          child.kill("SIGKILL");
        }
      }
    };
    const finish = async (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener("abort", abort);
      if (terminationError && cleanupTerminated) {
        try {
          await cleanupTerminated();
        } catch {
          error = new CompileError(
            "No se pudo cerrar el proceso del compilador aislado. Vuelve a intentarlo.",
            503,
          );
        }
      }
      if (error) reject(error);
      else resolve(output);
    };
    const stop = (error: Error) => {
      if (done || terminationError) return;
      terminationError = error;
      terminate();
      // Do not release the queue or delete its files while the compiler tree
      // is still closing. The fallback also covers a broken child-process pipe.
      killTimer = setTimeout(() => void finish(terminationError), 1000);
    };
    const abort = () =>
      stop(
        new CompileError("Se canceló la compilación de este programa.", 499),
      );
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(
      () =>
        stop(
          new CompileError(
            "La compilación superó su plazo. Tu código sigue guardado; vuelve a ejecutarlo.",
            408,
          ),
        ),
      timeout,
    );
    const append = (chunk: Buffer) => {
      if (done || terminationError) return;
      output += chunk.toString();
      if (output.length > 300000) {
        stop(
          new CompileError(
            "La salida del compilador superó el límite permitido.",
          ),
        );
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on(
      "error",
      () =>
        void finish(
          new CompileError(
            "Arduino CLI no está disponible. Ejecuta el instalador documentado o configura ARDUINO_CLI_PATH.",
            503,
          ),
        ),
    );
    child.on(
      "close",
      (code) =>
        void finish(
          terminationError ||
            (code === 0
              ? undefined
              : new CompileError(
                  output.slice(-30000) || "La compilación falló.",
                )),
        ),
    );
  });
}

export class ArduinoCompiler {
  private queue: CompileQueue<
    { code: string; board: ArduinoBoard; deadline: number },
    { hex: string; output: string }
  >;
  constructor(private config: Config) {
    this.queue = new CompileQueue((input, context) =>
      this.compileNow(input.code, input.board, input.deadline, context),
    );
  }
  private environment(directory?: string) {
    const env: NodeJS.ProcessEnv = {};
    for (const name of [
      "PATH",
      "Path",
      "HOME",
      "USERPROFILE",
      "APPDATA",
      "LOCALAPPDATA",
      "SystemRoot",
      "TEMP",
      "TMP",
      "ARDUINO_DIRECTORIES_DATA",
      "ARDUINO_DIRECTORIES_USER",
    ])
      if (process.env[name]) env[name] = process.env[name];
    env.ARDUINO_DIRECTORIES_DATA ||= resolve("tools/arduino-data");
    env.ARDUINO_DIRECTORIES_USER ||= resolve("tools/arduino-user");
    if (directory) env.ARDUINO_BUILD_CACHE_PATH = join(directory, "cache");
    env.ARDUINO_UPDATER_ENABLE_NOTIFICATION = "false";
    return env;
  }
  async available() {
    try {
      if (this.config.arduinoServiceUrl) {
        const response = await fetch(
          `${this.config.arduinoServiceUrl}/health`,
          {
            headers: {
              Authorization: `Bearer ${this.config.arduinoServiceToken || ""}`,
            },
            signal: AbortSignal.timeout(4000),
          },
        );
        return (
          response.ok && !!((await response.json()) as { ok?: boolean }).ok
        );
      }
      if (this.config.secureCookies && !this.config.arduinoSandbox)
        return false;
      await run(
        this.config.arduinoSandbox ? "docker" : this.config.arduinoCli,
        this.config.arduinoSandbox
          ? ["image", "inspect", "raices-arduino:local"]
          : ["core", "list"],
        5000,
        this.environment(),
      ).then((output) => {
        if (!this.config.arduinoSandbox && !output.includes("arduino:avr"))
          throw new Error("AVR core missing");
      });
      return true;
    } catch {
      return false;
    }
  }
  async compile(
    code: string,
    board: ArduinoBoard,
    options: CompileOptions = {},
  ) {
    if (!AVR_BOARD_PROFILES[board])
      throw new CompileError("La configuración de placa no es válida.", 400);
    if (!code.trim() || code.length > 60000 || code.includes("\0"))
      throw new CompileError("Código vacío, demasiado largo o inválido.", 400);
    const deadline = Math.min(
      Date.now() + COMPILE_BUDGET_MS,
      options.deadline ?? Infinity,
    );
    if (!Number.isFinite(deadline) || deadline <= Date.now())
      throw new CompileError(
        "El plazo de compilación terminó antes de comenzar. Vuelve a ejecutar tu programa.",
        408,
      );
    const key = createHash("sha256")
      .update(AVR_BOARD_PROFILES[board].fqbn)
      .update("\0")
      .update(code)
      .digest("hex");
    const budgetSignal = AbortSignal.timeout(
      Math.max(1, Math.floor(deadline - Date.now())),
    );
    const signal = options.signal
      ? AbortSignal.any([budgetSignal, options.signal])
      : budgetSignal;
    try {
      return await this.queue.run(key, { code, board, deadline }, signal);
    } catch (error) {
      // Each HTTP consumer keeps its own deadline even when it joins an
      // existing build. Its timeout must not cancel the other groups.
      if (budgetSignal.aborted && !options.signal?.aborted)
        throw new CompileError(
          "La compilación superó su plazo. Tu código sigue guardado; vuelve a ejecutarlo.",
          408,
        );
      throw error;
    }
  }
  private async compileNow(
    code: string,
    board: ArduinoBoard,
    requestedDeadline: number,
    context: CompileWorkContext,
  ) {
    // Waiting consumes the same request budget: never leave a CLI process
    // compiling long after the browser's 65-second request has expired.
    const deadline = Math.min(
      requestedDeadline,
      context.enqueuedAt + COMPILE_BUDGET_MS,
    );
    const remaining = () => {
      const timeout = deadline - Date.now();
      if (timeout <= 0)
        throw new CompileError(
          "La compilación superó su plazo. Tu código sigue guardado; vuelve a ejecutarlo.",
          408,
        );
      return timeout;
    };
    if (this.config.arduinoServiceUrl) {
      const timeoutSignal = AbortSignal.timeout(remaining());
      let response: Response;
      let result: {
        hex?: string;
        output?: string;
        error?: string;
      };
      try {
        response = await fetch(`${this.config.arduinoServiceUrl}/compile`, {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${this.config.arduinoServiceToken || ""}`,
            [COMPILE_DEADLINE_HEADER]: String(deadline),
          },
          body: JSON.stringify({ code, board }),
          signal: AbortSignal.any([timeoutSignal, context.signal]),
        });
        result = await response.json();
      } catch (error) {
        if (context.signal.aborted)
          throw new CompileError(
            "Se canceló la compilación de este programa.",
            499,
          );
        if (timeoutSignal.aborted)
          throw new CompileError(
            "La compilación superó su plazo. Tu código sigue guardado; vuelve a ejecutarlo.",
            408,
          );
        if (error instanceof SyntaxError)
          throw new CompileError(
            "El servicio de compilación devolvió una respuesta incompleta. Vuelve a ejecutar tu programa.",
            502,
          );
        throw new CompileError(
          "El servicio de compilación no está disponible. Vuelve a ejecutar tu programa.",
          503,
        );
      }
      if (!result || typeof result !== "object" || Array.isArray(result))
        throw new CompileError(
          "El servicio de compilación devolvió una respuesta inválida.",
          502,
        );
      if (!response.ok)
        throw new CompileError(
          typeof result.error === "string"
            ? result.error
            : "La compilación falló.",
          response.status,
        );
      if (
        typeof result.hex !== "string" ||
        result.hex.length > 150000 ||
        !result.hex.startsWith(":")
      )
        throw new CompileError("El servicio devolvió firmware inválido.", 502);
      return {
        hex: result.hex,
        output:
          typeof result.output === "string" ? result.output.slice(-30000) : "",
      };
    }
    if (code.length > 60000 || code.includes("\0"))
      throw new CompileError("Código demasiado largo o inválido.", 400);
    // Arduino sketches need libraries, never arbitrary server filesystem includes.
    if (!this.config.arduinoSandbox) {
      const clean = code
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/[^\n]*/g, "");
      const includes = [...clean.matchAll(/^\s*#\s*include\b([^\n]*)/gm)];
      const allowed = new Set([
        "Arduino.h",
        "DHT.h",
        "Adafruit_Sensor.h",
        "OneWire.h",
        "DallasTemperature.h",
        "Servo.h",
        "Wire.h",
        "SPI.h",
        "math.h",
      ]);
      for (const match of includes) {
        const literal = match[1].trim().match(/^[<"]([A-Za-z0-9_.]+)[>"]$/);
        if (!literal || !allowed.has(literal[1]))
          throw new CompileError(
            "Incluye únicamente las bibliotecas Arduino permitidas.",
            400,
          );
      }
      if (
        /#\s*(include_next|import|embed|pragma|line)\b|\b(__asm__?|asm)\b|_Pragma|##|\\\r?\n/i.test(
          clean,
        )
      )
        throw new CompileError(
          "Esta directiva requiere el compilador aislado Docker.",
          400,
        );
    }
    let directory: string | undefined;
    try {
      directory = await mkdtemp(join(tmpdir(), "rd-arduino-"));
      const sketch = join(directory, "Raices");
      const output = join(directory, "output");
      await mkdir(sketch);
      await mkdir(output);
      await writeFile(join(sketch, "Raices.ino"), code, "utf8");
      if (this.config.arduinoSandbox && process.platform !== "win32") {
        await chmod(directory, 0o755);
        await chmod(output, 0o777);
      }
      const fqbn = AVR_BOARD_PROFILES[board].fqbn;
      const env = this.environment(directory);
      const containerName = `raices-compile-${randomUUID()}`;
      const result = this.config.arduinoSandbox
        ? await run(
            "docker",
            [
              "run",
              "--rm",
              "--name",
              containerName,
              "--network",
              "none",
              "--read-only",
              "--cap-drop",
              "ALL",
              "--security-opt",
              "no-new-privileges",
              "--memory",
              "512m",
              "--cpus",
              "1",
              "--pids-limit",
              "128",
              "--tmpfs",
              "/tmp:rw,nosuid,size=128m",
              "--entrypoint",
              "/usr/local/bin/arduino-cli",
              "-v",
              `${directory}:/work:rw`,
              "raices-arduino:local",
              "compile",
              "--fqbn",
              fqbn,
              "--build-path",
              "/tmp/build",
              "--output-dir",
              "/work/output",
              "/work/Raices",
            ],
            remaining(),
            env,
            context.signal,
            async () => {
              try {
                await run(
                  "docker",
                  ["rm", "--force", containerName],
                  3000,
                  env,
                );
              } catch (error) {
                // --rm may already have removed this exact container.
                if (
                  !(error instanceof CompileError) ||
                  !/No such (container|object)/i.test(error.message)
                )
                  throw error;
              }
            },
          )
        : await run(
            this.config.arduinoCli,
            [
              "compile",
              "--fqbn",
              fqbn,
              "--build-path",
              join(directory, "build"),
              "--output-dir",
              output,
              sketch,
            ],
            remaining(),
            env,
            context.signal,
          );
      const files = await readdir(output);
      const hexFile = files.find(
        (file) =>
          file.endsWith(".ino.hex") && !file.includes("with_bootloader"),
      );
      if (!hexFile)
        throw new CompileError("El compilador no produjo firmware Intel HEX.");
      const hex = await readFile(join(output, basename(hexFile)), "utf8");
      if (hex.length > 150000 || !hex.startsWith(":"))
        throw new CompileError(
          "Firmware generado inválido o demasiado grande.",
        );
      return { hex, output: result.slice(-30000) };
    } finally {
      if (
        directory &&
        resolve(directory).startsWith(resolve(tmpdir()) + sep) &&
        basename(directory).startsWith("rd-arduino-")
      )
        await rm(directory, {
          recursive: true,
          force: true,
          maxRetries: 3,
          retryDelay: 100,
        });
    }
  }
}
