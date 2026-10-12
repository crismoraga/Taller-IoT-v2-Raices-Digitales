import { test, expect, type Page } from "@playwright/test";

test.use({ reducedMotion: "reduce" });
const ORIGIN = "http://127.0.0.1:5173";

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
  await dialog.getByLabel("Nombre del equipo").fill("Taller real QA");
  await dialog.getByLabel("Número de estación").selectOption("10");
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

test("a complete LED assembly confirms every piece and cable before the program and survives reentry", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await group(page);
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  await expect(page.locator(".rdx-circuit canvas")).toBeVisible();
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  const progress = page.getByRole("progressbar", {
    name: "Avance del montaje",
  });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  const connect = async () => {
    await instruction
      .getByRole("button", { name: "Lo tengo", exact: true })
      .click();
    await instruction
      .getByRole("button", { name: "Ya conecté A", exact: true })
      .click();
    await instruction
      .getByRole("button", { name: "Ya conecté B", exact: true })
      .click();
    await expect(
      instruction.getByRole("heading", {
        name: "¡Cable conectado!",
        exact: true,
      }),
    ).toBeVisible();
    await instruction
      .getByRole("button", { name: "Conectado, siguiente", exact: true })
      .click();
  };
  await connect();
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(instruction.getByRole("heading")).toContainText("d26");
  await expect(
    instruction.getByRole("button", { name: "Ya lo coloqué", exact: true }),
  ).toHaveCount(0);
  await instruction
    .getByRole("button", { name: "Ubicar siguiente pata", exact: true })
    .click();
  await expect(instruction.getByRole("heading")).toContainText("d27");
  await instruction
    .getByRole("button", { name: "Patas alineadas", exact: true })
    .click();
  await expect(
    instruction.getByLabel("Colocar la pieza completa"),
  ).toContainText("d26");
  await expect(
    instruction.getByLabel("Colocar la pieza completa"),
  ).toContainText("d27");
  await instruction
    .getByRole("button", { name: "Ya lo coloqué", exact: true })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", "1");
  await instruction
    .getByRole("button", { name: "Listo, siguiente", exact: true })
    .click();
  await expect(progress).toHaveAttribute("aria-valuenow", "2");
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(instruction.getByRole("heading")).toContainText("c22");
  await expect(
    instruction.getByRole("button", { name: "Ya lo coloqué", exact: true }),
  ).toHaveCount(0);
  await instruction
    .getByRole("button", { name: "Ubicar siguiente pata", exact: true })
    .click();
  await expect(instruction.getByRole("heading")).toContainText("c26");
  await instruction
    .getByRole("button", { name: "Patas alineadas", exact: true })
    .click();
  await expect(
    instruction.getByLabel("Colocar la pieza completa"),
  ).toContainText("c22");
  await expect(
    instruction.getByLabel("Colocar la pieza completa"),
  ).toContainText("c26");
  await instruction
    .getByRole("button", { name: "Ya lo coloqué", exact: true })
    .click();
  await instruction
    .getByRole("button", { name: "Listo, siguiente", exact: true })
    .click();
  await connect();
  await connect();
  await expect(progress).toHaveAttribute("aria-valuenow", "5");
  await expect(
    instruction.getByRole("heading", {
      name: "¡Tu circuito está listo!",
      exact: true,
    }),
  ).toBeVisible();
  await expect(instruction).toContainText(
    "Construiste 3 conexiones y colocaste 2 piezas, una a una.",
  );
  await instruction
    .getByRole("button", { name: "Montaje listo, continuar", exact: true })
    .click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await phase(page, "Conecta");
  await page.reload();
  await expect(
    instruction.getByRole("heading", {
      name: "¡Tu circuito está listo!",
      exact: true,
    }),
  ).toBeVisible();
  await expect(progress).toHaveAttribute("aria-valuenow", "5");
  expect(errors).toEqual([]);
});

