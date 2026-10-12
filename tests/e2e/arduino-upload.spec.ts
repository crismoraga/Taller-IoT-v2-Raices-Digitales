import { test, expect, type Page } from "@playwright/test";
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

async function avrPeer(page: Page, oldNano = false, corrupt = false) {
  await page.addInitScript(
    ({ oldNano, corrupt }) => {
      let controller: ReadableStreamDefaultController<Uint8Array>;
      let baud = 0,
        address = 0,
        held = false,
        armed = false,
        released = false;
      let writes = 0,
        readbacks = 0;
      const flash = new Uint8Array(32768).fill(255);
      const speeds: number[] = [];
      const port = {
        readable: null as ReadableStream<Uint8Array> | null,
        writable: null as WritableStream<Uint8Array> | null,
        getInfo: () =>
          oldNano
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
              if (!released || held || (oldNano && baud !== 57600)) return;
              const reply = (data: number[] = []) =>
                controller.enqueue(Uint8Array.from([0x14, ...data, 0x10]));
              if (command === 0x30) {
                // A stale application banner and fragmented ACK must not prevent sync.
                controller.enqueue(
                  new TextEncoder().encode("old sketch: 812\r\n"),
                );
                controller.enqueue(Uint8Array.of(0x14));
                setTimeout(() => controller.enqueue(Uint8Array.of(0x10)), 4);
              } else if (command === 0x75) reply([0x1e, 0x95, 0x0f]);
              else if (command === 0x55) {
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
                if (corrupt) data[0] ^= 1;
                readbacks++;
                reply(data);
              } else if (command === 0x50 || command === 0x51) reply();
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
          result: () => ({ flash: [...flash], writes, readbacks, speeds }),
        },
      });
    },
    { oldNano, corrupt },
  );
}

async function openFirstLed(page: Page, oldNano = false, corrupt = false) {
  await avrPeer(page, oldNano, corrupt);
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
    expect(body.board).toBe(oldNano ? "nano" : "uno");
    expect(body.code).toContain("digitalWrite(LED_BUILTIN, HIGH)");
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
    .selectOption(oldNano ? "nano" : "uno");
  await dialog
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/taller\/welcome/);
  await page.goto("/taller/led_onboard");
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: /Programa/ })
    .click();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "LED_BUILTIN",
  );
  await page
    .getByRole("button", { name: "Conectar placa", exact: true })
    .first()
    .click();
  if (oldNano) {
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Arduino Uno / Nano", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Arduino Nano", exact: true })
      .click();
  }
  await expect(
    page.getByText("Placa conectada", { exact: true }),
  ).toBeVisible();
  const load = page.getByRole("button", {
    name: "Compilar y cargar",
    exact: true,
  });
  await expect(load).toBeEnabled();
  await load.click();
  return () => compiledHex;
}

for (const oldNano of [false, true]) {
  test(`first integrated LED compiles real firmware and verifies every page on ${oldNano ? "old Nano" : "Uno"}`, async ({
    page,
  }) => {
    test.setTimeout(100000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    const hex = await openFirstLed(page, oldNano);
    await expect(
      page.getByRole("status", { name: "Estado de carga del programa" }),
    ).toContainText("Programa grabado y verificado", { timeout: 80000 });
    const result = await page.evaluate(() =>
      (
        window as unknown as {
          __avrPeer: {
            result: () => {
              flash: number[];
              writes: number;
              readbacks: number;
              speeds: number[];
            };
          };
        }
      ).__avrPeer.result(),
    );
    const image = parseIntelHex(hex());
    expect(image.length).toBeGreaterThan(128);
    expect(result.writes).toBe(Math.ceil(image.length / 128));
    expect(result.readbacks).toBe(result.writes);
    expect(result.flash.slice(0, image.length)).toEqual([...image]);
    await expect(
      page.getByRole("combobox", { name: "Tu placa", exact: true }),
    ).toHaveValue(oldNano ? "nano-old" : "uno");
    if (oldNano)
      expect(result.speeds).toEqual(expect.arrayContaining([115200, 57600]));
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
  await openFirstLed(page, false, true);
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
