import { expect, test, type Page } from "@playwright/test";

const ORIGIN = new URL(process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173")
  .origin;

test.use({ reducedMotion: "reduce" });
test.beforeEach(async ({ page }) => {
  // Source selection and accessible cards do not depend on GPU rendering.
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

async function team(page: Page) {
  const created = await page.request.post("/api/session", {
    headers: { Origin: ORIGIN },
    data: { name: "Fuentes de planta QA", groupNumber: 8 },
  });
  expect(created.ok()).toBe(true);
  const configured = await page.request.patch("/api/session", {
    headers: { Origin: ORIGIN },
    data: {
      sensorEnabled: {
        soil: true,
        soil_temperature: false,
        air_temperature: true,
        air_humidity: false,
        light: false,
        water_level: false,
        rain: false,
        distance: false,
        motion: false,
      },
    },
  });
  expect(configured.ok()).toBe(true);
}

test("automatic source selection keeps a fresh physical sensor error visible and never fills it with simulated readings", async ({
  page,
}) => {
  await team(page);
  await page.route("**/api/dashboard?**", (route) => {
    const now = Date.now();
    const latest = [
      {
        sensor: "soil",
        value: 14,
        unit: "%",
        status: "READING",
        source: "hardware",
        deviceId: "usb-uno-qa",
        timestamp: new Date(now - 10_000).toISOString(),
      },
      {
        sensor: "soil",
        value: null,
        unit: "%",
        status: "NO_RESPONSE",
        source: "hardware",
        deviceId: "usb-uno-qa",
        timestamp: new Date(now - 1_000).toISOString(),
      },
      {
        sensor: "soil",
        value: 55,
        unit: "%",
        status: "READING",
        source: "simulation",
        deviceId: "simulation",
        timestamp: new Date(now).toISOString(),
      },
      {
        sensor: "air_temperature",
        value: 25,
        unit: "°C",
        status: "READING",
        source: "simulation",
        deviceId: "simulation",
        timestamp: new Date(now).toISOString(),
      },
    ];
    return route.fulfill({
      json: { devices: [], latest, history: latest, rules: [], alerts: [] },
    });
  });
  await page.goto("/planta");
  await expect(
    page.getByRole("radio", { name: "Automática", exact: true }),
  ).toBeChecked();
  const soil = page.locator('[data-sensor="soil"]');
  const temperature = page.locator('[data-sensor="air_temperature"]');
  await expect(soil).toHaveAttribute("data-source", "hardware");
  await expect(soil.locator(".sensor-state")).toHaveText("Sin respuesta");
  await expect(soil.locator(".sensor-value")).toHaveText("—");
  await expect(temperature.locator(".sensor-state")).toHaveText("Esperando");
  await expect(temperature.locator(".sensor-value")).toHaveText("—");
  await expect(page.locator(".station-summary-status")).toContainText(
    "ESPERANDO LA PLACA",
  );
  await page.getByRole("radio", { name: "Simulación", exact: true }).click();
  await expect(soil).toHaveAttribute("data-source", "simulation");
  await expect(soil.locator(".sensor-value")).toContainText("55");
  await expect(temperature.locator(".sensor-value")).toContainText("25");
  await page.getByRole("radio", { name: "Automática", exact: true }).click();
  await expect(soil).toHaveAttribute("data-source", "hardware");
  await expect(soil.locator(".sensor-state")).toHaveText("Sin respuesta");
  await expect(soil.locator(".sensor-value")).toHaveText("—");
  await expect(temperature.locator(".sensor-value")).toHaveText("—");
});

test("old physical values are identified as history and a disabled sensor never revives its previous number", async ({
  page,
}) => {
  await team(page);
  let disabled = false;
  await page.route("**/api/dashboard?**", (route) => {
    const now = Date.now();
    const latest = [
      {
        sensor: "soil",
        value: 14,
        unit: "%",
        status: "READING",
        source: "hardware",
        deviceId: "usb-uno-qa",
        timestamp: new Date(now - 60_000).toISOString(),
      },
      ...(disabled
        ? [
            {
              sensor: "soil",
              value: null,
              unit: "%",
              status: "DISABLED",
              source: "hardware",
              deviceId: "usb-uno-qa",
              timestamp: new Date(now).toISOString(),
            },
          ]
        : []),
    ];
    return route.fulfill({
      json: { devices: [], latest, history: latest, rules: [], alerts: [] },
    });
  });
  await page.goto("/planta");
  await page.getByRole("radio", { name: "Hardware real", exact: true }).click();
  const soil = page.locator('[data-sensor="soil"]');
  await expect(soil).toHaveAttribute("data-source", "hardware");
  await expect(soil.locator(".sensor-value")).toContainText("14");
  await expect(soil.locator(".sensor-state")).toHaveText("Última lectura");
  await expect(soil.locator(".sensor-state")).not.toHaveClass(/\bgood\b/);
  await expect(page.locator(".station-summary-status")).toContainText(
    "ESPERANDO LA PLACA",
  );
  disabled = true;
  await page.reload();
  await page.getByRole("radio", { name: "Hardware real", exact: true }).click();
  await expect(soil.locator(".sensor-state")).toHaveText("Deshabilitado");
  await expect(soil.locator(".sensor-value")).toHaveText("—");
  const updated = await page.request.patch("/api/session", {
    headers: { Origin: ORIGIN },
    data: { sensorEnabled: { soil: false } },
  });
  expect(updated.ok()).toBe(true);
  await page.reload();
  await page.getByRole("radio", { name: "Hardware real", exact: true }).click();
  await expect(soil).toHaveCount(0);
});