test("switching Pico and Uno keeps their wiring journeys separate and resumes the correct pending end", async ({
  page,
}) => {
  // Several real software-rendered 3D scenes are mounted in this regression.
  test.setTimeout(90000);
  await group(page);
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await instruction
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", {
      name: "Conecta B en − · 3",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByLabel("Tu placa").selectOption("uno");
  await expect(
    instruction.getByRole("heading", {
      name: "Toma un cable negro",
      exact: true,
    }),
  ).toBeVisible();
  await instruction
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", { name: "Conecta A en GND", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Tu placa").selectOption("pico");
  await expect(
    instruction.getByRole("heading", {
      name: "Conecta B en − · 3",
      exact: true,
    }),
  ).toBeVisible();
  await page.goto("/planta");
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Conecta B en − · 3", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: "3D interactivo", exact: true })
    .click();
  await expect(page.locator(".rdx-circuit canvas")).toBeVisible();
  await expect(
    instruction.getByRole("heading", {
      name: "Conecta B en − · 3",
      exact: true,
    }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("the 3D inspector is keyboard operable and describes LED polarity and exact model terminals", async ({
  page,
}) => {
  await group(page);
  await page.goto("/taller/led");
  const explorer = page.getByRole("region", {
    name: "Explorador interactivo de la placa",
  });
  await expect(explorer.locator("canvas")).toBeVisible();
  const summary = explorer.locator("summary", {
    hasText: "Explorar piezas y conexiones",
  });
  await summary.focus();
  await page.keyboard.press("Enter");
  const select = explorer.getByLabel("Explora una pieza o un cable", {
    exact: true,
  });
  await select.focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(explorer.locator(".rdx-inspect-description")).toContainText(
    "LED rojo",
  );
  await expect(explorer.locator(".rdx-terminal-list")).toContainText(
    "anodo → d26",
  );
  await expect(explorer.locator(".rdx-terminal-list")).toContainText(
    "catodo → d27",
  );
  await expect(explorer.locator(".rdx-inspect-description")).toContainText(
    /pata larga/i,
  );
  const flow = explorer.getByRole("button", {
    name: "Recorrido ilustrativo",
    exact: true,
  });
  await flow.focus();
  await page.keyboard.press("Space");
  await expect(flow).toHaveAttribute("aria-pressed", "true");
  await expect(
    explorer.getByRole("button", { name: "Pausar recorrido", exact: true }),
  ).toBeDisabled();
  await expect(explorer.locator(".rdx-circuit-note")).toContainText(
    "no confirman que tu placa esté encendida",
  );
  await explorer
    .getByRole("button", { name: "Vista superior", exact: true })
    .click();
  await explorer
    .getByRole("button", { name: "Ver todo el montaje 3D", exact: true })
    .click();
  await explorer.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  await expect(explorer.locator("svg[role='img']").first()).toBeVisible();
  await explorer
    .getByRole("radio", { name: "Explorar en 3D", exact: true })
    .click();
  await expect(explorer.locator("canvas")).toBeVisible();
});

test("Arduino calibration accepts an ascending real reference scale and rejects values outside its ADC", async ({
  page,
}) => {
  await group(page, "uno");
  await page.goto("/estacion");
  await page.getByRole("button", { name: /^2\. Elige tus sensores/ }).click();
  await page
    .getByRole("button", { name: "Calibrar suelo y agua", exact: true })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Dos referencias. Tu propia escala.",
      exact: true,
    }),
  ).toBeVisible();
  const low = page.getByLabel("Lectura cruda «seco»", { exact: true });
  await expect(low).toHaveAttribute("max", "1023");
  await low.fill("1024");
  await expect(
    page.getByRole("button", {
      name: "Continuar a la referencia húmeda",
      exact: true,
    }),
  ).toBeDisabled();
  await low.fill("250");
  await page
    .getByRole("button", {
      name: "Continuar a la referencia húmeda",
      exact: true,
    })
    .click();
  await page.getByLabel("Lectura cruda «húmedo»", { exact: true }).fill("254");
  await page
    .getByRole("button", { name: "Ver mi escala", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Guardar calibración", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText(/necesitamos al menos 8 de diferencia/),
  ).toBeVisible();
  await page.getByRole("button", { name: "2. Húmedo", exact: true }).click();
  await page.getByLabel("Lectura cruda «húmedo»", { exact: true }).fill("850");
  await page
    .getByRole("button", { name: "Ver mi escala", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar calibración", exact: true })
    .click();
  await expect(
    page.getByText("Guardada: seco 250 · húmedo 850", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^2\. Elige tus sensores/ }).click();
  await page
    .getByRole("button", { name: "Calibrar suelo y agua", exact: true })
    .click();
  await expect(
    page.getByText("Guardada: seco 250 · húmedo 850", { exact: true }),
  ).toBeVisible();
  expect(
    (await (await page.request.get("/api/session")).json()).session.calibrations
      .soil,
  ).toEqual({ dry: 250, wet: 850, board: "uno" });
  await page.getByRole("radio", { name: "Agua · A2", exact: true }).click();
  await expect(
    page.getByLabel("Lectura cruda «vacío»", { exact: true }),
  ).toHaveValue("");
  await page.getByRole("radio", { name: "Suelo · A0", exact: true }).click();
  await expect(
    page.getByLabel("Lectura cruda «seco»", { exact: true }),
  ).toHaveValue("250");
});

test("saved Arduino references do not become Pico calibration even when their numbers fit both ADC ranges", async ({
  page,
}) => {
  await group(page, "uno");
  await page.goto("/estacion");
  await page.getByRole("button", { name: /^2\. Elige tus sensores/ }).click();
  await page
    .getByRole("button", { name: "Calibrar suelo y agua", exact: true })
    .click();
  await page.getByLabel("Lectura cruda «seco»", { exact: true }).fill("100");
  await page
    .getByRole("button", {
      name: "Continuar a la referencia húmeda",
      exact: true,
    })
    .click();
  await page.getByLabel("Lectura cruda «húmedo»", { exact: true }).fill("800");
  await page
    .getByRole("button", { name: "Ver mi escala", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Guardar calibración", exact: true })
    .click();
  await expect(
    page.getByText("Guardada: seco 100 · húmedo 800", { exact: true }),
  ).toBeVisible();
  await page.goto("/taller/led");
  await page.getByLabel("Tu placa").selectOption("pico");
  await page.goto("/estacion");
  await page.getByRole("button", { name: /^2\. Elige tus sensores/ }).click();
  await page
    .getByRole("button", { name: "Calibrar suelo y agua", exact: true })
    .click();
  const low = page.getByLabel("Lectura cruda «seco»", { exact: true });
  await expect(low).toHaveAttribute("max", "65535");
  await expect(low).toHaveValue("");
  await expect(
    page.getByText("Guardada: seco 100 · húmedo 800", { exact: true }),
  ).toHaveCount(0);
  await page.goto("/taller/led");
  await page.getByLabel("Tu placa").selectOption("uno");
  await page.goto("/estacion");
  await page.getByRole("button", { name: /^2\. Elige tus sensores/ }).click();
  await page
    .getByRole("button", { name: "Calibrar suelo y agua", exact: true })
    .click();
  await expect(
    page.getByText("Guardada: seco 100 · húmedo 800", { exact: true }),
  ).toBeVisible();
});

test("projected labels remain readable after camera moves and a lost WebGL context preserves the pending cable in 2D", async ({
  page,
}) => {
  await group(page);
  await page.goto("/taller/led");
  await phase(page, "Conecta");
  await page
    .getByRole("region", { name: "Instrucción de montaje" })
    .getByRole("button", { name: "Lo tengo", exact: true })
    .click();
  const scene = page.locator(".rdx-circuit");
  await expect(scene.locator("canvas")).toBeVisible();
  const labels = scene.locator(".rdx-terminal-overlay g[role='button'] > rect");
  const bounded = async () => {
    const canvas = await scene.locator("canvas").boundingBox();
    if (!canvas) return false;
    const boxes = await labels.evaluateAll((nodes) =>
      nodes.map((node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      }),
    );
    if (!boxes.length) return false;
    return (
      boxes.every(
        (rect) =>
          rect.x >= canvas.x - 1 &&
          rect.y >= canvas.y - 1 &&
          rect.x + rect.width <= canvas.x + canvas.width + 1 &&
          rect.y + rect.height <= canvas.y + canvas.height + 1,
      ) &&
      boxes.every((rect, index) =>
        boxes
          .slice(index + 1)
          .every(
            (other) =>
              rect.x + rect.width <= other.x ||
              other.x + other.width <= rect.x ||
              rect.y + rect.height <= other.y ||
              other.y + other.height <= rect.y,
          ),
      )
    );
  };
  await scene
    .getByRole("button", { name: "Ver todo el montaje 3D", exact: true })
    .click();
  await expect.poll(() => labels.count()).toBe(2);
  await expect.poll(bounded).toBe(true);
  await scene
    .getByRole("button", { name: "Vista superior", exact: true })
    .click();
  await expect.poll(bounded).toBe(true);
  await scene
    .getByRole("button", { name: "Acercar montaje", exact: true })
    .click();
  await expect.poll(bounded).toBe(true);
  await page.setViewportSize({ width: 1920, height: 1080 });
  await scene
    .getByRole("button", { name: "Ver todo el montaje 3D", exact: true })
    .click();
  await expect.poll(() => labels.count()).toBe(2);
  await expect.poll(bounded).toBe(true);
  await page.setViewportSize({ width: 1366, height: 768 });
  await expect.poll(bounded).toBe(true);
  // Lose a real, already-rendered GPU context: startup-only fallback does not
  // establish that an in-progress classroom assembly survives this failure.
  const lost = await scene
    .locator("canvas")
    .evaluate((canvas: HTMLCanvasElement) => {
      const context = canvas.getContext("webgl2");
      const extension = context?.getExtension("WEBGL_lose_context");
      if (!extension) return false;
      extension.loseContext();
      return true;
    });
  expect(lost).toBe(true);
  await expect(
    scene.getByText("Este navegador no dispone de WebGL. Vista 2D activa.", {
      exact: true,
    }),
  ).toBeVisible();
  await expect(scene.locator("canvas")).toHaveCount(0);
  const instruction = page.getByRole("region", {
    name: "Instrucción de montaje",
  });
  await expect(
    instruction.getByRole("heading", { name: "Conecta A en a3", exact: true }),
  ).toBeVisible();
  await scene
    .getByRole("button", { name: "Acercar extremo A: a3", exact: true })
    .click();
  await expect(instruction).toContainText("Encontraste a3 en el modelo");
  await instruction
    .getByRole("button", { name: "Ya conecté A", exact: true })
    .click();
  await expect(
    instruction.getByRole("heading", {
      name: "Conecta B en − · 3",
      exact: true,
    }),
  ).toBeVisible();
});
