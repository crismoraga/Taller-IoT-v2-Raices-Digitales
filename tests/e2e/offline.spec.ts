import { test, expect } from "@playwright/test";

// Exercise the built application and its service worker, not Vite's dev server.
test.use({ baseURL: "http://127.0.0.1:3001" });
test.afterEach(async ({ context, page }) => {
  await context.setOffline(false);
  await page.request.delete("/api/session", {
    headers: { Origin: "http://127.0.0.1:3001" },
  });
});

test("production cache keeps lessons and drafts offline, then syncs the authenticated group", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await expect
    .poll(() =>
      page.evaluate(() => Boolean(navigator.serviceWorker.controller)),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  await page.getByLabel("Nombre del equipo").fill("Offline QA");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/taller\/welcome/);
  await page.goto("/taller/led");
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: /Programa/ })
    .click();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Conectar placa", exact: true }).first(),
  ).toBeEnabled();
  await page.locator(".monaco-editor").first().click();
  await page.keyboard.press("Control+Home");
  await page.keyboard.type("# Guardado sin red\n");
  await expect(
    page.getByText("Guardado en este equipo · se sincroniza al volver la red", {
      exact: true,
    }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "Guardado sin red",
  );
  await context.setOffline(false);
  await expect(
    page.getByText("Borrador guardado", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const response = await page.request.get("/api/session");
      const body = await response.json();
      return body.session?.drafts["led.python"] || "";
    })
    .toContain("Guardado sin red");
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    const urls: string[] = [];
    for (const name of names) {
      for (const request of await (await caches.open(name)).keys())
        urls.push(request.url);
    }
    return urls;
  });
  expect(cached.length).toBeGreaterThan(20);
  expect(cached.some((url) => new URL(url).pathname.startsWith("/api/"))).toBe(
    false,
  );
  const guide = await page.request.get("/docs/TEACHER_GUIDE.md");
  expect(guide.ok()).toBe(true);
  expect(await guide.text()).toContain("60");
});

test("dialog traps keyboard focus and returns it to the start button", async ({
  page,
}) => {
  await page.goto("/");
  const start = page.getByRole("button", {
    name: "Comenzar taller",
    exact: true,
  });
  await start.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .focus();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Cerrar", exact: true }),
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(start).toBeFocused();
});
