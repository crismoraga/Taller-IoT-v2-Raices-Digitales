import { test, expect, type Page } from "@playwright/test";
import type { ArduinoBoard } from "../../shared/boards";
import { parseIntelHex } from "../../web/lib/serial";

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (
        kind === "webgl" ||
        kind === "webgl2" ||
        kind === "experimental-webgl"
      )
        return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
  });
});
const ORIGIN = process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173";
const COMPILER = "https://telematica-iot-usm.vercel.app";
let compilerCookie = "";

// Compilation is real; the browser-side AVR peer tests transport, not electricity.
test.beforeAll(async () => {
  const response = await fetch(`${COMPILER}/api/session`, {
    method: "POST",
    headers: { Origin: COMPILER, "Content-Type": "application/json" },
    body: JSON.stringify({
      name: `Arduino upload QA ${Date.now()}`,
      groupNumber: 10,
    }),
    signal: AbortSignal.timeout(60000),
  });
  expect(response.ok).toBe(true);
  compilerCookie = (response.headers.get("set-cookie") || "").split(";")[0];
  expect(compilerCookie).toMatch(/^rd_session=/);
});
test.afterAll(async () => {
  if (!compilerCookie) return;
  const response = await fetch(`${COMPILER}/api/session`, {
    method: "DELETE",
    headers: { Origin: COMPILER, Cookie: compilerCookie },
    signal: AbortSignal.timeout(60000),
  });
  expect(response.ok).toBe(true);
});
test.afterEach(async ({ page }) => {
  await page.request.delete("/api/session", { headers: { Origin: ORIGIN } });
});

type AVRPeerConfig = {
  board?: ArduinoBoard;
  bootBaud?: number;
  usbBridge?: "uno" | "ch340";
  mcu?: "atmega328p" | "atmega168";
  corruptReadback?: boolean;
};

type AVRPeerResult = {
  flash: number[];
  writes: number;
  readbacks: number;
  signatureRequests: number;
  entered: number;
  speeds: number[];
};

async function avrPeer(page: Page, config: AVRPeerConfig) {
  await page.addInitScript(
    ({ bootBaud, usbBridge, mcu, corruptReadback }) => {
      let controller: ReadableStreamDefaultController<Uint8Array>;
      let baud = 0,
        address = 0,
        held = false,
        armed = false,
        released = false;
      let writes = 0,
        readbacks = 0,
        signatureRequests = 0,
        entered = 0;
      const flash = new Uint8Array(mcu === "atmega168" ? 16384 : 32768).fill(
        255,
      );
      const speeds: number[] = [];
      const port = {
        readable: null as ReadableStream<Uint8Array> | null,
        writable: null as WritableStream<Uint8Array> | null,
        getInfo: () =>
          usbBridge === "ch340"
            ? { usbVendorId: 0x1a86, usbProductId: 0x7523 }
            : { usbVendorId: 0x2341, usbProductId: 0x0043 },
        async open(options: { baudRate: number }) {
          baud = options.baudRate;
          speeds.push(baud);
          port.readable = new ReadableStream({
            start(value) {
              controller = value;
            },
          });
          port.writable = new WritableStream({
            write(bytes: Uint8Array) {
              const command = bytes[0];
              if (!released || held || baud !== bootBaud) return;
              const reply = (data: number[] = []) =>
                controller.enqueue(Uint8Array.from([0x14, ...data, 0x10]));
              if (command === 0x30) {
                // A stale application banner and fragmented ACK must not prevent sync.
                controller.enqueue(
                  new TextEncoder().encode("old sketch: 812\r\n"),
                );
                controller.enqueue(Uint8Array.of(0x14));
                setTimeout(() => controller.enqueue(Uint8Array.of(0x10)), 4);
              } else if (command === 0x75) {
                // Reproduce the user's STK500 error: old text and an empty
                // delayed SYNC frame arrive with the real signature response.
                controller.enqueue(new TextEncoder().encode("ready\r\n"));
                controller.enqueue(Uint8Array.of(0x14, 0x10));
                signatureRequests++;
                reply(
                  mcu === "atmega168" ? [0x1e, 0x94, 0x06] : [0x1e, 0x95, 0x0f],
                );
              } else if (command === 0x55) {
                address = 2 * (bytes[1] | (bytes[2] << 8));
                reply();
              } else if (command === 0x64) {
                const count = (bytes[1] << 8) | bytes[2];
                flash.set(bytes.slice(4, 4 + count), address);
                writes++;
                reply();
              } else if (command === 0x74) {
                const count = (bytes[1] << 8) | bytes[2];
                const data = [...flash.slice(address, address + count)];
                if (corruptReadback) data[0] ^= 1;
                readbacks++;
                reply(data);
              } else if (command === 0x50) {
                entered++;
                reply();
              } else if (command === 0x51) reply();
              else throw new Error(`Unexpected AVR command ${command}`);
            },
          });
        },
        async close() {},
        async setSignals(signals: {
          dataTerminalReady?: boolean;
          requestToSend?: boolean;
        }) {
          held = !!signals.dataTerminalReady || !!signals.requestToSend;
          if (held) {
            armed = true;
            released = false;
          } else if (armed) {
            released = true;
            armed = false;
          }
        },
      };
      const serial = new EventTarget();
      Object.assign(serial, {
        requestPort: async () => port,
        getPorts: async () => [],
      });
      Object.defineProperty(navigator, "serial", {
        configurable: true,
        value: serial,
      });
      Object.assign(window, {
        __avrPeer: {
          emit: (chunks: string[]) => {
            for (const chunk of chunks)
              controller.enqueue(new TextEncoder().encode(chunk));
          },
          result: () => ({
            flash: [...flash],
            writes,
            readbacks,
            signatureRequests,
            entered,
            speeds,
          }),
        },
      });
    },
    {
      bootBaud: config.bootBaud || 115200,
      usbBridge: config.usbBridge || "uno",
      mcu: config.mcu || "atmega328p",
      corruptReadback: config.corruptReadback || false,
    },
  );
}

