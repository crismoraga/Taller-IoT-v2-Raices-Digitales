import { test, expect, type Page } from "@playwright/test";
test.use({ reducedMotion: "reduce" });
const ORIGIN = "http://127.0.0.1:5173";
test.afterEach(async ({ page }) => {
  await page.request
    .delete("/api/session", { headers: { Origin: ORIGIN } })
    .catch(() => {});
});
async function createGroup(page: Page, name = "Raíces QA", number = 1) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Armen su equipo" });
  await dialog.getByLabel("Nombre del equipo").fill(name);
  await dialog.getByLabel("Número de estación").selectOption(String(number));
  await dialog
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/taller\/welcome/);
}
async function phase(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}
test("living 3D home, six-step 60-minute journey, theme and narrow screens", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      /React|THREE|Unhandled|Error:/.test(message.text())
    )
      errors.push(message.text());
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Haz que tu planta hable/ }),
  ).toBeVisible();
  await expect(
    page.getByText("60 minutos · paso a paso", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "Pequeños pasos. Grandes descubrimientos.",
      exact: true,
    }),
  ).toBeVisible();
  await expect(page.getByText("Preparación", { exact: true })).toHaveCount(0);
  await expect(page.locator(".rdx-living canvas")).toBeVisible();
  await expect(page.getByText("Exploración 3D", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Planta", exact: true }).click();
  await page
    .getByLabel("Humedad de la exploración", { exact: true })
    .fill("20");
  await page.getByLabel("Luz de la exploración", { exact: true }).fill("35");
  await expect(page.locator(".rdx-experiment-controls")).toContainText("20%");
  await expect(page.locator(".rdx-experiment-controls")).toContainText("35%");
  const roots = page.getByRole("button", {
    name: "Ver raíces de la planta",
    exact: true,
  });
  await roots.click();
  await expect(roots).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "LED", exact: true }).click();
  await page.getByRole("button", { name: "Encender LED", exact: true }).click();
  await expect(page.locator(".rdx-world-feedback")).toContainText(
    "¡LED encendido!",
  );
  await expect(
    page.locator(".rdx-living").getByText("LED · encendido", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pico W", exact: true }).click();
  await page
    .getByRole("button", { name: "Enviar una señal", exact: true })
    .click();
  await expect(page.locator(".rdx-world-feedback")).toContainText(
    "humedad 20% → placa → red",
  );
  await page.getByRole("button", { name: "Red", exact: true }).click();
  await page.getByRole("button", { name: "Sensor", exact: true }).click();
  await expect(page.locator(".rdx-selection")).toContainText(
    /El sensor convierte humedad en una señal/i,
  );
  await expect(
    page.getByLabel("5 de 5 partes descubiertas", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Pausar animación", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Reanudar animación", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page
    .getByRole("button", { name: "Reanudar animación", exact: true })
    .click();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  const menu = page.getByRole("dialog");
  await expect(menu).toBeVisible();
  await menu.getByRole("radio", { name: "Oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  expect(errors).toEqual([]);
});
test("checkpoint feedback and group progress survive reload", async ({
  page,
}) => {
  await createGroup(page, "Clorofilos QA", 4);
  await page.goto("/taller/led");
  await phase(page, "Comprueba");
  const radio = page.getByRole("radiogroup", { name: /¿/ });
  await radio.getByRole("radio").nth(0).click();
  await expect(
    page.getByText("Casi. Inténtalo otra vez", { exact: true }),
  ).toBeVisible();
  await radio.getByRole("radio").nth(1).click();
  await expect(page.getByText("¡Correcto!", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Siguiente pregunta", exact: true })
    .click();
  await radio.getByRole("radio").nth(0).click();
  await page
    .getByRole("button", { name: "Siguiente pregunta", exact: true })
    .click();
  await radio.getByRole("radio").nth(2).click();
  await page
    .getByRole("button", { name: "Terminar checkpoint", exact: true })
    .click();
  await expect(page.getByText(/Checkpoint completado: 2 de 3/)).toBeVisible();
  await page
    .getByRole("button", { name: "Completar actividad", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Tu primera señal");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: /Siguiente:/ })
    .click();
  await expect(page).toHaveURL(/taller\/blink/);
  await page.reload();
  expect(
    (await (await page.request.get("/api/session")).json()).session.progress,
  ).toContain("led");
});
test("3D wiring guides one cable and one end at a time without preparation gates", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await createGroup(page);
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  await expect(
    page.getByRole("radio", { name: "3D interactivo", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".rdx-circuit canvas")).toBeVisible();
  await expect(
    instruction.getByRole("heading", {
      name: "Toma un cable negro",
      exact: true,
    }),
  ).toBeVisible();
  await expect(instruction.getByRole("checkbox")).toHaveCount(0);
  await expect(
    page.getByText("Primero, sin energía", { exact: true }),
  ).toHaveCount(0);
  const index = page.getByRole("button", { name: /Explorar los \d+ pasos/ });
  await expect(index).toHaveAttribute("aria-expanded", "false");
  await index.click();
  await expect(
    page.getByRole("button", { name: /Coloca el LED: pata larga/ }),
  ).toBeDisabled();
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", { name: "Conecta A en a3", exact: true }),
  ).toBeVisible();
  const a = instruction.getByRole("button", {
    name: "Explorar extremo A: a3",
    exact: true,
  });
  await page.getByRole("button", { name: /^Tocar extremo A: a3/ }).click();
  await expect(a).toHaveAttribute("aria-pressed", "true");
  await expect(instruction).toContainText("Encontraste a3 en el modelo");
  await expect(page.locator(".rdx-terminal-overlay")).toContainText("A · a3");
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Conecta A en a3", exact: true }),
  ).toBeVisible();
  await expect(
    instruction.getByRole("heading", { name: "Conecta A en a3", exact: true }),
  ).toBeVisible();
  await instruction
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", {
      name: "Conecta B en − · 3",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    instruction.getByRole("button", {
      name: "Explorar extremo A: a3",
      exact: true,
    }),
  ).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "3D interactivo", exact: true }),
  ).toBeChecked();
  await expect(
    instruction.getByRole("heading", {
      name: "Conecta B en − · 3",
      exact: true,
    }),
  ).toBeVisible();
  await expect(instruction.getByRole("checkbox")).toHaveCount(0);
  await instruction
    .getByRole("button", { name: "Ya conecté B", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", {
      name: "¡Cable conectado!",
      exact: true,
    }),
  ).toBeVisible();
  await expect(instruction.getByRole("status")).toContainText(
    "A: a3 → B: − · 3",
  );
  await instruction
    .getByRole("button", { name: "Conectado, siguiente", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", { name: "Toma LED rojo", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("progressbar", { name: "Avance del montaje" }),
  ).toHaveAttribute("aria-valuenow", "1");
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", { name: "Coloca LED rojo", exact: true }),
  ).toBeVisible();
  const legs = instruction.locator('[aria-label="Patas de la pieza"]');
  await expect(legs).toContainText("d26");
  await expect(legs).toContainText("d27");
  await instruction
    .getByRole("button", { name: "Ya lo coloqué", exact: true })
    .click();
  await instruction
    .getByRole("button", { name: "Listo, siguiente", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", { name: /Toma.*220/ }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/wiring-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

async function completeAssemblyConnection(page: Page) {
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  if (
    await instruction
      .getByRole("button", { name: "Ya conecté A", exact: true })
      .count()
  ) {
    await instruction
      .getByRole("button", { name: "Ya conecté A", exact: true })
      .click();
    await instruction
      .getByRole("button", { name: "Ya conecté B", exact: true })
      .click();
    await instruction
      .getByRole("button", { name: "Conectado, siguiente", exact: true })
      .click();
  } else {
    await instruction
      .getByRole("button", { name: "Ya lo coloqué", exact: true })
      .click();
    await instruction
      .getByRole("button", { name: "Listo, siguiente", exact: true })
      .click();
  }
}

test("guided code edit is undoable, persisted, restored and downloaded", async ({
  page,
}) => {
  await createGroup(page);
  await page.goto("/taller/led");
  await phase(page, "Programa");
  const editor = page.locator(".monaco-editor").first();
  await expect(editor).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Probar este cambio", exact: true })
    .first()
    .click();
  await expect(editor).toContainText("led.value(0)");
  await page.locator(".monaco-editor textarea.inputarea").first().focus();
  await page.keyboard.press("Control+Z");
  await expect(editor).toContainText("led.value(1)");
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("# Mi primera planta\n");
  await expect(
    page.getByText("Borrador guardado", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(editor).toContainText("Mi primera planta");
  await page
    .getByRole("button", { name: "Restaurar el código original", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restaurar", exact: true })
    .click();
  await expect(editor).not.toContainText("Mi primera planta");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Descargar led.py", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("led.py");
});
test("soil wiring discovers a single sensor cable and preserves its active end between 3D and 2D", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.setViewportSize({ width: 320, height: 844 });
  await createGroup(page, "Sonda cable a cable QA", 7);
  await page.goto("/taller/soil");
  await phase(page, "Conecta");
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  for (let count = 0; count < 3; count++)
    await completeAssemblyConnection(page);
  await expect(
    instruction.getByRole("heading", {
      name: "Toma un cable rojo",
      exact: true,
    }),
  ).toBeVisible();
  await expect(instruction).toContainText(
    "Un solo cable de sensor o hembra-macho rojo.",
  );
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", { name: "Conecta A en VCC", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".rdx-circuit canvas")).toBeVisible();
  await instruction
    .getByRole("button", { name: "Explorar extremo A: VCC", exact: true })
    .click();
  await expect(instruction).toContainText("Encontraste VCC en el modelo");
  await instruction
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", {
      name: "Conecta B en + · 11",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Conecta B en + · 11", exact: true }),
  ).toBeVisible();
  await expect(
    instruction.getByRole("button", {
      name: "Explorar extremo B: + · 11",
      exact: true,
    }),
  ).toBeVisible();
  const tabs = await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button")
    .evaluateAll((buttons) =>
      buttons.map((button) => {
        const box = button.getBoundingClientRect();
        return { left: box.left, right: box.right };
      }),
    );
  expect(
    tabs.every(
      (box, index) => index === 0 || box.left >= tabs[index - 1].right,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Arduino uses its real board and breadboard in 3D and 2D with guided C++ edits", async ({
  page,
}) => {
  test.setTimeout(90000);
  await createGroup(page);
  await page.goto("/taller/led");
  await page.getByLabel("Tu placa").selectOption("uno");
  await phase(page, "Conecta");
  await expect(
    page.getByRole("radio", { name: "3D interactivo", exact: true }),
  ).toBeChecked();
  await expect(page.locator(".rdx-circuit canvas")).toBeVisible();
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  await expect(
    page.getByRole("region", { name: /Modelo 3D de.*Arduino Uno/ }),
  ).toBeVisible();
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", { name: "Conecta A en GND", exact: true }),
  ).toBeVisible();
  await expect(instruction).toContainText("Arduino Uno");
  await expect(instruction.getByText("a3", { exact: true })).toHaveCount(0);
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Conecta A en GND", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByLabel("Arduino Uno: conectores reales", { exact: true }),
  ).toBeVisible();
  await instruction
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  await instruction
    .getByRole("button", { name: "Ya conecté B", exact: true })
    .click();
  await instruction
    .getByRole("button", { name: "Conectado, siguiente", exact: true })
    .click();
  await completeAssemblyConnection(page);
  await completeAssemblyConnection(page);
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", { name: "Conecta A en D2", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "3D interactivo", exact: true })
    .click();
  await expect(page.locator(".rdx-circuit canvas")).toBeVisible();
  await expect(
    instruction.getByRole("heading", { name: "Conecta A en D2", exact: true }),
  ).toBeVisible();
  await phase(page, "Programa");
  await page
    .getByRole("button", { name: "Probar este cambio", exact: true })
    .first()
    .click();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "digitalWrite(2, LOW)",
  );
  await page.reload();
  await expect(page.getByLabel("Tu placa")).toHaveValue("uno");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "digitalWrite(2, LOW)",
  );
  await phase(page, "Experimenta");
  await page
    .getByRole("button", { name: "Necesito una pista", exact: true })
    .click();
  for (
    let index = 0;
    index < 5 &&
    (await page
      .getByRole("button", { name: "Otra pista", exact: true })
      .count());
    index++
  )
    await page.getByRole("button", { name: "Otra pista", exact: true }).click();
  await page
    .getByRole("button", { name: "Ver una solución", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Cargar en el editor", exact: true })
    .click();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "delay(2000)",
  );
});
test("laboratory covers purchased sensors and real lessons", async ({
  page,
}) => {
  await page.goto("/explora");
  await expect
    .poll(() => page.locator(".experiment-card").count())
    .toBeGreaterThanOrEqual(25);
  const search = page.getByRole("textbox", { name: "Buscar experimentos" });
  for (const model of ["DHT11", "DS18B20", "FC-37", "HC-SR04", "HC-SR501"]) {
    await search.fill(model);
    await expect(page.locator(".experiment-card")).toHaveCount(1);
  }
  await search.fill("");
  await page.getByRole("radio", { name: "Sensores", exact: true }).click();
  await expect
    .poll(() => page.locator(".experiment-card").count())
    .toBeGreaterThanOrEqual(8);
  await search.fill("HC-SR04");
  await page.locator(".experiment-card").click();
  await expect(
    page.getByRole("dialog", { name: "Armen su equipo" }),
  ).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/taller\/distance/);
});
test("sensor setup, DHT toggle and calibrated soil persist", async ({
  page,
}) => {
  await createGroup(page);
  await page.goto("/estacion");
  await page.getByRole("button", { name: /^2\. Elige tus sensores/ }).click();
  await page.locator("summary", { hasText: "Más sensores del kit" }).click();
  await page
    .locator(".sensor-toggle")
    .filter({ hasText: "Temperatura del aire" })
    .click();
  await page.reload();
  await page.getByRole("button", { name: /^2\. Elige tus sensores/ }).click();
  await page.locator("summary", { hasText: "Más sensores del kit" }).click();
  await expect(
    page
      .locator(".sensor-toggle")
      .filter({ hasText: "Temperatura del aire" })
      .locator("input"),
  ).toBeChecked();
  const enabled = (await (await page.request.get("/api/session")).json())
    .session.sensorEnabled;
  expect(enabled.air_temperature).toBe(true);
  expect(enabled.air_humidity).toBe(true);
  expect(enabled).not.toHaveProperty("dht11");
  await page.getByRole("button", { name: "Calibrar suelo y agua" }).click();
  await page.getByLabel("Lectura cruda «seco»", { exact: true }).fill("50000");
  await expect(
    page.getByLabel("Lectura cruda «húmedo»", { exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", {
      name: "Continuar a la referencia húmeda",
      exact: true,
    })
    .click();
  await page
    .getByLabel("Lectura cruda «húmedo»", { exact: true })
    .fill("20000");
  await page
    .getByRole("button", { name: "Ver mi escala", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar calibración", exact: true })
    .click();
  await expect(
    page.getByText("Guardada: seco 50000 · húmedo 20000"),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/session")).json()).session.calibrations
      .soil,
  ).toEqual({ dry: 50000, wet: 20000, board: "pico" });
  await page.screenshot({
    path: "test-results/settings-desktop.png",
    fullPage: true,
  });
});
test("explicit practice telemetry crosses and recovers alerts, chart and CSV", async ({
  page,
}) => {
  await createGroup(page);
  await page.goto("/planta");
  await expect(
    page.getByText("Todo listo para tu primera lectura"),
  ).toBeVisible();
  await expect(page.locator(".rdx-living canvas")).toBeVisible();
  await expect(page.locator(".rdx-scene-eyebrow")).toContainText(
    "Lecturas de tu estación",
  );
  await expect(
    page.getByLabel("Humedad de la exploración", { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Encender LED", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Practicar sin hardware" }).click();
  await page.getByRole("button", { name: "Enviar una lectura" }).click();
  await expect(page.locator(".sensor-card").first()).toContainText("55");
  await expect(
    page.getByText("SIMULACIÓN", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.locator(".rdx-scene-eyebrow")).toContainText(
    "Simulación del dashboard",
  );
  await page.getByRole("button", { name: "Crear mi primer umbral" }).click();
  await page.getByRole("button", { name: "Guardar umbral" }).click();
  const slider = page
    .locator(".simulation-grid label")
    .filter({ hasText: "Humedad del suelo" })
    .locator("input");
  await slider.fill("15");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Enviar una lectura" }).click();
  await expect(page.locator(".alert-row").first()).toContainText(/15/);
  await slider.fill("50");
  await page.waitForTimeout(1100);
  await page.getByRole("button", { name: "Enviar una lectura" }).click();
  await expect(page.locator(".alert-row.recovered")).toHaveCount(1);
  await expect(page.locator(".history-chart svg")).toBeVisible();
  const csv = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV" }).click();
  expect((await csv).suggestedFilename()).toMatch(/\.csv$/);
  await page.getByRole("radio", { name: "Hardware real", exact: true }).click();
  await expect(page.locator(".rdx-scene-eyebrow")).toContainText(
    "Lecturas de tu estación",
  );
  await expect(page.locator(".rdx-selection")).toContainText(
    "El próximo dato de humedad aparecerá aquí.",
  );
  await expect(page.locator(".sensor-card")).toHaveCount(0);
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
});
test("diagnostics honestly checks browser and disconnected hardware", async ({
  page,
}) => {
  await page.goto("/diagnostico");
  await expect(page.locator(".diagnostic-card")).toHaveCount(6);
  await expect(
    page.locator(".diagnostic-card").filter({ hasText: "USB del navegador" }),
  ).toContainText("DISPONIBLE");
  await expect(
    page.getByRole("button", { name: "Consultar Pico" }),
  ).toBeDisabled();
  await page
    .getByText("La Pico no se conecta al Wi-Fi.", { exact: true })
    .click();
  await expect(
    page.getByText(/Usa una red 2,4 GHz sin portal cautivo/),
  ).toBeVisible();
});
test("teacher authenticates and views ten stations and read-only group", async ({
  page,
}) => {
  await createGroup(page, "Teacher QA", 2);
  await page.goto("/docente");
  await expect(page.getByLabel("Contraseña docente")).toBeVisible();
  await page.goto("/profesor");
  await page
    .getByLabel("Contraseña docente")
    .fill(process.env.TEACHER_PASSWORD || "");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión docente" }),
  ).toBeVisible();
  await expect(page.locator(".teacher-group")).toHaveCount(10);
  await page.getByRole("button", { name: "Ver grupo" }).first().click();
  await expect(page.getByRole("dialog")).toContainText(
    "no modifica sus borradores",
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.screenshot({
    path: "test-results/teacher-desktop.png",
    fullPage: true,
  });
});

test("server recovery without an online event keeps the newest draft", async ({
  page,
}) => {
  await createGroup(page, "Recuperación QA");
  await page.goto("/taller/led");
  await phase(page, "Programa");
  const input = page.locator(".monaco-editor textarea.inputarea").first();
  await expect(input).toBeVisible();
  await page.route("**/api/session", (route) =>
    route.request().method() === "PATCH"
      ? route.abort("connectionfailed")
      : route.continue(),
  );
  await input.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("# Borrador antes de recuperar\nprint(1)\n");
  await expect(
    page.getByText("Guardado en este equipo · se sincroniza al volver la red", {
      exact: true,
    }),
  ).toBeVisible();
  await page.unroute("**/api/session");
  await input.focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText("# Borrador más reciente\nprint(2)\n");
  await expect(
    page.getByText("Borrador guardado", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "Borrador más reciente",
  );
  expect(
    (await (await page.request.get("/api/session")).json()).session.drafts[
      "led.python"
    ],
  ).toContain("Borrador más reciente");
});

test("WebGL unavailable keeps accessible explanations and real 2D wiring", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (
        type === "webgl" ||
        type === "webgl2" ||
        type === "experimental-webgl"
      )
        return null;
      return Reflect.apply(getContext, this, [type, ...args]);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(
    page.getByText("Tu estación sigue siendo interactiva", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Sensor", exact: true }).click();
  await expect(page.locator(".rdx-selection")).toContainText(
    "El sensor convierte humedad en una señal",
  );
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  await expect(
    page.getByRole("radio", { name: "3D interactivo", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByText(/Este navegador no dispone de WebGL/),
  ).toBeVisible();
  await expect(
    page
      .getByRole("img", { name: /GND|Toma un cable negro|Protoboard/ })
      .first(),
  ).toBeVisible();
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  await expect(
    page
      .getByRole("img", { name: /GND|Toma un cable negro|Protoboard/ })
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Toma un cable negro", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("region", { name: "Instrucción de montaje" })
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Conecta A en a3", exact: true }),
  ).toBeVisible();
});
