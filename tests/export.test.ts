import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../web/lib/api";
import {
  downloadExport,
  MAX_BACKUP_BYTES,
  readSessionBackup,
} from "../web/lib/export";

const learningSession = () => ({
  name: "Raíces del futuro",
  groupNumber: 3,
  progress: ["welcome", "led"],
  drafts: { "led.python": "print('luz 🌱')", "soil.arduino": "void loop() {}" },
  calibrations: { soil: { dry: 52000, wet: 24000 } },
  sensorEnabled: { soil: true, light: false },
});

const backupFile = (value: unknown) => {
  const source = JSON.stringify(value);
  return {
    size: new Blob([source]).size,
    text: vi.fn().mockResolvedValue(source),
  };
};

describe("recuperación de respaldos de aprendizaje", () => {
  it("recupera código y progreso sin reutilizar identidad, dispositivos ni credenciales", async () => {
    const session = learningSession();
    const file = backupFile({
      session: {
        ...session,
        id: "identidad-del-equipo-anterior",
        createdAt: "2026-10-08T13:00:00.000Z",
        token: "credencial-anterior",
        devices: [{ id: "dispositivo-anterior", token: "privado" }],
        extra: { teacher: true },
      },
      devices: [{ token: "no-importar" }],
      readings: [{ sensor: "soil", value: 45 }],
      rules: [{ min: 30 }],
    });

    const restored = await readSessionBackup(file);
    expect(restored).toEqual({ session });
    expect(file.text).toHaveBeenCalledOnce();
    expect(JSON.stringify(restored)).not.toContain("credencial-anterior");
    expect(JSON.stringify(restored)).not.toContain("dispositivo-anterior");
  });

  it("recupera el último programa sin transmitir campos ajenos dentro de lastRun", async () => {
    const lastRun = {
      lessonId: "soil",
      board: "pico",
      code: "print('suelo')",
      at: "2026-10-08T13:01:00.000Z",
    };
    const result = await readSessionBackup(
      backupFile({
        session: {
          ...learningSession(),
          lastRun: {
            ...lastRun,
            token: "no-transmitir",
            deviceId: "equipo-anterior",
            telemetry: { source: "hardware" },
            teacher: true,
          },
        },
      }),
    );
    expect(result.session.lastRun).toEqual(lastRun);
    expect(Object.keys(result.session.lastRun!)).toEqual(
      expect.arrayContaining(["lessonId", "board", "code", "at"]),
    );
    expect(JSON.stringify(result)).not.toContain("no-transmitir");
  });

  it("rechaza respaldos mayores a 5 MiB antes de leer su contenido", async () => {
    expect(MAX_BACKUP_BYTES).toBe(5 * 1024 * 1024);
    const file = { size: MAX_BACKUP_BYTES + 1, text: vi.fn() };
    await expect(readSessionBackup(file)).rejects.toThrow(
      /5|grande|tamaño|límite/i,
    );
    expect(file.text).not.toHaveBeenCalled();
  });

  it("admite el tamaño máximo permitido", async () => {
    const file = backupFile({ session: learningSession() });
    file.size = MAX_BACKUP_BYTES;
    await expect(readSessionBackup(file)).resolves.toEqual({
      session: learningSession(),
    });
  });

  it("explica un JSON corrupto sin devolver el error técnico del parser", async () => {
    const file = {
      size: 12,
      text: vi.fn().mockResolvedValue("{respaldo roto"),
    };
    await expect(readSessionBackup(file)).rejects.toThrow(
      /respaldo|archivo|JSON/i,
    );
  });

  it.each([
    ["sin envoltorio de exportación", learningSession()],
    ["sesión ausente", {}],
    ["sesión nula", { session: null }],
    ["sesión como arreglo", { session: [] }],
    ["nombre ausente", { session: { ...learningSession(), name: undefined } }],
    [
      "grupo no numérico",
      { session: { ...learningSession(), groupNumber: "3" } },
    ],
    [
      "progreso con objetos",
      { session: { ...learningSession(), progress: [{ id: "led" }] } },
    ],
    [
      "borrador con objeto",
      {
        session: {
          ...learningSession(),
          drafts: { led: { token: "privado" } },
        },
      },
    ],
    [
      "borradores como arreglo",
      { session: { ...learningSession(), drafts: [] } },
    ],
    [
      "calibración no numérica",
      {
        session: {
          ...learningSession(),
          calibrations: { soil: { dry: "52000", wet: 24000 } },
        },
      },
    ],
    [
      "mapa de sensores con objeto",
      {
        session: {
          ...learningSession(),
          sensorEnabled: { soil: { enabled: true } },
        },
      },
    ],
    [
      "último programa inválido",
      {
        session: {
          ...learningSession(),
          lastRun: {
            lessonId: "led",
            board: "pico",
            code: [],
            at: "2026-10-08T13:00:00.000Z",
          },
        },
      },
    ],
  ])("rechaza un respaldo con %s", async (_name, payload) => {
    await expect(readSessionBackup(backupFile(payload))).rejects.toThrow(
      /respaldo|archivo|sesión|sesion|válido|valido|formato/i,
    );
  });
});

