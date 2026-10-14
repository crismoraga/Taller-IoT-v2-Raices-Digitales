import { expect, test, type Page } from "@playwright/test";

const ORIGIN = new URL(process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173")
  .origin;

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
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
  });
});

test.afterEach(async ({ page }) => {
  const response = await page.request.delete("/api/session", {
    headers: { Origin: ORIGIN },
  });
  expect([200, 401]).toContain(response.status());
});

async function team(page: Page) {
  const response = await page.request.post("/api/session", {
    headers: { Origin: ORIGIN },
    data: { name: "Arduino recovery QA", groupNumber: 7 },
  });
  expect(response.ok()).toBe(true);
}

async function serialPeer(page: Page, failFirstRequests = false) {
  await page.addInitScript((failFirst) => {
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let requests = 0;
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
      requestPort: async () => {
        requests++;
        if (failFirst && requests === 1)
          throw new DOMException("No port selected", "NotFoundError");
        if (failFirst && requests === 2)
          throw new DOMException("Port unavailable", "NetworkError");
        return port;
      },
    });
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: serial,
    });
    // This peer only opens the port. These stories fail before any flash write.
    void controller!;
  }, failFirstRequests);
}

async function editor(page: Page) {
  await page.goto("/taller/led_onboard");
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: /Programa/ })
    .click();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "LED_BUILTIN",
  );
  return page.locator(".monaco-editor textarea.inputarea").first();
}

test("fresh teams begin with Uno, while an existing explicit Pico choice is preserved", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const chooser = page
    .getByRole("dialog", { name: "Armen su equipo" })
    .getByLabel("Placa del equipo");
  await expect(chooser).toHaveValue("uno");
  await chooser.selectOption("pico");
  await page.reload();
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  await expect(chooser).toHaveValue("pico");
});

test("an existing group restores its last Pico program after browser preferences are cleared", async ({
  page,
}) => {
  await team(page);
  const patch = await page.request.patch("/api/session", {
    headers: { Origin: ORIGIN },
    data: {
      lastRun: {
        board: "pico",
        lessonId: "led",
        code: "print('raíces')",
        at: new Date().toISOString(),
      },
    },
  });
  expect(patch.ok()).toBe(true);
  await page.goto("/taller/led");
  await expect(
    page.getByRole("combobox", { name: "Tu placa", exact: true }),
  ).toHaveValue("pico");
});

test("cancelled USB permission and a busy Windows port both leave connection available", async ({
  page,
}) => {
  await serialPeer(page, true);
  await team(page);
  await page.goto("/taller/led_onboard");
  const connect = page
    .getByRole("button", { name: "Conectar placa", exact: true })
    .first();
  await connect.click();
  await expect(connect).toBeEnabled();
  await connect.click();
  await expect(
    page.getByText(/No se pudo abrir el puerto\. Cierra el monitor serial/),
  ).toBeVisible();
  await expect(connect).toBeEnabled();
  await connect.click();
  await expect(
    page.getByText("Placa conectada", { exact: true }),
  ).toBeVisible();
});

test("a compiler timeout keeps the edited Uno draft and offers a compiler retry without blaming USB", async ({
  page,
}) => {
  await serialPeer(page);
  await team(page);
  const attempts: string[] = [];
  await page.route("**/api/arduino/compile", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.board).toBe("uno");
    attempts.push(body.code);
    await route.fulfill({
      status: 504,
      json: { error: "El compilador agotó el tiempo de espera" },
    });
  });
  const input = await editor(page);
  const code =
    "// Borrador Uno conservado\nvoid setup(){pinMode(LED_BUILTIN,OUTPUT);digitalWrite(LED_BUILTIN,HIGH);}\nvoid loop(){}\n";
  await input.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(code);
  await page
    .getByRole("button", { name: "Conectar placa", exact: true })
    .first()
    .click();
  const load = page.getByRole("button", {
    name: "Compilar y cargar",
    exact: true,
  });
  await load.click();
  const feedback = page.getByRole("status", {
    name: "Estado de carga del programa",
  });
  await expect(feedback).toContainText("La compilación necesita otro intento");
  await expect(feedback).toContainText("Mantén la placa conectada");
  await expect(
    feedback.getByRole("button", { name: "Liberar puerto USB" }),
  ).toHaveCount(0);
  await expect(load).toBeEnabled();
  await load.click();
  await expect.poll(() => attempts.length).toBe(2);
  expect(attempts).toEqual([code, code]);
  await page.reload();
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: /Programa/ })
    .click();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "Borrador Uno conservado",
  );
});

test("an older draft response cannot mark a newer pending edit as saved", async ({
  page,
}) => {
  await team(page);
  const release: (() => void)[] = [];
  let patches = 0;
  await page.route("**/api/session", async (route) => {
    if (route.request().method() !== "PATCH") return route.continue();
    patches++;
    if (patches <= 2)
      await new Promise<void>((resolve) => release.push(resolve));
    const response = await route.fetch();
    await route.fulfill({ response });
  });
  const input = await editor(page);
  await input.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    "// Primer borrador\nvoid setup(){}\nvoid loop(){}\n",
  );
  await expect.poll(() => patches).toBe(1);
  await input.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(
    "// Último borrador\nvoid setup(){}\nvoid loop(){}\n",
  );
  // Let the second debounce enqueue while the first response is still held.
  await page.waitForTimeout(900);
  release[0]();
  await expect.poll(() => patches).toBe(2);
  await expect(page.getByText("Guardando…", { exact: true })).toBeVisible();
  release[1]();
  await expect(
    page.getByText("Borrador guardado", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "Último borrador",
  );
});
