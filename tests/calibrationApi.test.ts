import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { buildApp } from "../server/app";
import { readSessionBackup } from "../web/lib/export";

const origin = "http://localhost:5173";
let directory: string;
let app: Awaited<ReturnType<typeof buildApp>>;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "rd-calibration-api-"));
  app = await buildApp({
    databasePath: join(directory, "sessions.sqlite"),
    origins: [origin],
    secureCookies: false,
    teacherPassword: "calibration-test-password",
    encryptionKey: Buffer.alloc(32, 5).toString("base64"),
    logger: false,
  });
});

afterEach(async () => {
  await app.close();
  await rm(directory, { recursive: true, force: true });
});

async function createGroup() {
  const created = await app.inject({
    method: "POST",
    url: "/api/session",
    headers: { origin },
    payload: { name: "Mi planta", groupNumber: 1 },
  });
  expect(created.statusCode).toBe(200);
  return String(created.headers["set-cookie"]).split(";")[0];
}

const backupFile = (saved: unknown) => {
  const text = JSON.stringify(saved);
  return { size: Buffer.byteLength(text), text: async () => text };
};

it.each([
  ["pico", 52000, 24000],
  ["uno", 800, 100],
  ["nano", 800, 100],
  ["nano-old", 100, 800],
] as const)(
  "%s calibration keeps its board through save, process restart, export and import",
  async (board, dry, wet) => {
    const cookie = await createGroup();
    const soil = { dry, wet, board };
    const patched = await app.inject({
      method: "PATCH",
      url: "/api/session",
      headers: { origin, cookie },
      payload: { calibrations: { soil } },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.json().session.calibrations.soil).toEqual(soil);

    const configuration = app.rdConfig;
    await app.close();
    app = await buildApp(configuration);
    const exported = await app.inject({
      url: "/api/session/export",
      headers: { cookie },
    });
    expect(exported.statusCode).toBe(200);
    expect(exported.json().session.calibrations.soil).toEqual(soil);

    const importedPayload = await readSessionBackup(
      backupFile(exported.json()),
    );
    expect(importedPayload.session.calibrations.soil).toEqual(soil);
    const imported = await app.inject({
      method: "POST",
      url: "/api/session/import",
      headers: { origin },
      payload: importedPayload,
    });
    expect(imported.statusCode).toBe(200);
    expect(imported.json().session.calibrations.soil).toEqual(soil);
    expect(imported.json().session.id).not.toBe(exported.json().session.id);
  },
);

it.each([
  { dry: 52000, wet: 24000, board: "uno" },
  { dry: 10, wet: 200, board: "pico" },
  { dry: 800.25, wet: 100, board: "uno" },
  { dry: 100, wet: 800, board: "raspberry-linux" },
])(
  "rejects board-incompatible calibration without changing saved references: %j",
  async (soil) => {
    const cookie = await createGroup();
    const original = { dry: 52000, wet: 24000, board: "pico" };
    const save = await app.inject({
      method: "PATCH",
      url: "/api/session",
      headers: { origin, cookie },
      payload: { calibrations: { soil: original } },
    });
    expect(save.statusCode).toBe(200);
    const invalid = await app.inject({
      method: "PATCH",
      url: "/api/session",
      headers: { origin, cookie },
      payload: { calibrations: { soil } },
    });
    expect(invalid.statusCode).toBe(400);
    const current = await app.inject({
      url: "/api/session",
      headers: { cookie },
    });
    expect(current.json().session.calibrations.soil).toEqual(original);
  },
);

it("restores legacy backups without adding a guessed board or changing either ADC scale", async () => {
  const saved = {
    session: {
      name: "Planta heredada",
      groupNumber: 2,
      progress: ["soil"],
      drafts: {},
      calibrations: {
        soil: { dry: 52000, wet: 24000 },
        light: { dry: 100, wet: 800 },
      },
      sensorEnabled: { soil: true, light: true },
    },
  };
  const payload = await readSessionBackup(backupFile(saved));
  expect(payload).toEqual(saved);
  const imported = await app.inject({
    method: "POST",
    url: "/api/session/import",
    headers: { origin },
    payload,
  });
  expect(imported.statusCode).toBe(200);
  expect(imported.json().session.calibrations).toEqual(
    saved.session.calibrations,
  );
});

it("rejects an unknown calibration board in a backup before sending it to the API", async () => {
  const cookie = await createGroup();
  const saved = await app.inject({
    url: "/api/session/export",
    headers: { cookie },
  });
  const backup = saved.json();
  backup.session.calibrations.soil = { dry: 100, wet: 800, board: "unknown" };
  await expect(readSessionBackup(backupFile(backup))).rejects.toThrow(
    "respaldo de sesión válido",
  );
});
