import { createHash } from "node:crypto";
import { test, expect, type Locator, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });
const ORIGIN = process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173";

test.afterEach(async ({ page }) => {
  await page.request
    .delete("/api/session", { headers: { Origin: ORIGIN } })
    .catch(() => {});
});

async function group(page: Page, board = "pico") {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Armen su equipo" });
  await dialog.getByLabel("Nombre del equipo").fill("Montaje replicable QA");
  await dialog.getByLabel("Número de estación").selectOption("9");
  await dialog.getByLabel("Placa del equipo").selectOption(board);
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

function instruction(page: Page) {
  return page.getByRole("region", { name: "Instrucción de montaje" });
}

async function cable(panel: Locator, a?: string, b?: string) {
  await panel.getByRole("button", { name: "Lo tengo", exact: true }).click();
  if (a)
    await expect(
      panel.getByRole("heading", { name: `Conecta A en ${a}`, exact: true }),
    ).toBeVisible();
  await panel
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  if (b)
    await expect(
      panel.getByRole("heading", { name: `Conecta B en ${b}`, exact: true }),
    ).toBeVisible();
  await panel
    .getByRole("button", { name: "Ya conecté B", exact: true })
    .click();
  await expect(
    panel.getByRole("button", { name: "Conectado, siguiente", exact: true }),
  ).toHaveCount(0);
}

test("physical confirmation advances immediately and review returns to the last physical action without counting a connection twice", async ({
  page,
}) => {
  test.setTimeout(60000);
  await group(page, "uno");
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  const panel = instruction(page);
  const progress = page.getByRole("progressbar", {
    name: "Avance del montaje",
  });

  await cable(panel, "GND", "− · 3");
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(panel.getByRole("heading")).toHaveText("Toma LED rojo");
  await expect(panel.getByRole("status")).toHaveText("Cable negro conectado");
  await panel.getByRole("button", { name: "Revisar", exact: true }).click();
  await expect(panel.getByRole("heading")).toHaveText("Conecta B en − · 3");
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await panel
    .getByRole("button", { name: "Ya conecté B", exact: true })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await expect(panel.getByRole("heading")).toHaveText("Toma LED rojo");

  await panel.getByRole("button", { name: "Lo tengo", exact: true }).click();
  await panel
    .getByRole("button", { name: "Ubicar siguiente pata", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Patas alineadas", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Ya lo coloqué", exact: true })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  await expect(panel.getByRole("heading")).toContainText("220");
  await expect(
    panel.getByRole("button", { name: "Listo, siguiente", exact: true }),
  ).toHaveCount(0);
  await panel.getByRole("button", { name: "Revisar", exact: true }).click();
  await expect(panel.getByRole("heading")).toHaveText("Inserta LED rojo");
  await expect(panel.getByLabel("Colocar la pieza completa")).toContainText(
    "d26",
  );
  await expect(panel.getByLabel("Colocar la pieza completa")).toContainText(
    "d27",
  );
  await page.reload();
  await expect(panel.getByRole("heading")).toHaveText("Inserta LED rojo");
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  await panel
    .getByRole("button", { name: "Ya lo coloqué", exact: true })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  await expect(panel.getByRole("heading")).toContainText("220");
});

test("the visible Pico, Uno and Nano wiring follows board selection without reload and resumes each pending cable", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await group(page);
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  const panel = instruction(page);
  await panel.getByRole("button", { name: "Lo tengo", exact: true }).click();
  await expect(panel.getByRole("heading")).toContainText("Conecta A en a3");
  await panel
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  await expect(panel.getByRole("heading")).toContainText("Conecta B en − · 3");
  const renderedModels = new Map<string, string>();
  const recordModel = async (board: string) => {
    await page
      .getByRole("radio", { name: "3D interactivo", exact: true })
      .click();
    const scene = page.locator(".rdx-circuit");
    await expect(scene).toHaveAttribute("data-board", board);
    await scene
      .getByRole("button", { name: "Ver todo el montaje 3D", exact: true })
      .click();
    await scene
      .getByRole("button", { name: "Vista superior", exact: true })
      .click();
    const pixels = await scene.locator("canvas").screenshot({
      path: test.info().outputPath(`board-${board}.png`),
      style:
        ".rdx-terminal-overlay, header, nav { visibility: hidden !important; }",
    });
    const hash = createHash("sha256").update(pixels).digest("hex");
    expect([...renderedModels.values()]).not.toContain(hash);
    renderedModels.set(board, hash);
  };
  await recordModel("pico");

  for (const [board, model] of [
    ["uno", "Arduino Uno"],
    ["nano", "Arduino Nano"],
  ]) {
    // The document and current route remain mounted throughout this cycle.
    await page
      .getByRole("combobox", { name: "Tu placa", exact: true })
      .selectOption(board);
    await expect(panel.getByRole("heading")).toContainText(
      "Toma un cable negro",
    );
    const scene = page.getByRole("region", {
      name: new RegExp(`Modelo 3D de.*${model}`),
    });
    if (board === "nano") {
      await expect(
        page.getByRole("radio", { name: "Plano 2D", exact: true }),
      ).toBeChecked();
      await expect(
        page.getByLabel(`${model}: conectores reales`, { exact: true }),
      ).toBeVisible();
    }
    await recordModel(board);
    await expect(scene.locator("canvas")).toBeVisible();
    await panel.getByRole("button", { name: "Lo tengo", exact: true }).click();
    await expect(panel.getByRole("heading")).toContainText("Conecta A en GND");
    await expect(panel).toContainText(`Pin GND de ${model}`);
    await expect(scene.locator(".rdx-terminal-overlay")).toContainText(
      "A · GND",
    );
    await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
    await expect(
      page.getByLabel(`${model}: conectores reales`, { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("img", { name: "Conecta A en GND", exact: true }),
    ).toBeVisible();
    await panel
      .getByRole("button", { name: "Ya conecté A", exact: true })
      .click();
    await expect(panel.getByRole("heading")).toContainText(
      "Conecta B en − · 3",
    );
  }

  for (const board of ["pico", "uno", "nano", "pico"]) {
    await page
      .getByRole("combobox", { name: "Tu placa", exact: true })
      .selectOption(board);
    await expect(panel.getByRole("heading")).toContainText(
      "Conecta B en − · 3",
    );
    await expect(
      page.getByRole("radio", { name: "Plano 2D", exact: true }),
    ).toBeChecked();
    await expect(
      page.getByRole("img", { name: "Conecta B en − · 3", exact: true }),
    ).toBeVisible();
  }
  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText("Pin(2");
  await page
    .getByRole("combobox", { name: "Tu placa", exact: true })
    .selectOption("uno");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "digitalWrite(2",
  );
  await expect(page.locator(".monaco-editor").first()).not.toContainText(
    "from machine",
  );
  await page
    .getByRole("combobox", { name: "Tu placa", exact: true })
    .selectOption("pico");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "from machine",
  );
  await phase(page, "Conecta");
  await expect(panel.getByRole("heading")).toContainText("Conecta B en − · 3");
  await page
    .getByRole("button", {
      name: "Grupo Montaje replicable QA, ver estación",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/estacion$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/taller\/led$/);
  await expect(
    page.getByRole("combobox", { name: "Tu placa", exact: true }),
  ).toHaveValue("pico");
  await expect(panel.getByRole("heading")).toContainText("Conecta B en − · 3");
  await page.reload();
  await expect(
    page.getByRole("combobox", { name: "Tu placa", exact: true }),
  ).toHaveValue("pico");
  await expect(panel.getByRole("heading")).toContainText("Conecta B en − · 3");
  expect(errors).toEqual([]);
});

test("LED leg alignment targets one hole at a time, persists the pending leg and retains the whole completed assembly during review", async ({
  page,
}) => {
  test.setTimeout(90000);
  await group(page, "uno");
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  const panel = instruction(page);
  const progress = page.getByRole("progressbar", {
    name: "Avance del montaje",
  });
  await cable(panel, "GND", "− · 3");
  await panel.getByRole("button", { name: "Lo tengo", exact: true }).click();
  await expect(panel.getByRole("heading")).toHaveText(
    "Alinea pata larga (+) con d26",
  );
  await expect(
    panel.getByRole("button", { name: "Ya lo coloqué", exact: true }),
  ).toHaveCount(0);
  await expect(
    panel.getByRole("button", { name: /^Explorar .*: d/ }),
  ).toHaveCount(1);
  await expect(page.locator(".rdx-terminal-overlay")).toContainText("d26");
  await panel
    .getByRole("button", { name: "Ubicar siguiente pata", exact: true })
    .click();
  await expect(panel.getByRole("heading")).toHaveText(
    "Alinea pata corta (−) con d27",
  );
  await expect(panel).toContainText("lado plano del LED");
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  await expect(
    page.getByRole("img", {
      name: "Alinea pata corta (−) con d27",
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(panel.getByRole("heading")).toHaveText(
    "Alinea pata corta (−) con d27",
  );
  await expect(
    page.getByRole("radio", { name: "Plano 2D", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("img", {
      name: "Alinea pata corta (−) con d27",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "3D interactivo", exact: true })
    .click();
  await expect(page.locator(".rdx-terminal-overlay")).toContainText("d27");
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await panel
    .getByRole("button", { name: "Patas alineadas", exact: true })
    .click();
  await expect(panel.getByLabel("Colocar la pieza completa")).toContainText(
    "inserta la pieza completa",
  );
  await panel
    .getByRole("button", { name: "Ya lo coloqué", exact: true })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  await expect(panel).toContainText("Bandas: rojo, rojo, café y dorado");
  await panel.getByRole("button", { name: "Lo tengo", exact: true }).click();
  await expect(panel.getByRole("heading")).toContainText("c22");
  await panel
    .getByRole("button", { name: "Ubicar siguiente pata", exact: true })
    .click();
  await expect(panel.getByRole("heading")).toContainText("c26");
  await panel
    .getByRole("button", { name: "Patas alineadas", exact: true })
    .click();
  await panel
    .getByRole("button", { name: "Ya lo coloqué", exact: true })
    .click();
  await cable(panel);
  await cable(panel);
  await expect(progress).toHaveAttribute("aria-valuenow", "5");
  await expect(panel).toContainText("3 cables · 2 piezas colocadas");
  await panel
    .getByRole("button", { name: "Mi mapa de conexiones", exact: true })
    .click();
  const map = panel.getByLabel("Resumen del montaje");
  await expect(map).toContainText("Arduino Uno · GND");
  await expect(map).toContainText("d26");
  await expect(map).toContainText("c22");
  await page.getByRole("button", { name: /Explorar los 5 pasos/ }).click();
  await page.getByRole("button", { name: /Coloca el LED: pata larga/ }).click();
  await expect(panel.getByRole("heading")).toHaveText("Toma LED rojo");
  await page.reload();
  await expect(progress).toHaveAttribute("aria-valuenow", "5");
  await expect(panel).toContainText("3 cables · 2 piezas colocadas");
  await page.getByRole("button", { name: /Explorar los 5 pasos/ }).click();
  const steps = page.getByRole("button", {
    name: /Conecta el cable verde|Cable verde/,
  });
  await expect(steps.first()).toBeEnabled();
  for (const width of [1366, 1920, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});

test("the open station explorer keeps its 2D preference and actual board connectors through model selection and unrelated form edits", async ({
  page,
}) => {
  test.setTimeout(90000);
  await group(page);
  await page.goto("/estacion");
  await page.locator("summary", { hasText: "Modelo de placa" }).click();
  await page.locator("summary", { hasText: "explorador 3D y 2D" }).click();
  const explorer = page.getByRole("region", {
    name: "Explorador interactivo de la placa",
  });
  await explorer.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  const marker = await page.evaluate(() => {
    const value = crypto.randomUUID();
    (
      window as Window & { stationBoardDocument?: string }
    ).stationBoardDocument = value;
    return value;
  });
  for (const [board, model] of [
    ["uno", "Arduino Uno"],
    ["nano", "Arduino Nano"],
    ["pico", "Raspberry Pi Pico W"],
  ]) {
    await page
      .getByRole("combobox", { name: "Placa de trabajo", exact: true })
      .selectOption(board);
    await expect(
      explorer.getByRole("radio", { name: "Plano 2D", exact: true }),
    ).toBeChecked();
    const plan = explorer.locator('svg[role="img"]');
    await expect(plan).toHaveAttribute("data-board", board);
    await expect(plan).toContainText(model);
    if (board !== "pico")
      await expect(
        explorer.getByLabel(`${model}: conectores reales`, { exact: true }),
      ).toBeVisible();
  }
  await page
    .locator("summary", { hasText: "Nombre y número de tu grupo" })
    .click();
  await page
    .getByLabel("Nombre del grupo", { exact: true })
    .fill("Edición del grupo QA");
  await expect(
    explorer.getByRole("radio", { name: "Plano 2D", exact: true }),
  ).toBeChecked();
  await expect(explorer.locator('svg[role="img"]')).toHaveAttribute(
    "data-board",
    "pico",
  );
  expect(
    await page.evaluate(
      () =>
        (window as Window & { stationBoardDocument?: string })
          .stationBoardDocument,
    ),
  ).toBe(marker);
});
