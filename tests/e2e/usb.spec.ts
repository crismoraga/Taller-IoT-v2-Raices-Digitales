import { test, expect, type Page } from "@playwright/test";

test.afterEach(async ({ page }) => {
  await page.request.delete("/api/session", {
    headers: { Origin: "http://127.0.0.1:5173" },
  });
});

/** Explicit browser/protocol QA peer. This does not establish physical board operation. */
async function protocolPeer(page: Page) {
  await page.addInitScript(() => {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const programs: string[] = [];
    const files: Record<string, string> = {};
    const temporary: Record<string, number[]> = {};
    let controller: ReadableStreamDefaultController<Uint8Array>;
    let mode = "normal",
      input: number[] = [],
      activeFile = "",
      credits = 256;
    let requests = 0,
      opens = 0,
      stops = 0;
    const emit = (value: string | number[]) =>
      controller.enqueue(
        typeof value === "string"
          ? encoder.encode(value)
          : Uint8Array.from(value),
      );
    const execute = (source: string) => {
      programs.push(source);
      const open = source.match(/_rdfile=open\(("(?:[^"\\]|\\.)*"),'wb'\)/);
      if (open) {
        activeFile = JSON.parse(open[1]);
        temporary[activeFile] = [];
      }
      if (source.includes("_rdfile.write")) {
        for (const token of source.matchAll(/\\x([a-f0-9]{2})/g))
          temporary[activeFile].push(parseInt(token[1], 16));
      }
      const rename = source.match(
        /os\.rename\(("(?:[^"\\]|\\.)*"),("(?:[^"\\]|\\.)*")\)/,
      );
      if (rename) {
        const from = JSON.parse(rename[1]),
          to = JSON.parse(rename[2]);
        files[to] = decoder.decode(Uint8Array.from(temporary[from]));
        delete temporary[from];
      }
      emit([4]); // raw-paste end-of-input acknowledgement
      if (source.includes("CAMBIO_UTF8")) emit("CAMBIO_UTF8: raíces 🌱\r\n");
      else if (source.includes("led.value(1)")) emit("LED encendido\r\n");
      else if (source.includes("while True")) emit("LED: 1\r\n");
      if (source.includes("while True") && !source.includes("_rdfile"))
        mode = "running";
      else {
        emit([4, 4, 62]);
        mode = "raw";
      }
    };
    const port = {
      readable: null as ReadableStream<Uint8Array> | null,
      writable: null as WritableStream<Uint8Array> | null,
      async open() {
        opens++;
        port.readable = new ReadableStream<Uint8Array>({
          start(value) {
            controller = value;
          },
        });
        port.writable = new WritableStream<Uint8Array>({
          write(value) {
            const data = [...value];
            if (data.length === 3 && data[0] === 13 && data[1] === 3) {
              stops++;
              if (mode === "running") {
                emit([4]);
                emit("KeyboardInterrupt\r\n");
                emit([4, 62]);
              }
              mode = "normal";
              input = [];
              return;
            }
            if (data.length === 1 && data[0] === 1) {
              mode = "raw";
              emit("raw REPL; CTRL-B to exit\r\n>");
              return;
            }
            if (data.join(",") === "5,65,1") {
              mode = "input";
              credits = 256;
              emit([82, 1, 128, 0, 1]);
              return;
            }
            if (mode === "input" && data.length === 1 && data[0] === 4) {
              execute(decoder.decode(Uint8Array.from(input)));
              input = [];
              return;
            }
            if (mode === "input") {
              input.push(...data);
              credits -= data.length;
              while (credits < 128) {
                emit([1]);
                credits += 128;
              }
            }
          },
        });
      },
      async close() {},
      async setSignals() {},
    };
    const serial = new EventTarget() as EventTarget & {
      requestPort: () => Promise<typeof port>;
    };
    serial.requestPort = async () => {
      requests++;
      return port;
    };
    Object.defineProperty(navigator, "serial", {
      configurable: true,
      value: serial,
    });
    (window as unknown as { __usbPeer: unknown }).__usbPeer = {
      programs,
      files,
      emit: (line: string) => emit(line),
      unplug: () =>
        controller.error(new DOMException("Test USB unplug", "NetworkError")),
      stats: () => ({ requests, opens, stops }),
    };
  });
}

async function groupAndConnect(page: Page) {
  await protocolPeer(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Comenzar el taller", exact: true })
    .click();
  await page.getByLabel("Nombre del equipo").fill("USB protocolo QA");
  await page.getByLabel("Número de estación").selectOption("9");
  await page.getByRole("button", { name: "Comenzar mi recorrido" }).click();
  await expect(page).toHaveURL(/taller\/welcome/);
  await page.goto("/taller/led");
  await expect(page.locator(".monaco-editor").first()).toBeVisible();
  await page.getByRole("button", { name: "Conectar USB", exact: true }).click();
  await expect(page.locator(".connection-status")).toHaveText("USB conectado");
  await expect
    .poll(
      async () =>
        (
          await (await page.request.get("/api/dashboard")).json()
        ).devices.filter(
          (device: { source: string }) => device.source === "hardware",
        ).length,
    )
    .toBe(1);
}

async function replaceCode(page: Page, code: string) {
  await page.locator(".monaco-editor textarea.inputarea").first().focus();
  await page.keyboard.press("Control+A");
  await page.keyboard.insertText(code);
  await expect(page.locator(".monaco-editor").first()).toContainText(
    code.split("\n")[0],
  );
}

test("real UI executes raw-paste, edits UTF8 code, saves bytes, stops and reconnects with a protocol peer", async ({
  page,
}) => {
  await groupAndConnect(page);
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.locator(".serial-output")).toContainText("LED encendido");
  const code = '# CAMBIO_UTF8: raíces 🌱\nprint("CAMBIO_UTF8: raíces 🌱")\n';
  await replaceCode(page, code);
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.locator(".serial-output")).toContainText(
    "CAMBIO_UTF8: raíces 🌱",
  );
  await page
    .getByRole("button", { name: "Guardar en la placa", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("main.py guardado");
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { __usbPeer: { files: Record<string, string> } })
          .__usbPeer.files["main.py"],
    ),
  ).toBe(code);

  await replaceCode(page, 'while True:\n    print("LED: 1")\n');
  await page.getByRole("button", { name: "Ejecutar", exact: true }).click();
  await expect(page.locator(".serial-output")).toContainText("LED: 1");
  await page
    .getByRole("button", { name: "Detener código", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Programa detenido");
  await page.evaluate(() =>
    (
      window as unknown as { __usbPeer: { unplug: () => void } }
    ).__usbPeer.unplug(),
  );
  await expect(page.locator(".connection-status")).toHaveText(
    "Sin placa conectada",
  );
  await expect(
    page.getByRole("button", { name: "Ejecutar", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Conectar USB", exact: true }).click();
  await expect(page.locator(".connection-status")).toHaveText("USB conectado");
  const data = await (await page.request.get("/api/dashboard")).json();
  expect(
    data.devices.filter(
      (device: { source: string }) => device.source === "hardware",
    ),
  ).toHaveLength(1);
});

test("USB sensor JSON reaches the real isolated API and fallback continues after stale TLS verification", async ({
  page,
}) => {
  await groupAndConnect(page);
  const emit = async (body: unknown) =>
    page.evaluate(
      (line) =>
        (
          window as unknown as { __usbPeer: { emit: (value: string) => void } }
        ).__usbPeer.emit(line),
      `${JSON.stringify(body)}\n`,
    );
  const readings = [
    { sensor: "soil", value: 44, raw: 35000, unit: "%", status: "READING" },
  ];
  await emit({
    readings,
    diagnostics: {
      tlsVerified: true,
      cloudError: null,
      wifi: "Conectado (2.4 GHz)",
      ip: "192.0.2.2",
    },
  });
  // With an active verified cloud path, USB must not insert a duplicate batch.
  await page.waitForTimeout(350);
  expect(
    (await (await page.request.get("/api/dashboard")).json()).latest,
  ).toHaveLength(0);

  // A previous TLS handshake is not evidence the current Wi-Fi/cloud path works.
  await emit({
    readings: [{ ...readings[0], value: 47 }],
    diagnostics: {
      tlsVerified: true,
      cloudError: null,
      wifi: "Sin conexión; USB sigue operativo",
      ip: null,
    },
  });
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/dashboard")).json()).latest.find(
          (row: { sensor: string }) => row.sensor === "soil",
        )?.value,
    )
    .toBe(47);
  // Individual DHT lessons emit two consecutive JSON lines; preserve both
  // variables while limiting cloud traffic to one batch per sampling window.
  await emit({
    sensor: "air_temperature",
    value: 23,
    unit: "°C",
    status: "READING",
  });
  await emit({
    sensor: "air_humidity",
    value: 62,
    unit: "%",
    status: "READING",
  });
  await expect
    .poll(async () => {
      const data = await (await page.request.get("/api/dashboard")).json();
      return data.latest.filter((row: { sensor: string }) =>
        ["air_temperature", "air_humidity"].includes(row.sensor),
      ).length;
    })
    .toBe(2);
  await page.getByRole("button", { name: "Diagnóstico", exact: true }).click();
  await expect(page.locator(".sensor-status-table")).toContainText("ADC 35000");
  await expect(page.locator(".diagnostic-values")).toContainText(
    "USB sigue operativo",
  );
});

test("station installation writes the complete bundle and fresh group credential after revocation", async ({
  page,
}) => {
  test.setTimeout(75000);
  await groupAndConnect(page);
  await page.locator(".group-avatar").click();
  await expect(page).toHaveURL(/configuracion/);
  await page
    .locator(".sensor-toggle")
    .filter({ hasText: "Humedad del suelo" })
    .click();
  await expect
    .poll(
      async () =>
        (await (await page.request.get("/api/session")).json()).session
          .sensorEnabled.soil,
    )
    .toBe(true);
  const before = (
    await (await page.request.get("/api/dashboard")).json()
  ).devices.find((device: { source: string }) => device.source === "hardware");
  await page
    .getByRole("button", { name: "Revocar acceso", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Revocado", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Red Wi-Fi de 2,4 GHz").fill("QA-red-2.4GHz");
  await page.getByLabel("Contraseña Wi-Fi").fill("QA-password-solo-fixture");
  await page
    .getByLabel("Endpoint HTTPS de telemetría")
    .fill("https://workshop.example.org/api/device/ingest");
  await page
    .getByRole("button", { name: "Vincular e instalar estación", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Instalar en mi placa", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Estación instalada", {
    timeout: 45000,
  });
  const files = await page.evaluate(
    () =>
      (window as unknown as { __usbPeer: { files: Record<string, string> } })
        .__usbPeer.files,
  );
  for (const name of [
    "board.py",
    "drivers.py",
    "connectivity.py",
    "main.py",
    "onewire.py",
    "ds18x20.py",
    "ca.pem",
    "config.json",
  ])
    expect(files[name]).toBeTruthy();
  expect(files["ca.pem"]).toContain("-----BEGIN CERTIFICATE-----");
  const configuration = JSON.parse(files["config.json"]);
  expect(configuration.ssid).toBe("QA-red-2.4GHz");
  expect(configuration.password).toBe("QA-password-solo-fixture");
  expect(configuration.endpoint).toBe(
    "https://workshop.example.org/api/device/ingest",
  );
  expect(configuration.enabled.soil).toBe(true);
  expect(configuration.rtc).toHaveLength(6);
  expect(configuration.deviceId).not.toBe(before.id);
  const ingestion = await page.request.post("/api/device/ingest", {
    headers: { Authorization: `Bearer ${configuration.token}` },
    data: {
      readings: [{ sensor: "soil", value: 42, unit: "%", status: "READING" }],
      source: "hardware",
    },
  });
  expect(ingestion.status()).toBe(200);
  expect(await page.locator("body").innerText()).not.toContain(
    configuration.token,
  );
  expect(await page.locator("body").innerText()).not.toContain(
    configuration.password,
  );
});
