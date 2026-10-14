import { test, expect } from "@playwright/test";

const ORIGIN = new URL(process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173")
  .origin;
test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  // This story tests the interactive SVG and session API; the separate scene
  // audit exercises GPU rendering without making keyboard checks depend on it.
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

test("2D sensor inspection works with mouse and keyboard while the pending Arduino cable resumes unchanged", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const team = page.getByRole("dialog", { name: "Armen su equipo" });
  await team.getByLabel("Nombre del equipo").fill("Sensor 2D accesible QA");
  await team.getByLabel("Número de estación").selectOption("7");
  await team.getByLabel("Placa del equipo").selectOption("uno");
  await team
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/taller\/welcome/);
  await page.goto("/taller/soil");
  const phase = (name: string) =>
    page
      .getByRole("navigation", { name: "Partes de la actividad" })
      .getByRole("button", { name: new RegExp(name) })
      .click();
  await phase("Conecta");
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await instruction
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  const pending = await instruction.getByRole("heading").innerText();
  expect(pending).toContain("Conecta B");
  const progress = page.getByRole("progressbar", {
    name: "Avance del montaje",
  });
  const before = await progress.getAttribute("aria-valuenow");

  await phase("Entiende");
  const explorer = page.getByRole("region", {
    name: "Explorador interactivo de la placa",
  });
  await explorer.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  const sensor = explorer.getByRole("button", {
    name: "Inspeccionar Sonda de humedad de suelo",
    exact: true,
  });
  const sheet = explorer.getByRole("region", {
    name: "Ficha de Sonda de humedad de suelo",
    exact: true,
  });
  await sensor.focus();
  await expect(sensor).toBeFocused();
  await sensor.press("Enter");
  await expect(sheet).toBeVisible();
  for (const pin of ["GND", "VCC", "AOUT"])
    await expect(sheet).toContainText(pin);
  await sensor.press("Escape");
  await expect(sheet).toHaveCount(0);
  await expect(sensor).toBeFocused();
  await sensor.press("Space");
  await expect(sheet).toBeVisible();
  await sheet
    .getByRole("button", { name: "Cerrar ficha", exact: true })
    .click();
  await expect(sensor).toBeFocused();
  await sensor
    .locator('[data-sensor-shape="soil-capacitive"] > rect')
    .first()
    .click();
  await expect(sheet).toBeVisible();
  await sheet
    .getByRole("button", { name: "Cerrar ficha", exact: true })
    .click();

  await phase("Conecta");
  await expect(instruction.getByRole("heading")).toHaveText(pending);
  await expect(progress).toHaveAttribute("aria-valuenow", before!);
  await page.reload();
  await expect(instruction.getByRole("heading")).toHaveText(pending);
  await expect(progress).toHaveAttribute("aria-valuenow", before!);
  await expect(
    page.getByRole("button", { name: /^Acercar extremo B:/ }),
  ).toHaveAttribute("aria-pressed", "true");
});
