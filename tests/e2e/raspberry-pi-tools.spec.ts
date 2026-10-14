import { expect, test } from "@playwright/test";

const ORIGIN = new URL(process.env.RD_E2E_ORIGIN || "http://127.0.0.1:5173")
  .origin;
test.use({ reducedMotion: "reduce" });
test.afterEach(async ({ page }) => {
  const response = await page.request.delete("/api/session", {
    headers: { Origin: ORIGIN },
  });
  expect([200, 401]).toContain(response.status());
});

test("optional Raspberry Pi GPIO checks show real header pins and downloads without replacing Arduino", async ({
  page,
}) => {
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
  const created = await page.request.post("/api/session", {
    headers: { Origin: ORIGIN },
    data: { name: "Pi optional checks QA", groupNumber: 8 },
  });
  expect(created.ok()).toBe(true);
  await page.goto("/estacion");
  const tools = page
    .locator("details")
    .filter({
      has: page.locator("summary", {
        hasText: "Raspberry Pi 3 / 4 · comprobar sensores · opcional",
      }),
    })
    .first();
  await expect(tools).not.toHaveAttribute("open", "");
  await tools.locator("summary").first().click();
  await expect(tools).toContainText("sin Arduino");
  const choice = tools.getByLabel("Sensor para Raspberry Pi");
  await expect(choice).toHaveValue("dht11");
  await expect(tools).toContainText("BCM22 · pin físico 15");
  await expect(tools.locator("code").first()).toHaveText(
    ".venv/bin/python check_sensors.py --sensor dht11",
  );
  await choice.selectOption("ds18b20");
  await expect(tools).toContainText("BCM4 · pin físico 7");
  await expect(tools.locator("code").first()).toHaveText(
    "python3 check_sensors.py --sensor ds18b20",
  );
  await choice.selectOption("soil");
  await expect(tools).toContainText("La Pi no tiene entradas analógicas");
  await expect(tools).toContainText("CH0 del MCP3008");
  await expect(tools.locator("code").first()).toHaveText(
    "python3 check_sensors.py --sensor soil --adc mcp3008",
  );
  for (const path of [
    "/downloads/check_sensors.py",
    "/downloads/raspberry-pi-bridge.py",
  ]) {
    const downloaded = await page.request.get(path);
    expect(downloaded.status()).toBe(200);
    expect(await downloaded.text()).toMatch(/^#!\/usr\/bin\/env python3/);
  }
  await page.goto("/taller/led");
  await expect(page.getByLabel("Tu placa", { exact: true })).toHaveValue("uno");
});
