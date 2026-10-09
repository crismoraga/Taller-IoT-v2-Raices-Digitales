import { readFile } from "node:fs/promises";
import { test, expect, type Download, type Page } from "@playwright/test";

const ORIGIN = "http://127.0.0.1:5173";
const ESSENTIALS = ["welcome", "led", "blink", "soil", "calibration", "cloud"];

test.afterEach(async ({ page }) => {
  await page.request
    .delete("/api/session", { headers: { Origin: ORIGIN } })
    .catch(() => {});
});

async function createGroup(page: Page, name: string) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Armen su equipo" });
  await dialog.getByLabel("Nombre del equipo").fill(name);
  await dialog.getByLabel("Número de estación").selectOption("6");
  await expectFitsScreen(page);
  await dialog
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/taller\/welcome/);
}

async function seedProgress(page: Page, progress: string[]) {
  const response = await page.request.patch("/api/session", {
    headers: { Origin: ORIGIN },
    data: { progress },
  });
  expect(response.ok()).toBe(true);
}

async function phase(page: Page, name: string) {
  await page
    .getByRole("navigation", { name: "Partes de la actividad" })
    .getByRole("button", { name: new RegExp(name) })
    .click();
}

async function downloadText(download: Download) {
  const path = await download.path();
  expect(path).not.toBeNull();
  return readFile(path!, "utf8");
}

async function expectFitsScreen(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
}

test("six guided essentials close at the plant and keep extras optional on Home", async ({
  page,
}) => {
  await createGroup(page, "Cierre guiado QA");
  await seedProgress(page, ESSENTIALS.slice(0, -1));
  await page.goto("/taller/cloud");
  await phase(page, "Comprueba");
  await page
    .getByRole("checkbox", { name: /Probé la actividad en mi placa/ })
    .press("Space");
  await page
    .getByRole("button", { name: "Completar actividad", exact: true })
    .click();
  const celebration = page.getByRole("dialog", {
    name: "¡Tu ruta guiada está completa!",
  });
  await expect(celebration).toBeVisible();
  await expect(celebration).toContainText("6 de 6");
  await celebration
    .getByRole("button", { name: "Ver mi planta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/planta$/);
  const session = (await (await page.request.get("/api/session")).json())
    .session;
  expect(session.progress).toEqual(expect.arrayContaining(ESSENTIALS));

  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Demuestra lo que construiste" }),
  ).toBeVisible();
  const primary = page
    .locator(".living-hero")
    .getByRole("button", { name: "Ver mi planta", exact: true });
  await expect(primary).toBeVisible();
  await expect(page.getByRole("button", { name: /^Seguir:/ })).toHaveCount(0);
  await primary.click();
  await expect(page).toHaveURL(/\/planta$/);
});

test("free mode follows the full lesson order instead of skipping to the express LED", async ({
  page,
}) => {
  await createGroup(page, "Ruta libre QA");
  await seedProgress(page, ["welcome"]);
  await page.goto("/taller/welcome");
  await page.getByRole("radio", { name: "Libre", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Siguiente: Una luz que ya está en tu placa",
      exact: true,
    })
    .click();
  await expect(page).toHaveURL(/\/taller\/led_onboard$/);
  await page.reload();
  await expect(
    page.getByRole("radio", { name: "Libre", exact: true }),
  ).toBeChecked();
});

test("the completed final guided lesson opens the plant while free mode continues to dashboard", async ({
  page,
}) => {
  await createGroup(page, "Última actividad QA");
  await seedProgress(page, ESSENTIALS);
  await page.goto("/taller/cloud");
  await phase(page, "Comprueba");
  await page
    .getByRole("main")
    .getByRole("button", { name: "Ver mi planta", exact: true })
    .click();
  await expect(page).toHaveURL(/\/planta$/);

  await page.goto("/taller/cloud");
  await page.getByRole("radio", { name: "Libre", exact: true }).click();
  await page.getByRole("button", { name: /^Siguiente:/ }).click();
  await expect(page).toHaveURL(/\/taller\/dashboard$/);
});

for (const failure of ["network", "503"] as const) {
  test(`a quiet draft recovers from ${failure} without an online event or another edit`, async ({
    page,
  }) => {
    await createGroup(page, `Recuperación ${failure} QA`);
    await page.goto("/taller/led");
    await phase(page, "Programa");
    const input = page.locator(".monaco-editor textarea.inputarea").first();
    await expect(input).toBeVisible();
    await page.route("**/api/session", async (route) => {
      if (route.request().method() !== "PATCH") return route.continue();
      if (failure === "network") return route.abort("connectionfailed");
      return route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error: "Mantenimiento temporal QA" }),
      });
    });
    await input.focus();
    await page.keyboard.press("Control+A");
    const draft = `# Borrador pendiente ${failure}\nprint("raíces")\n`;
    await page.keyboard.insertText(draft);
    await expect(
      page.getByText(
        "Guardado en este equipo · se sincroniza al volver la red",
        { exact: true },
      ),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator(".monaco-editor").first()).toContainText(
      `Borrador pendiente ${failure}`,
    );
    expect(await page.evaluate(() => navigator.onLine)).toBe(true);

    await page.unroute("**/api/session");
    await expect
      .poll(
        async () => {
          const response = await page.request.get("/api/session");
          return (await response.json()).session?.drafts["led.python"];
        },
        { timeout: 15000 },
      )
      .toBe(draft);
    await expect(
      page.getByText("Borrador guardado", { exact: true }),
    ).toBeVisible();
  });
}

