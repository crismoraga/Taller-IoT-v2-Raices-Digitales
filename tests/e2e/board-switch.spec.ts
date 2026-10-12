import { test, expect } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.request
    .delete("/api/session", {
      headers: { Origin: new URL(page.url()).origin },
    })
    .catch(() => {});
});

// This regression observes pixels from a real WebGL canvas: a changing title
// alone cannot prove that a controller's geometry has actually changed.
test("the controller updates in the real 3D scene and keeps the selected 2D plan without reloading", async ({
  page,
}) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Armen su equipo" });
  await dialog.getByLabel("Nombre del equipo").fill("Cambio de controlador QA");
  await dialog.getByLabel("Número de estación").selectOption("7");
  await dialog
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/taller\/welcome/);
  await page.goto("/taller/led");
  const explorer = page.getByRole("region", {
    name: "Explorador interactivo de la placa",
  });
  const board = page.getByLabel("Tu placa");
  await expect(board).toBeVisible();
  const documentMarker = await page.evaluate(() => {
    const marker = crypto.randomUUID();
    (window as Window & { boardSwitchDocument?: string }).boardSwitchDocument =
      marker;
    return marker;
  });
  const images = new Map<string, Buffer>();
  for (const selected of ["pico", "uno", "nano", "pico"]) {
    await board.selectOption(selected);
    await expect(explorer.locator(".rdx-circuit")).toHaveAttribute(
      "data-board",
      selected,
    );
    const canvas = explorer.locator("canvas");
    await canvas.scrollIntoViewIfNeeded();
    await expect(canvas).toBeVisible();
    expect(
      await canvas.evaluate((element: HTMLCanvasElement) => {
        const context = element.getContext("webgl2");
        return Boolean(context && !context.isContextLost());
      }),
    ).toBe(true);
    // Reduced motion keeps the educational scene still. Let the final frame
    // settle after the board's camera and bounds have been replaced.
    await page.waitForTimeout(350);
    const screenshot = await canvas.screenshot({ animations: "disabled" });
    if (!images.has(selected)) images.set(selected, screenshot);
  }
  expect(images.get("uno")!.equals(images.get("pico")!)).toBe(false);
  expect(images.get("nano")!.equals(images.get("uno")!)).toBe(false);
  expect(images.get("nano")!.equals(images.get("pico")!)).toBe(false);
  await explorer.getByRole("radio", { name: "Plano 2D", exact: true }).click();
  for (const selected of ["uno", "nano", "pico"]) {
    await board.selectOption(selected);
    await expect(
      explorer.getByRole("radio", { name: "Plano 2D", exact: true }),
    ).toBeChecked();
    const plan = explorer.locator('svg[role="img"]');
    await expect(plan).toBeVisible();
    await expect(plan).toHaveAttribute("data-board", selected);
    await expect(plan).toContainText(
      selected === "pico"
        ? "Raspberry Pi Pico W"
        : selected === "uno"
          ? "Arduino Uno"
          : "Arduino Nano",
    );
  }
  expect(
    await page.evaluate(
      () =>
        (window as Window & { boardSwitchDocument?: string })
          .boardSwitchDocument,
    ),
  ).toBe(documentMarker);
  expect(errors).toEqual([]);
});

test.use({ reducedMotion: "reduce" });
