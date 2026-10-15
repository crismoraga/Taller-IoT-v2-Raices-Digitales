import { expect, test, type Page } from "@playwright/test";

const ORIGIN = new URL(process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173")
  .origin;
const CORE = [
  "welcome",
  "led",
  "blink",
  "button_led",
  "ldr",
  "dht11",
  "station",
  "soil",
  "calibration",
  "dashboard",
];

test.use({ reducedMotion: "reduce" });
test.afterEach(async ({ page }) => {
  const removed = await page.request.delete("/api/session", {
    headers: { Origin: ORIGIN },
  });
  expect([200, 401]).toContain(removed.status());
});

async function usbTelemetryPeer(page: Page) {
  // Exercise DOM, Web Serial decoding and the actual session/telemetry API.
  // AVR bootloader writes and real WebGL geometry have separate regression tests.
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      kind: string,
      ...args: unknown[]
    ) {
      if (["webgl", "webgl2", "experimental-webgl"].includes(kind)) return null;
      return Reflect.apply(original, this, [kind, ...args]);
    } as typeof original;
    let incoming: ReadableStreamDefaultController<Uint8Array>;
    const port = {
      readable: null as ReadableStream<Uint8Array> | null,
      writable: null as WritableStream<Uint8Array> | null,
      getInfo: () => ({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
      async open() {
        port.readable = new ReadableStream({
          start(controller) {
            incoming = controller;
          },
        });
        port.writable = new WritableStream({ write() {} });
      },
      async close() {},
      async setSignals() {},
    };
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: Object.assign(new EventTarget(), {
        getPorts: async () => [],
        requestPort: async () => port,
      }),
    });
    Object.assign(window, {
      __plantSerial: {
        emit: (text: string) =>
          incoming.enqueue(new TextEncoder().encode(text)),
      },
    });
  });
}

async function emit(page: Page, readings: Record<string, unknown>[]) {
  await page.evaluate((readings) => {
    const peer = (
      window as unknown as { __plantSerial: { emit: (text: string) => void } }
    ).__plantSerial;
    peer.emit("\r\n\r\n");
    for (const reading of readings) peer.emit(JSON.stringify(reading) + "\r\n");
  }, readings);
}

async function phase(page: Page, label: string) {
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: new RegExp(label) })
    .click();
}

