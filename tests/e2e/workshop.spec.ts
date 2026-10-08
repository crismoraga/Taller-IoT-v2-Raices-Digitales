import { test, expect, type Page } from "@playwright/test";
test.afterEach(async ({ page }) => {
  await page.request
    .delete("/api/session", { headers: { Origin: "http://127.0.0.1:5173" } })
    .catch(() => {});
});
async function createGroup(page: Page, name = "Raíces QA", number = 1) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await page.getByLabel("Nombre del equipo").fill(name);
  await page.getByLabel("Número de estación").selectOption(String(number));
  await page.getByRole("button", { name: "Comenzar mi recorrido" }).click();
  await expect(page).toHaveURL(/taller\/welcome/);
}
test("home is responsive, real 3D available and no fabricated telemetry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /Pequeñas conexiones/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Comenzar el taller", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".journey-card")).toHaveCount(6);
  await expect(page.locator(".station-scene canvas")).toBeVisible();
  await page.screenshot({
    path: "test-results/home-desktop.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "test-results/home-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("anonymous group, checkpoint persistence and 2D selectable wiring", async ({
  page,
}) => {
  await createGroup(page, "Clorofilos QA", 4);
  await expect(
    page.getByRole("heading", {
      name: /Una planta. Un pequeño mundo conectado/,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "2D", exact: true }).click();
  await expect(page.locator(".wiring-scene svg")).toBeVisible();
  await page
    .getByLabel("Probé la actividad y puedo explicar qué ocurrió.")
    .check();
  await page.getByRole("button", { name: "Completar y continuar" }).click();
  await expect(page).toHaveURL(/taller\/led/);
  await page.reload();
  await expect(page.locator(".journey-number.done")).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Chrome o Edge de escritorio \+ USB/),
  ).toBeVisible();
});
test("draft auto-save, reload, restore and download works", async ({
  page,
}) => {
  await createGroup(page);
  await page.goto("/taller/led");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("# Mi primera planta\n");
  await expect(
    page.getByText("Borrador guardado", { exact: true }),
  ).toBeVisible();
  await page.waitForTimeout(1200);
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "Mi primera planta",
  );
  await page.getByRole("button", { name: "Restaurar código original" }).click();
  await expect(page.locator(".monaco-editor").first()).not.toContainText(
    "Mi primera planta",
  );
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Descargar código" }).click();
  expect((await download).suggestedFilename()).toBe("main.py");
});
test("laboratory covers all purchased sensors and search works", async ({
  page,
}) => {
  await page.goto("/laboratorio");
  await expect
    .poll(() => page.locator(".experiment-card").count())
    .toBeGreaterThanOrEqual(14);
  await page
    .getByRole("textbox", { name: "Buscar experimentos" })
    .fill("HC-SR04");
  await expect(page.locator(".experiment-card")).toHaveCount(1);
  await expect(page.locator(".experiment-card")).toContainText("HC-SR04");
  await page.getByRole("textbox", { name: "Buscar experimentos" }).fill("");
  await page.getByRole("button", { name: "Sensores", exact: true }).click();
  await expect(page.locator(".experiment-card")).toHaveCount(8);
});
test("sensor setup isolation, DHT toggle and calibrated soil persist", async ({
  page,
}) => {
  await createGroup(page);
  await page.goto("/configuracion");
  await expect(
    page.getByRole("heading", { name: "El siguiente paso: conectar." }),
  ).toBeVisible();
  await page
    .locator(".sensor-toggle")
    .filter({ hasText: "Temperatura del aire" })
    .click();
  await page.reload();
  await expect(
    page
      .locator(".sensor-toggle")
      .filter({ hasText: "Temperatura del aire" })
      .locator("input"),
  ).toBeChecked();
  await page.getByRole("button", { name: "Calibrar suelo y agua" }).click();
  await page.getByLabel("RAW seco").fill("50000");
  await page.getByLabel("RAW húmedo").fill("20000");
  await page.getByRole("button", { name: "Guardar calibración" }).click();
  await expect(
    page.getByText("Guardado: seco 50000 · húmedo 20000"),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/settings-desktop.png",
    fullPage: true,
  });
});
test("simulation is explicit, threshold crosses and recovers, history and CSV", async ({
  page,
}) => {
  await createGroup(page);
  await page.goto("/dashboard");
  await expect(
    page.getByText("Tu primera lectura está por llegar"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practicar sin hardware" }).click();
  await page.getByRole("button", { name: "Enviar una lectura" }).click();
  await expect(page.locator(".sensor-card").first()).toContainText("55");
  await expect(
    page.getByText("SIMULACIÓN", { exact: true }).first(),
  ).toBeVisible();
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
  await page.screenshot({
    path: "test-results/dashboard-desktop.png",
    fullPage: true,
  });
});
test("diagnostics uses honest browser and server checks", async ({ page }) => {
  await page.goto("/diagnostico");
  await expect(page.locator(".diagnostic-card")).toHaveCount(6);
  await expect(
    page.locator(".diagnostic-card").filter({ hasText: "Web Serial" }),
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
test("teacher authentication and read-only overview work", async ({ page }) => {
  await createGroup(page, "Teacher QA", 2);
  await page.goto("/profesor");
  await page
    .getByLabel("Contraseña docente")
    .fill(process.env.TEACHER_PASSWORD || "");
  await page.getByRole("button", { name: "Entrar al panel" }).click();
  await expect(
    page.getByRole("button", { name: "Cerrar sesión docente" }),
  ).toBeVisible();
  await expect(page.locator(".teacher-group")).toHaveCount(10);
  await page
    .getByRole("button", { name: "Ver en modo lectura" })
    .first()
    .click();
  await expect(page.getByRole("dialog")).toContainText(
    "no modifica sus borradores",
  );
  await page.getByRole("button", { name: "Cerrar", exact: true }).click();
  await page.screenshot({
    path: "test-results/teacher-desktop.png",
    fullPage: true,
  });
});
