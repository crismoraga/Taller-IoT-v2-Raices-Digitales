import { spawn } from "node:child_process";
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
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      shell: false,
      windowsHide: true,
      detached: process.platform !== "win32",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    let done = false;
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
    const finish = (error?: Error) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(output);
    };
    const timer = setTimeout(() => {
      terminate();
      finish(
        new CompileError(
          "La operación del compilador superó su plazo permitido.",
          408,
        ),
      );
    }, timeout);
    const append = (chunk: Buffer) => {
      if (done) return;
      output += chunk.toString();
      if (output.length > 300000) {
        terminate();
        finish(
          new CompileError(
            "La salida del compilador superó el límite permitido.",
          ),
        );
      }
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("error", () =>
      finish(
        new CompileError(
          "Arduino CLI no está disponible. Ejecuta el instalador documentado o configura ARDUINO_CLI_PATH.",
          503,
        ),
      ),
    );
    child.on("close", (code) =>
      finish(
        code === 0
          ? undefined
          : new CompileError(output.slice(-30000) || "La compilación falló."),
      ),
    );
  });
}

export class ArduinoCompiler {
  private active = false;
  constructor(private config: Config) {}
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
  async compile(code: string, board: "uno" | "nano" | "nano-old") {
    if (this.config.arduinoServiceUrl) {
      const response = await fetch(`${this.config.arduinoServiceUrl}/compile`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.config.arduinoServiceToken || ""}`,
        },
        body: JSON.stringify({ code, board }),
        signal: AbortSignal.timeout(65000),
      }).catch(() => {
        throw new CompileError(
          "El servicio de compilación no está disponible.",
          503,
        );
      });
      const result = (await response.json()) as {
        hex?: string;
        output?: string;
        error?: string;
      };
      if (!response.ok)
        throw new CompileError(
          result.error || "La compilación falló.",
          response.status,
        );
      if (typeof result.hex !== "string" || !result.hex.startsWith(":"))
        throw new CompileError("El servicio devolvió firmware inválido.", 502);
      return { hex: result.hex, output: result.output || "" };
    }
    if (this.active)
      throw new CompileError(
        "Otra compilación está en curso; vuelve a intentar en unos segundos.",
        429,
      );
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
    this.active = true;
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
      const fqbn =
        board === "uno"
          ? "arduino:avr:uno"
          : `arduino:avr:nano:cpu=${board === "nano-old" ? "atmega328old" : "atmega328"}`;
      const env = this.environment(directory);
      const result = this.config.arduinoSandbox
        ? await run(
            "docker",
            [
              "run",
              "--rm",
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
            60000,
            env,
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
            60000,
            env,
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
      this.active = false;
    }
  }
}