test("mobile station, diagnostics and teacher controls remain usable at 320 and 390 pixels", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 844 });
  await createGroup(page, "Móvil docente QA");
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/diagnostico");
    await expect(page.locator(".diagnostic-card")).toHaveCount(6);
    await expect(
      page.getByRole("button", { name: "Exportar diagnóstico" }),
    ).toBeVisible();
    await expectFitsScreen(page);

    await page.goto("/estacion");
    await expect(page.getByLabel("Nombre del grupo")).toHaveValue(
      "Móvil docente QA",
    );
    await expectFitsScreen(page);
    const remove = page.getByRole("button", {
      name: "Eliminar sesión",
      exact: true,
    });
    await remove.click();
    const deletion = page.getByRole("dialog", {
      name: "Eliminar el espacio de tu grupo",
    });
    await expect(
      deletion.getByRole("button", { name: "Eliminar todos mis datos" }),
    ).toBeDisabled();
    await expect(
      deletion.getByLabel("Escribe ELIMINAR para confirmar"),
    ).toBeVisible();
    await expectFitsScreen(page);
    await page.keyboard.press("Escape");
    await expect(deletion).not.toBeVisible();
    await expect(remove).toBeFocused();

    await page.goto("/profesor");
    if (width === 320) {
      await page
        .getByLabel("Contraseña docente")
        .fill(process.env.TEACHER_PASSWORD || "");
      await page.getByRole("button", { name: "Entrar al panel" }).click();
    }
    await expect(page.locator(".teacher-group")).toHaveCount(10);
    await expectFitsScreen(page);
    const inspect = page
      .locator(".teacher-group")
      .filter({ hasText: "Móvil docente QA" })
      .getByRole("button", { name: "Ver en modo lectura" });
    await inspect.click();
    const detail = page.getByRole("dialog", {
      name: "Móvil docente QA · modo lectura",
    });
    await expect(detail).toContainText("no modifica sus borradores");
    await expectFitsScreen(page);
    await page.keyboard.press("Escape");
    await expect(detail).not.toBeVisible();
    await expect(inspect).toBeFocused();
  }
  await page.getByRole("button", { name: "Cerrar sesión docente" }).click();
  expect(errors).toEqual([]);
});

test("mobile onboarding preserves Arduino and free mode through welcome and the cloud tools", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await expectFitsScreen(page);
  await page
    .getByRole("button", { name: "Comenzar taller", exact: true })
    .click();
  const onboarding = page.getByRole("dialog", { name: "Armen su equipo" });
  await onboarding.getByLabel("Nombre del equipo").fill("Arduino móvil QA");
  await onboarding.getByLabel("Placa del equipo").selectOption("uno");
  await onboarding.getByLabel("Recorrido del equipo").selectOption("full");
  await expectFitsScreen(page);
  await onboarding
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await expect(page).toHaveURL(/\/taller\/welcome$/);
  await expect(page.getByLabel("Tu placa")).toHaveValue("uno");
  await expect(
    page.getByRole("radio", { name: "Libre", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("heading", {
      name: "La protoboard y tu Arduino Uno",
      exact: true,
    }),
  ).toBeVisible();
  await expectFitsScreen(page);
  await page.goto("/taller/cloud");
  await expect(
    page.getByRole("button", { name: "Ir a Estación", exact: true }),
  ).toBeVisible();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectFitsScreen(page);
  }
  expect(errors).toEqual([]);
});