describe("exportaciones sin abandonar el taller", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let append: ReturnType<typeof vi.fn>;
  let createElement: ReturnType<typeof vi.fn>;
  let assign: ReturnType<typeof vi.fn>;
  let anchor: {
    href: string;
    download: string;
    click: ReturnType<typeof vi.fn>;
    remove: ReturnType<typeof vi.fn>;
  };
  let location: { href: string; assign: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    createObjectURL = vi.fn().mockReturnValue("blob:respaldo-local");
    revokeObjectURL = vi.fn();
    append = vi.fn();
    anchor = { href: "", download: "", click: vi.fn(), remove: vi.fn() };
    createElement = vi.fn().mockReturnValue(anchor);
    assign = vi.fn();
    location = { href: "/taller/soil", assign };
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    vi.stubGlobal("document", { body: { append }, createElement });
    vi.stubGlobal("window", { location });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const expectNoDownload = () => {
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalled();
    expect(append).not.toHaveBeenCalled();
    expect(anchor.click).not.toHaveBeenCalled();
    expect(assign).not.toHaveBeenCalled();
    expect(location.href).toBe("/taller/soil");
  };

  it("descarga CSV con autenticación, mantiene la ruta y libera el blob después del clic", async () => {
    const csv = "sensor,value\nsoil,45\n";
    fetchMock.mockResolvedValue(
      new Response(csv, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": 'attachment; filename="../../no-confiar.csv"',
        },
      }),
    );

    await downloadExport("/export", "lecturas-grupo-3.csv");

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/export",
      expect.objectContaining({
        credentials: "same-origin",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(createElement).toHaveBeenCalledWith("a");
    expect(append).toHaveBeenCalledWith(anchor);
    expect(anchor.href).toBe("blob:respaldo-local");
    expect(anchor.download).toBe("lecturas-grupo-3.csv");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(anchor.remove).toHaveBeenCalledOnce();
    expect(append.mock.invocationCallOrder[0]).toBeLessThan(
      anchor.click.mock.invocationCallOrder[0],
    );
    expect(anchor.click.mock.invocationCallOrder[0]).toBeLessThan(
      anchor.remove.mock.invocationCallOrder[0],
    );
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(await blob.text()).toBe(csv);
    expect(assign).not.toHaveBeenCalled();
    expect(location.href).toBe("/taller/soil");
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(999);
    expect(revokeObjectURL).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(revokeObjectURL).toHaveBeenCalledExactlyOnceWith(
      "blob:respaldo-local",
    );
  });

  it("descarga un respaldo JSON válido con el nombre provisto", async () => {
    const exported = { session: { ...learningSession(), id: "grupo-3" } };
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify(exported), {
        headers: { "content-type": "application/json" },
      }),
    );
    await downloadExport("/session/export", "respaldo-grupo-3.json");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/session/export",
      expect.objectContaining({
        credentials: "same-origin",
        signal: expect.any(AbortSignal),
      }),
    );
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(JSON.parse(await blob.text())).toEqual(exported);
    expect(anchor.download).toBe("respaldo-grupo-3.json");
    expect(anchor.click).toHaveBeenCalledOnce();
    expect(location.href).toBe("/taller/soil");
  });

  it("explica la pérdida de red sin abandonar el editor ni crear un archivo vacío", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(downloadExport("/export", "lecturas.csv")).rejects.toThrow(
      /conexión|servidor/i,
    );
    expectNoDownload();
  });

  it("conserva el taller cuando se interrumpe la lectura del archivo después de recibir respuesta", async () => {
    const response = new Response("sensor,value\nsoil,45\n", {
      headers: { "content-type": "text/csv" },
    });
    vi.spyOn(response, "blob").mockRejectedValue(
      new Error("Stream interrupted"),
    );
    fetchMock.mockResolvedValue(response);
    await expect(downloadExport("/export", "lecturas.csv")).rejects.toThrow(
      /interrumpió|conexión/i,
    );
    expectNoDownload();
  });

  it.each([
    [401, { error: "La sesión ha terminado." }, "La sesión ha terminado."],
    [
      503,
      { message: "El servidor no está disponible." },
      "El servidor no está disponible.",
    ],
  ])(
    "muestra el error HTTP %i sin iniciar una descarga",
    async (status, payload, message) => {
      fetchMock.mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status,
          headers: { "content-type": "application/json" },
        }),
      );
      const error = await downloadExport(
        "/session/export",
        "respaldo.json",
      ).catch((value) => value);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status, message });
      expectNoDownload();
    },
  );

  it.each(["/export", "/session/export"] as const)(
    "detecta una página HTML con estado 200 en %s sin descargarla como respaldo",
    async (path) => {
      fetchMock.mockResolvedValue(
        new Response("<html><body>Iniciar sesión</body></html>", {
          headers: { "content-type": "text/html" },
        }),
      );
      const error = await downloadExport(path, "respaldo").catch(
        (value) => value,
      );
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ status: 502 });
      expectNoDownload();
    },
  );

  it.each([
    ["JSON corrupto", "{respaldo roto"],
    ["sin sesión", JSON.stringify({ readings: [] })],
    ["sesión nula", JSON.stringify({ session: null })],
    ["sesión como arreglo", JSON.stringify({ session: [] })],
  ])("rechaza %s recibido como exportación JSON", async (_name, payload) => {
    fetchMock.mockResolvedValue(
      new Response(payload, {
        headers: { "content-type": "application/json" },
      }),
    );
    const error = await downloadExport(
      "/session/export",
      "respaldo.json",
    ).catch((value) => value);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 502 });
    expectNoDownload();
  });
});
