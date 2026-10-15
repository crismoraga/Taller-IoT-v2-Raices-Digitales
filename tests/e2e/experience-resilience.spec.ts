import { readFile } from "node:fs/promises";
import { test, expect, type Locator, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

const ORIGIN = new URL(process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173")
  .origin;

// These stories verify DOM interaction and the actual session API. The separate
// visual suite exercises real WebGL, without making these keyboard tests use GPU.
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

test.afterEach(async ({ page }) => {
  const response = await page.request.delete("/api/session", {
    headers: { Origin: ORIGIN },
  });
  // A failed test may have stopped before creating its group. Fresh contexts
  // ensure this deletion can only affect the group created by that test.
  expect([200, 401]).toContain(response.status());
});

async function createTeam(page: Page, name: string) {
  const response = await page.request.post("/api/session", {
    headers: { Origin: ORIGIN },
    data: { name, groupNumber: 8 },
  });
  expect(response.ok()).toBe(true);
  const { session } = await response.json();
  expect(session.name).toBe(name);
}

async function openTeamForm(page: Page) {
  const start = page.getByRole("button", {
    name: "Comenzar taller",
    exact: true,
  });
  await start.click();
  const dialog = page.getByRole("dialog", { name: "Armen su equipo" });
  await expect(dialog).toBeVisible();
  return { start, dialog };
}

async function phase(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}

async function expectCompletedSoil(
  progress: Locator,
  tone: "success" | "accent",
) {
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(progress).toHaveAttribute("aria-valuetext", "1 de 10");
  const segments = progress.locator(":scope > span");
  await expect(segments).toHaveCount(10);
  // The eighth activity is complete; coloring the first segment would falsely
  // claim that the skipped LED activity had already been completed.
  await expect(segments.nth(7)).toHaveClass(new RegExp(`\\bbg-${tone}\\b`));
  for (const index of [0, 1, 2, 3, 4, 5, 6, 8, 9])
    await expect(segments.nth(index)).not.toHaveClass(
      new RegExp(`\\bbg-${tone}\\b`),
    );
}

test("team creation focuses the name, keeps keyboard focus inside and returns to the opener with Escape", async ({
  page,
}) => {
  await page.goto("/");
  const { start, dialog } = await openTeamForm(page);
  const name = dialog.getByLabel("Nombre del equipo");
  await expect(name).toBeFocused();

  for (const key of ["Tab", "Shift+Tab"]) {
    for (let index = 0; index < 8; index++) {
      await page.keyboard.press(key);
      await expect
        .poll(() =>
          dialog.evaluate((element) =>
            element.contains(document.activeElement),
          ),
        )
        .toBe(true);
    }
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(start).toBeFocused();
  expect(
    await page.evaluate(() => document.documentElement.style.overflow),
  ).toBe("");

  await start.click();
  await expect(name).toBeFocused();
  await name.fill("Equipo teclado QA");
  await dialog
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/\/taller\/welcome$/);
  const response = await page.request.get("/api/session");
  expect(response.ok()).toBe(true);
  expect((await response.json()).session.name).toBe("Equipo teclado QA");
});

test("a group completing soil out of order sees the correct activity in both progress bars after reload", async ({
  page,
}) => {
  await createTeam(page, "Avance fuera de orden QA");
  const response = await page.request.patch("/api/session", {
    headers: { Origin: ORIGIN },
    data: { progress: ["soil"] },
  });
  expect(response.ok()).toBe(true);
  expect((await response.json()).session.progress).toEqual(["soil"]);

  await page.goto("/");
  for (let load = 0; load < 2; load++) {
    await expectCompletedSoil(
      page.getByRole("progressbar", { name: "Avance de tu ruta", exact: true }),
      "success",
    );
    await expectCompletedSoil(
      page.getByRole("progressbar", {
        name: "Avance de la ruta guiada",
        exact: true,
      }),
      "accent",
    );
    const activities = page.getByRole("list", {
      name: "Actividades de la ruta guiada",
    });
    await expect(activities.getByRole("listitem").nth(7)).toContainText(
      "Completada",
    );
    await expect(
      activities.getByRole("listitem").nth(0).getByRole("button"),
    ).toHaveAttribute("aria-current", "step");
    if (load === 0) await page.reload();
  }
});

test("Spanish kit searches accept spaces and missing accents while clearing preserves keyboard focus", async ({
  page,
}) => {
  await createTeam(page, "Búsqueda del kit QA");
  await page.goto("/explora");
  const search = page.getByRole("textbox", { name: "Buscar experimentos" });
  const cards = page.locator(".experiment-card");
  await expect(search).toBeVisible();
  await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(25);
  const total = await cards.count();

  await search.fill("   DHT11   ");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("DHT11");
  await search.fill("señal");
  await expect.poll(() => cards.count()).toBeGreaterThan(0);
  const accented = await cards.count();
  await search.fill("senal");
  await expect(cards).toHaveCount(accented);

  await search.press("Escape");
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(cards).toHaveCount(total);
  await search.fill("DHT11");
  await page
    .getByRole("button", { name: "Limpiar búsqueda", exact: true })
    .click();
  await expect(search).toHaveValue("");
  await expect(search).toBeFocused();
  await expect(cards).toHaveCount(total);

  await page.setViewportSize({ width: 320, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("Nano ATmega168 chosen at onboarding keeps its 2D plan and offers the Arduino integrated LED sketch", async ({
  page,
}) => {
  test.setTimeout(75000);
  await page.goto("/");
  const { dialog } = await openTeamForm(page);
  await dialog
    .getByLabel("Nombre del equipo")
    .fill("Nano ATmega168 interfaz QA");
  await dialog.getByLabel("Placa del equipo").selectOption({
    label: "Arduino Nano · ATmega168",
  });
  await dialog
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/\/taller\/welcome$/);
  // The connections activity preserves the selected controller and view.
  await page.goto("/taller/welcome");
  await expect(page.getByLabel("Tu placa")).toHaveValue("nano-168");
  await phase(page, "Conecta");
  await expect(
    page.getByRole("heading", {
      name: "Conoce tu Arduino Nano · ATmega168",
      exact: true,
    }),
  ).toBeVisible();
  const explorer = page.getByRole("region", {
    name: "Explorador interactivo de la placa",
  });
  const planOption = explorer.getByRole("radio", {
    name: "Plano 2D",
    exact: true,
  });
  await planOption.click();
  const plan = explorer.locator('svg[role="img"]');
  await expect(plan).toHaveAttribute("data-board", "nano-168");
  await expect(plan).toContainText("Arduino Nano");
  await page.getByLabel("Tu placa").selectOption("nano");
  await page.reload();
  await expect(planOption).toBeChecked();
  await page.getByLabel("Tu placa").selectOption("nano-168");
  await expect(planOption).toBeChecked();
  await expect(plan).toHaveAttribute("data-board", "nano-168");

  await page.goto("/taller/led_onboard");
  await expect(page.getByLabel("Tu placa")).toHaveValue("nano-168");
  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "LED_BUILTIN",
  );
  await page.locator("summary", { hasText: "Opciones del editor" }).click();
  const downloadReady = page.waitForEvent("download");
  await page
    .getByRole("button", {
      name: "Descargar led_onboard.ino",
      exact: true,
    })
    .click();
  const download = await downloadReady;
  expect(download.suggestedFilename()).toBe("led_onboard.ino");
  const path = await download.path();
  expect(path).not.toBeNull();
  const firmware = await readFile(path!, "utf8");
  expect(firmware).toContain("pinMode(LED_BUILTIN, OUTPUT)");
  expect(firmware).toContain("digitalWrite(LED_BUILTIN, HIGH)");
  expect(firmware).not.toContain("from machine import");
});