test("downloaded session and CSV contain the group's saved draft and explicit simulation readings", async ({
  page,
}) => {
  await createGroup(page, "Exportación QA");
  const draft = "# Mi planta exportada\nprint('raíces')\n";
  const response = await page.request.patch("/api/session", {
    headers: { Origin: ORIGIN },
    data: { progress: ["welcome", "led"], drafts: { "led.python": draft } },
  });
  expect(response.ok()).toBe(true);
  await page.goto("/planta");
  await page.getByRole("button", { name: "Practicar sin hardware" }).click();
  await page.getByRole("button", { name: "Enviar una lectura" }).click();
  await expect(page.locator(".sensor-card").first()).toContainText("55");
  const csvDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Exportar CSV", exact: true }).click();
  const csv = await downloadText(await csvDownload);
  expect(csv.replace(/^\uFEFF/, "")).toMatch(
    /^timestamp,deviceId,source,sensor,value,unit,status,/,
  );
  expect(csv).toContain(
    ',"simulation","simulation","soil","55","%","READING",',
  );

  await page.goto("/estacion");
  const jsonDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar mi sesión", exact: true })
    .click();
  const exported = JSON.parse(await downloadText(await jsonDownload));
  expect(exported.session.name).toBe("Exportación QA");
  expect(exported.session.progress).toEqual(["welcome", "led"]);
  expect(exported.session.drafts["led.python"]).toBe(draft);
  expect(exported.latest).toContainEqual(
    expect.objectContaining({
      sensor: "soil",
      value: 55,
      source: "simulation",
    }),
  );
  expect(exported.formatVersion).toBe(1);
  expect(exported.session).not.toHaveProperty("secret");
  expect(exported.session).not.toHaveProperty("cookie_hash");
});

test("failed CSV and session exports keep the workshop open and can be retried", async ({
  page,
}) => {
  await createGroup(page, "Exportación recuperable QA");
  for (const target of [
    { page: "/planta", endpoint: "/api/export", button: "Exportar CSV" },
    {
      page: "/estacion",
      endpoint: "/api/session/export",
      button: "Exportar mi sesión",
    },
  ]) {
    await page.goto(target.page);
    const error = `Exportación temporalmente no disponible: ${target.button}`;
    await page.route(`**${target.endpoint}`, (route) =>
      route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({ error }),
      }),
    );
    await page
      .getByRole("button", { name: target.button, exact: true })
      .click();
    await expect(page.getByText(error, { exact: true })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe(target.page);
    await expect(
      page.getByRole("button", { name: target.button, exact: true }),
    ).toBeEnabled();
    await page.unroute(`**${target.endpoint}`);
    const download = page.waitForEvent("download");
    await page
      .getByRole("button", { name: target.button, exact: true })
      .click();
    expect(await downloadText(await download)).not.toBe("");
  }
});

test("a JSON backup restores learning in a fresh session and rejects malformed files", async ({
  page,
}) => {
  await createGroup(page, "Respaldo recuperable QA");
  const draft = "# Respaldo de mi planta\nprint('raíces')\n";
  const saved = await page.request.patch("/api/session", {
    headers: { Origin: ORIGIN },
    data: {
      progress: ["welcome", "led"],
      drafts: { "led.python": draft },
      calibrations: { soil: { dry: 50000, wet: 20000 } },
      sensorEnabled: { soil: true },
    },
  });
  expect(saved.ok()).toBe(true);
  await page.goto("/estacion");
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportar mi sesión", exact: true })
    .click();
  const backup = await downloadText(await download);
  const previousId = JSON.parse(backup).session.id;
  const removed = await page.request.delete("/api/session", {
    headers: { Origin: ORIGIN },
  });
  expect(removed.ok()).toBe(true);

  await page.goto("/estacion");
  const file = page.getByLabel("Selecciona tu respaldo JSON");
  await file.setInputFiles({
    name: "respaldo-invalido.json",
    mimeType: "application/json",
    buffer: Buffer.from("{invalid JSON"),
  });
  await page
    .getByRole("button", { name: "Importar respaldo JSON", exact: true })
    .click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: /JSON|respaldo/i })
      .first(),
  ).toBeVisible();
  expect((await page.request.get("/api/session")).status()).toBe(401);
  expect(new URL(page.url()).pathname).toBe("/estacion");

  await file.setInputFiles({
    name: "raices-sesion.json",
    mimeType: "application/json",
    buffer: Buffer.from(backup),
  });
  await page
    .getByRole("button", { name: "Importar respaldo JSON", exact: true })
    .click();
  await expect(page).toHaveURL(/\/$/);
  const session = (await (await page.request.get("/api/session")).json())
    .session;
  expect(session.id).not.toBe(previousId);
  expect(session.name).toBe("Respaldo recuperable QA");
  expect(session.progress).toEqual(["welcome", "led"]);
  expect(session.drafts["led.python"]).toBe(draft);
  expect(session.calibrations.soil).toEqual({ dry: 50000, wet: 20000 });
  expect(session.sensorEnabled.soil).toBe(true);
  const dashboard = await (await page.request.get("/api/dashboard")).json();
  expect(dashboard.devices).toEqual([]);
  expect(dashboard.latest).toEqual([]);
  await page.goto("/taller/led");
  await phase(page, "Programa");
  await expect(page.locator(".monaco-editor").first()).toContainText(
    "Respaldo de mi planta",
  );
});