async function finish(page: Page, next: { id: string; title: string }) {
  await phase(page, "Comprueba");
  const complete = page.getByRole("button", {
    name: "Completar actividad",
    exact: true,
  });
  await expect(complete).toBeDisabled();
  await page
    .getByRole("checkbox", { name: /Probé la actividad en mi placa/ })
    .press("Space");
  await complete.click();
  const celebration = page.getByRole("dialog");
  await expect(celebration).toBeVisible();
  await celebration
    .getByRole("button", {
      name: `Siguiente: ${next.title}`,
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(new RegExp(`/taller/${next.id}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: next.title, exact: true }),
  ).toBeVisible();
}

test("Uno learners understand connections, control one LED, then build a plant station after two sensors with live USB readings", async ({
  page,
}) => {
  test.setTimeout(180000);
  await usbTelemetryPeer(page);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const team = page.getByRole("dialog", { name: "Armen su equipo" });
  await expect(team.getByLabel("Placa del equipo")).toHaveValue("uno");
  await team.getByLabel("Nombre del equipo").fill("Planta incremental Uno QA");
  await team
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/\/taller\/welcome$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Entiende las conexiones",
  );

  await phase(page, "Conecta");
  const foundation = page.getByRole("region", {
    name: "Conexiones de Arduino a la protoboard",
    exact: true,
  });
  await expect(foundation).toBeVisible();
  const nextConnection = foundation.getByRole("button", {
    name: "Siguiente conexión",
    exact: true,
  });
  await expect(nextConnection).toBeDisabled();
  await foundation
    .getByRole("button", { name: "Agujero a27", exact: true })
    .click();
  await expect(nextConnection).toBeDisabled();
  await foundation
    .getByRole("button", { name: "Agujero b26", exact: true })
    .click();
  await nextConnection.click();
  await foundation
    .getByRole("button", { name: "Agujero f26", exact: true })
    .click();
  await expect(nextConnection).toBeDisabled();
  await foundation
    .getByRole("button", { name: "Agujero a26", exact: true })
    .click();
  await nextConnection.click();
  await foundation
    .getByRole("button", { name: "Riel azul (−), número 33", exact: true })
    .click();
  await expect(nextConnection).toBeDisabled();
  await foundation
    .getByRole("button", { name: "Riel azul (−), número 31", exact: true })
    .click();
  await nextConnection.click();
  await foundation
    .getByRole("button", { name: "Pin GND", exact: true })
    .click();
  await expect(nextConnection).toBeDisabled();
  await foundation.getByRole("button", { name: "Pin D2", exact: true }).click();
  await nextConnection.click();
  await foundation
    .getByRole("button", { name: "Agujero c22", exact: true })
    .click();
  await foundation
    .getByRole("button", { name: "Terminar conexiones", exact: true })
    .click();
  await expect(foundation).toContainText("Ya entiendes las conexiones");
  await finish(page, { id: "led", title: "Enciende un LED" });

  await phase(page, "Conecta");
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  await expect(instruction.getByRole("heading")).toHaveText(
    "Toma un cable negro",
  );
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(instruction.getByRole("heading")).toHaveText("Conecta A en GND");
  await instruction
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  await expect(instruction.getByRole("heading")).toHaveText(
    "Conecta B en − · 3",
  );
  await instruction
    .getByRole("button", { name: "Ya conecté B", exact: true })
    .click();
  await expect(instruction.getByRole("heading")).toHaveText("Toma LED rojo");
  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "digitalWrite(2, HIGH)",
  );
  await page
    .getByRole("button", { name: "Probar este cambio", exact: true })
    .first()
    .click();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "digitalWrite(2, LOW)",
  );
  await finish(page, { id: "blink", title: "Hazlo parpadear" });
  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "delay(intervalo)",
  );
  await finish(page, { id: "button_led", title: "Controla el LED" });
  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "INPUT_PULLUP",
  );
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "digitalRead(4)",
  );
  await finish(page, { id: "ldr", title: "Mide la luz" });

  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "analogRead(A1)",
  );
  await page
    .getByRole("button", { name: "Conectar placa", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Placa conectada", { exact: true }),
  ).toBeVisible();
  await emit(page, [
    {
      sensor: "light",
      value: null,
      raw: 420,
      unit: "%",
      status: "NEEDS_CALIBRATION",
    },
  ]);
  await expect(
    page.getByRole("log", { name: "Salida de la placa" }),
  ).toContainText('"raw":420');
  await expect(page.getByText("· Por calibrar", { exact: true })).toBeVisible();
  await finish(page, { id: "dht11", title: "Mide temperatura y humedad" });
  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText("DHT11");
  await emit(page, [
    { sensor: "air_temperature", value: 23, unit: "°C", status: "READING" },
    { sensor: "air_humidity", value: 61, unit: "%", status: "READING" },
  ]);
  const terminal = page.getByRole("log", { name: "Salida de la placa" });
  await expect(terminal).toContainText('"air_temperature","value":23');
  await expect(terminal).toContainText('"air_humidity","value":61');
  await finish(page, { id: "station", title: "Empieza tu estación" });

  const beforeSoil = (await (await page.request.get("/api/session")).json())
    .session;
  expect(beforeSoil.progress).toEqual(expect.arrayContaining(CORE.slice(0, 6)));
  expect(beforeSoil.progress).not.toContain("soil");
  await phase(page, "Programa");
  const choices = page.getByRole("button", {
    name: "Añadir o quitar un sensor",
    exact: true,
  });
  await choices.click();
  await expect(
    page.getByRole("checkbox", { name: "Luz · LDR 5549", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Aire · DHT11", exact: true }),
  ).toBeChecked();
  for (const name of [
    "Suelo · Capacitivo v1.2",
    "Temperatura · DS18B20",
    "Lluvia · FC-37 + LM393",
    "Nivel de agua",
    "Distancia · HC-SR04",
    "Movimiento · HC-SR501",
  ])
    await expect(
      page.getByRole("checkbox", { name, exact: true }),
    ).not.toBeChecked();
  await expect(
    page.getByRole("button", {
      name: "Instalar sensores conectados",
      exact: true,
    }),
  ).toBeEnabled();
  await finish(page, { id: "soil", title: "Añade la sonda de suelo" });
  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "analogRead(A0)",
  );
  await emit(page, [
    {
      sensor: "soil",
      value: null,
      raw: 567,
      unit: "%",
      status: "NEEDS_CALIBRATION",
    },
  ]);
  await expect(
    page.getByRole("log", { name: "Salida de la placa" }),
  ).toContainText('"raw":567');
  await finish(page, { id: "calibration", title: "Calibra tu sonda" });
  await phase(page, "Programa");
  const calibrationTerminal = page.getByRole("log", {
    name: "Salida de la placa",
  });
  await emit(page, [
    {
      sensor: "soil",
      value: null,
      raw: 800,
      unit: "%",
      status: "NEEDS_CALIBRATION",
    },
  ]);
  await expect(calibrationTerminal).toContainText('"raw":800');
  await page
    .getByRole("button", { name: "Tomar lectura USB", exact: true })
    .click();
  await expect(
    page.getByLabel("Lectura cruda «húmedo»", { exact: true }),
  ).toBeVisible();
  await emit(page, [
    {
      sensor: "soil",
      value: null,
      raw: 300,
      unit: "%",
      status: "NEEDS_CALIBRATION",
    },
  ]);
  await expect(calibrationTerminal).toContainText('"raw":300');
  await page
    .getByRole("button", { name: "Tomar lectura USB", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar calibración", exact: true })
    .click();
  await expect(
    page.getByText("Guardada: seco 800 · húmedo 300", { exact: true }),
  ).toBeVisible();
  const calibrated = (await (await page.request.get("/api/session")).json())
    .session;
  expect(calibrated.calibrations.soil).toEqual({
    dry: 800,
    wet: 300,
    board: "uno",
  });
  await expect(
    page.getByLabel("Sensores que se instalarán", { exact: true }),
  ).toContainText("Suelo");
  await expect(
    page.getByRole("button", {
      name: "Actualizar estación con suelo",
      exact: true,
    }),
  ).toBeEnabled();
  await emit(page, [
    { sensor: "soil", value: 60, raw: 500, unit: "%", status: "READING" },
  ]);
  await expect(
    page.getByRole("meter", { name: "Lectura relativa del sensor" }),
  ).toHaveAttribute("aria-valuenow", "60");
  await finish(page, { id: "dashboard", title: "Monitorea tu planta" });
  await phase(page, "Comprueba");
  await page
    .getByRole("checkbox", { name: /Probé la actividad en mi placa/ })
    .press("Space");
  await page
    .getByRole("button", { name: "Completar actividad", exact: true })
    .click();
  const celebration = page.getByRole("dialog", {
    name: "¡Tu ruta guiada está completa!",
  });
  await expect(celebration).toContainText("10 de 10");
  await celebration
    .getByRole("button", { name: "Ver mi planta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/planta$/);
  await page.getByRole("radio", { name: "Hardware real", exact: true }).click();
  const temperature = page.locator('[data-sensor="air_temperature"]');
  await expect(temperature).toHaveAttribute("data-source", "hardware");
  await expect(temperature).toContainText("23");
  await expect(page.locator('[data-sensor="air_humidity"]')).toContainText(
    "61",
  );
  await expect(page.locator('[data-sensor="soil"]')).toContainText("60");
  await emit(page, [
    { sensor: "air_temperature", value: 24, unit: "°C", status: "READING" },
  ]);
  await expect(temperature).toContainText("24");
  const session = (await (await page.request.get("/api/session")).json())
    .session;
  expect(session.progress).toEqual(expect.arrayContaining(CORE));
  expect(errors).toEqual([]);
});
