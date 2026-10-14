import { expect, test, type Locator } from "@playwright/test";

test.use({ reducedMotion: "reduce" });

test.beforeEach(async ({ page }) => {
  // This regression concerns DOM geometry and theme preferences, not WebGL.
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

async function completeControl(group: Locator) {
  await expect(group).toBeVisible();
  const geometry = await group.evaluate((element) => {
    const group = element.getBoundingClientRect();
    const sidebar = element.closest("aside")!.getBoundingClientRect();
    return {
      insideSidebar: group.left >= sidebar.left && group.right <= sidebar.right,
      groupFits: element.scrollWidth <= element.clientWidth,
      buttons: [...element.querySelectorAll<HTMLButtonElement>("button")].map(
        (button) => {
          const box = button.getBoundingClientRect();
          const label = button.querySelector("span")!.getBoundingClientRect();
          return {
            name: button.textContent,
            insideGroup: box.left >= group.left && box.right <= group.right,
            labelFits:
              label.left >= box.left &&
              label.right <= box.right &&
              button.scrollWidth <= button.clientWidth,
            targetSize: box.width >= 44 && box.height >= 44,
          };
        },
      ),
    };
  });
  expect(geometry.insideSidebar).toBe(true);
  expect(geometry.groupFits).toBe(true);
  expect(geometry.buttons.map((button) => button.name)).toEqual([
    "Claro",
    "Oscuro",
    "Auto",
  ]);
  for (const button of geometry.buttons) {
    expect(button.insideGroup, button.name || "").toBe(true);
    expect(button.labelFits, button.name || "").toBe(true);
    expect(button.targetSize, button.name || "").toBe(true);
  }
}

test("desktop theme options fit, work with the keyboard and remember an explicit preference", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/diagnostico");
  const group = page.getByRole("radiogroup", { name: "Tema de la interfaz" });
  await completeControl(group);
  await expect(
    group.getByRole("radio", { name: "Auto", exact: true }),
  ).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await group.getByRole("radio", { name: "Claro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(
    group.getByRole("radio", { name: "Claro", exact: true }),
  ).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await group.getByRole("radio", { name: "Claro", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    group.getByRole("radio", { name: "Oscuro", exact: true }),
  ).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("End");
  await expect(
    group.getByRole("radio", { name: "Auto", exact: true }),
  ).toBeFocused();
  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.keyboard.press("Home");
  await expect(
    group.getByRole("radio", { name: "Claro", exact: true }),
  ).toBeFocused();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "24px";
  });
  await completeControl(group);
});

test("mobile menu keeps all three theme labels and controls visible at 320 pixels", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/diagnostico");
  await page.getByRole("button", { name: "Abrir menú", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Menú", exact: true });
  const group = menu.getByRole("radiogroup", { name: "Tema de la interfaz" });
  await completeControl(group);
  await group.getByRole("radio", { name: "Oscuro", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.keyboard.press("Escape");
  await expect(menu).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Abrir menú", exact: true }),
  ).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