async function openFirstLed(
  page: Page,
  config: AVRPeerConfig = {},
  lesson: "led_onboard" | "soil" = "led_onboard",
) {
  await avrPeer(page, config);
  // A failed readiness probe must never permanently disable a working compiler.
  await page.route("**/api/health", (route) =>
    route.fulfill({
      json: {
        ok: true,
        version: "QA",
        telegramConfigured: false,
        arduinoAvailable: false,
      },
    }),
  );
  let compiledHex = "";
  await page.route("**/api/arduino/compile", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.board).toBe(config.board || "uno");
    expect(body.code).toContain(
      lesson === "soil" ? "analogRead(A0)" : "digitalWrite(LED_BUILTIN, HIGH)",
    );
    expect(body.code).not.toContain("from machine import");
    const response = await fetch(`${COMPILER}/api/arduino/compile`, {
      method: "POST",
      headers: {
        Origin: COMPILER,
        Cookie: compilerCookie,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(65000),
    });
    const result = await response.json();
    expect(response.ok).toBe(true);
    compiledHex = result.hex;
    await route.fulfill({ status: response.status, json: result });
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Armen su equipo" });
  await dialog.getByLabel("Nombre del equipo").fill("Primer LED Arduino QA");
  await dialog
    .getByLabel("Placa del equipo")
    .selectOption(config.board || "uno");
  await dialog
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/taller\/led/);
  await page.goto(`/taller/${lesson}`);
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: /Programa/ })
    .click();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    lesson === "soil" ? "analogRead(A0)" : "LED_BUILTIN",
  );
  await page
    .getByRole("button", { name: "Conectar placa", exact: true })
    .first()
    .click();
  if (config.usbBridge === "ch340") {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Arduino Nano", exact: true })
      .click();
  }
  await expect(
    page.getByText("Placa conectada", { exact: true }),
  ).toBeVisible();
  // Picking the generic Nano silhouette must preserve a specific processor
  // chosen during onboarding, even though the CH340 cannot identify its MCU.
  await expect(
    page.getByRole("combobox", { name: "Tu placa", exact: true }),
  ).toHaveValue(config.board || "uno");
  const load = page.getByRole("button", {
    name: "Compilar y cargar",
    exact: true,
  });
  await expect(load).toBeEnabled();
  await load.click();
  return () => compiledHex;
}

async function peerResult(page: Page): Promise<AVRPeerResult> {
  return page.evaluate(() =>
    (
      window as unknown as { __avrPeer: { result: () => AVRPeerResult } }
    ).__avrPeer.result(),
  );
}

test("a verified Arduino sensor upload displays fragmented JSON without empty serial scrolling", async ({
  page,
}) => {
  test.setTimeout(100000);
  await openFirstLed(page, {}, "soil");
  await expect(
    page.getByRole("status", { name: "Estado de carga del programa" }),
  ).toContainText("Programa grabado y verificado", { timeout: 80000 });
  const terminal = page.getByRole("log", { name: "Salida de la placa" });
  await expect(terminal).toContainText("Programa Arduino grabado y verificado");
  await expect(terminal).not.toContainText("Grabando y verificando");
  const baseline = await terminal.textContent();
  await page.evaluate(() => {
    (
      window as unknown as { __avrPeer: { emit: (chunks: string[]) => void } }
    ).__avrPeer.emit(["\r", "\n", " \t\r", "\n", "\r\n".repeat(100)]);
  });
  // Wait for the peer's queued reads, then compare exact text: Playwright's
  // usual text matcher collapses whitespace and would miss blank scrolling.
  await page.waitForTimeout(100);
  expect(await terminal.textContent()).toBe(baseline);
  await page.evaluate(() => {
    (
      window as unknown as { __avrPeer: { emit: (chunks: string[]) => void } }
    ).__avrPeer.emit([
      '{"sensor":"soil",',
      '"value":null,"raw":567,"unit":"%",',
      '"status":"NEEDS_CALIBRATION"}',
      "\r",
      "\n",
    ]);
  });
  await expect(terminal).toContainText('"raw":567');
  await expect
    .poll(async () => {
      const data = await (await page.request.get("/api/dashboard")).json();
      return data.latest.find(
        (reading: { sensor: string; source: string }) =>
          reading.sensor === "soil" && reading.source === "hardware",
      );
    })
    .toMatchObject({
      sensor: "soil",
      source: "hardware",
      raw: 567,
      value: null,
      status: "NEEDS_CALIBRATION",
    });
  expect((await peerResult(page)).speeds.at(-1)).toBe(115200);
});

