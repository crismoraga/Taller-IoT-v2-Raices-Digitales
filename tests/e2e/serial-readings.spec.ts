import { expect, test, type Page } from "@playwright/test";

const ORIGIN = new URL(process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173")
  .origin;
test.use({ reducedMotion: "reduce" });

async function serialPeer(page: Page) {
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
    let controller: ReadableStreamDefaultController<Uint8Array>;
    const port = {
      readable: null as ReadableStream<Uint8Array> | null,
      writable: null as WritableStream<Uint8Array> | null,
      getInfo: () => ({ usbVendorId: 0x2341, usbProductId: 0x0043 }),
      async open() {
        port.readable = new ReadableStream({
          start(value) {
            controller = value;
          },
        });
        port.writable = new WritableStream({ write() {} });
      },
      async close() {},
      async setSignals() {},
    };
    const serial = new EventTarget();
    Object.assign(serial, {
      getPorts: async () => [],
      requestPort: async () => port,
    });
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: serial,
    });
    Object.assign(window, {
      __serialReadingsPeer: {
        emit: (chunks: string[]) => {
          for (const text of chunks)
            controller.enqueue(new TextEncoder().encode(text));
        },
      },
    });
  });
}

test.afterEach(async ({ page }) => {
  const removed = await page.request.delete("/api/session", {
    headers: { Origin: ORIGIN },
  });
  expect([200, 401]).toContain(removed.status());
});

async function openSensor(page: Page) {
  await serialPeer(page);
  const created = await page.request.post("/api/session", {
    headers: { Origin: ORIGIN },
    data: { name: "USB telemetry boundary QA", groupNumber: 7 },
  });
  expect(created.ok()).toBe(true);
  await page.goto("/taller/soil");
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: /Programa/ })
    .click();
  await page
    .getByRole("button", { name: "Conectar placa", exact: true })
    .first()
    .click();
  await expect(
    page.getByText("Placa conectada", { exact: true }),
  ).toBeVisible();
  return page.getByRole("log", { name: "Salida de la placa" });
}

test("malformed USB rows remain in the terminal while valid sensor rows keep the lesson and bridge usable", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const terminal = await openSensor(page);
  const bad = {
    sensor: "soil",
    value: 512,
    unit: "%",
    status: { error: "prueba" },
  };
  const good = {
    sensor: "soil",
    value: null,
    unit: "%",
    status: "NEEDS_CALIBRATION",
    raw: 567,
  };
  await page.evaluate(
    ({ bad, good }) => {
      const peer = (
        window as unknown as {
          __serialReadingsPeer: { emit: (chunks: string[]) => void };
        }
      ).__serialReadingsPeer;
      peer.emit([
        JSON.stringify(bad) + "\r\n",
        JSON.stringify({
          readings: [bad, good, { ...good, sensor: "light", value: {} }],
          diagnostics: { uptime: 12, nested: { bad: true } },
        }) + "\r\n",
      ]);
    },
    { bad, good },
  );
  await expect(terminal).toContainText('"status":{"error":"prueba"}');
  await expect(terminal).toContainText('"raw":567');
  await expect(page.getByText("· Por calibrar", { exact: true })).toBeVisible();
  await expect
    .poll(async () => {
      const data = await (await page.request.get("/api/dashboard")).json();
      return data.latest;
    })
    .toEqual([
      expect.objectContaining({
        sensor: "soil",
        source: "hardware",
        status: "NEEDS_CALIBRATION",
        raw: 567,
        value: null,
      }),
    ]);
  await expect(
    page.getByRole("button", { name: "Compilar y cargar", exact: true }),
  ).toBeEnabled();
  expect(errors).toEqual([]);
});

test("reading the serial history pauses automatic scrolling and can resume live output", async ({
  page,
}) => {
  const terminal = await openSensor(page);
  const emit = async (chunks: string[]) =>
    page.evaluate((chunks) => {
      (
        window as unknown as {
          __serialReadingsPeer: { emit: (chunks: string[]) => void };
        }
      ).__serialReadingsPeer.emit(chunks);
    }, chunks);
  await emit(
    Array.from({ length: 80 }, (_, index) => `Lectura real ${index}\r\n`),
  );
  await expect(terminal).toContainText("Lectura real 79");
  await expect
    .poll(() => terminal.evaluate((element) => element.scrollTop))
    .toBeGreaterThan(500);
  await terminal.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
  const resume = page.getByRole("button", {
    name: "Volver a lecturas en vivo",
  });
  await expect(resume).toBeVisible();
  await emit(["Una lectura nueva mientras leo el historial\r\n"]);
  await expect(terminal).toContainText(
    "Una lectura nueva mientras leo el historial",
  );
  expect(await terminal.evaluate((element) => element.scrollTop)).toBe(0);
  await resume.click();
  await expect(resume).not.toBeVisible();
  await emit(["Otra lectura en vivo\r\n"]);
  await expect(terminal).toContainText("Otra lectura en vivo");
  await expect
    .poll(() =>
      terminal.evaluate(
        (element) =>
          element.scrollHeight - element.scrollTop - element.clientHeight,
      ),
    )
    .toBeLessThanOrEqual(12);
  await terminal.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event("scroll"));
  });
  await expect(resume).toBeVisible();
  await page.getByRole("button", { name: "Limpiar la terminal" }).click();
  await expect(resume).not.toBeVisible();
  await expect(terminal).not.toContainText("Lectura real 79");
});