const successCases: {
  label: string;
  config: AVRPeerConfig;
  finalBoard: ArduinoBoard;
}[] = [
  { label: "Uno", config: {}, finalBoard: "uno" },
  {
    label: "old Nano",
    config: { board: "nano", bootBaud: 57600, usbBridge: "ch340" },
    finalBoard: "nano-old",
  },
  {
    label: "Uno clone with old bootloader",
    config: { bootBaud: 57600 },
    finalBoard: "uno",
  },
  {
    label: "Nano ATmega168",
    config: {
      board: "nano-168",
      bootBaud: 19200,
      usbBridge: "ch340",
      mcu: "atmega168",
    },
    finalBoard: "nano-168",
  },
];

for (const { config, label, finalBoard } of successCases) {
  test(`first integrated LED compiles real firmware and verifies every page on ${label}`, async ({
    page,
  }) => {
    test.setTimeout(100000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const hex = await openFirstLed(page, config);
    await expect(
      page.getByRole("status", { name: "Estado de carga del programa" }),
    ).toContainText("Programa grabado y verificado", { timeout: 80000 });
    const result = await peerResult(page);
    const image = parseIntelHex(
      hex(),
      config.mcu === "atmega168" ? 14336 : 32256,
    );
    expect(image.length).toBeGreaterThan(128);
    expect(result.writes).toBe(Math.ceil(image.length / 128));
    expect(result.readbacks).toBe(result.writes);
    expect(result.flash.slice(0, image.length)).toEqual([...image]);
    await expect(
      page.getByRole("combobox", { name: "Tu placa", exact: true }),
    ).toHaveValue(finalBoard);
    if (config.bootBaud === 57600)
      expect(result.speeds).toEqual(expect.arrayContaining([115200, 57600]));
    if (config.mcu === "atmega168") {
      expect(result.flash).toHaveLength(16384);
      expect(result.speeds).toEqual([115200, 19200, 115200]);
      expect(result.signatureRequests).toBe(1);
    }
    await expect(
      page.getByRole("log", { name: "Salida de la placa" }),
    ).toContainText("Programa Arduino grabado y verificado");
    expect(errors).toEqual([]);
  });
}

test("failed flash readback keeps the failure visible and allows retry without reporting success", async ({
  page,
}) => {
  test.setTimeout(100000);
  await openFirstLed(page, { corruptReadback: true });
  await expect(
    page.getByRole("status", { name: "Estado de carga del programa" }),
  ).toContainText("La carga no se completó", { timeout: 80000 });
  const terminal = page.getByRole("log", { name: "Salida de la placa" });
  await expect(terminal).toContainText("Verificación flash falló");
  await expect(terminal).not.toContainText(
    "Programa Arduino grabado y verificado",
  );
  await expect(
    page.getByRole("button", { name: "Compilar y cargar", exact: true }),
  ).toBeEnabled();
});

test("a Nano ATmega168 selection rejects an ATmega328P before entering or writing flash", async ({
  page,
}) => {
  test.setTimeout(100000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openFirstLed(page, {
    board: "nano-168",
    bootBaud: 19200,
    usbBridge: "ch340",
    mcu: "atmega328p",
  });
  const status = page.getByRole("status", {
    name: "Estado de carga del programa",
  });
  await expect(status).toContainText("La carga no se completó", {
    timeout: 80000,
  });
  const terminal = page.getByRole("log", { name: "Salida de la placa" });
  await expect(terminal).toContainText(
    "no coincide con Arduino Nano · ATmega168",
  );
  await expect(terminal).toContainText("firma 1e 95 0f");
  await expect(terminal).not.toContainText(
    "Programa Arduino grabado y verificado",
  );
  await expect(
    page.getByRole("button", { name: "Compilar y cargar", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("combobox", { name: "Tu placa", exact: true }),
  ).toHaveValue("nano-168");
  const result = await peerResult(page);
  expect(result.signatureRequests).toBe(1);
  expect(result.entered).toBe(0);
  expect(result.writes).toBe(0);
  expect(result.readbacks).toBe(0);
  expect(result.flash.every((byte) => byte === 255)).toBe(true);
  expect(result.speeds).toEqual([115200, 19200, 115200]);
  // Error remains visible after the transport restores the ordinary serial
  // baud and the next UI update; there is no automatic incompatible replay.
  await expect(status).toContainText("La carga no se completó");
  expect(errors).toEqual([]);
});
