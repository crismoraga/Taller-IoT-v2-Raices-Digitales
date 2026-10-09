import { describe, expect, it, vi } from "vitest";
import type { Session } from "../web/lib/api";
import { mergeSessionPatch, offline } from "../web/lib/offline";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

function withStorage(check: () => void, storage = memoryStorage()) {
  vi.stubGlobal("localStorage", storage);
  try {
    check();
  } finally {
    vi.unstubAllGlobals();
  }
}

const group = (id = "grupo-a"): Session => ({
  id,
  name: "Los Clorofilos",
  groupNumber: 1,
  progress: ["welcome"],
  drafts: { "led.python": "print('luz')" },
  calibrations: { soil: { dry: 52000, wet: 24000 } },
  sensorEnabled: { soil: true },
  createdAt: "2026-10-08T13:00:00.000Z",
});

describe("Cola offline: preservación de cambios y aislamiento de grupo", () => {
  it("combina cambios parciales y conserva cada mapa con prioridad al cambio reciente", () => {
    const older: Partial<Session> = {
      name: "Equipo anterior",
      drafts: { "led.python": "LED anterior", "blink.python": "parpadeo" },
      calibrations: { soil: { dry: 50000, wet: 20000 } },
      sensorEnabled: { soil: true, light: true },
    };
    const newer: Partial<Session> = {
      name: "Equipo nuevo",
      drafts: { "led.python": "LED nuevo", "soil.python": "medir suelo" },
      calibrations: { water_level: { dry: 500, wet: 22000 } },
      sensorEnabled: { light: false, water_level: true },
    };
    const combined = mergeSessionPatch(older, newer);
    expect(combined).toEqual({
      name: "Equipo nuevo",
      drafts: {
        "led.python": "LED nuevo",
        "blink.python": "parpadeo",
        "soil.python": "medir suelo",
      },
      calibrations: {
        soil: { dry: 50000, wet: 20000 },
        water_level: { dry: 500, wet: 22000 },
      },
      sensorEnabled: { soil: true, light: false, water_level: true },
    });
    expect(older.drafts?.["led.python"]).toBe("LED anterior");
    expect(newer.calibrations).not.toHaveProperty("soil");
  });

  it("reemplaza la calibración y el último programa por su versión más reciente", () => {
    const firstRun = {
      lessonId: "led",
      board: "pico" as const,
      code: "print(1)",
      at: "2026-10-08T13:00:00Z",
    };
    const lastRun = {
      ...firstRun,
      code: "print(2)",
      at: "2026-10-08T13:01:00Z",
    };
    const result = mergeSessionPatch(
      {
        calibrations: { soil: { dry: 50000, wet: 22000 } },
        lastRun: firstRun,
        progress: ["welcome"],
      },
      {
        calibrations: { soil: { dry: 54000, wet: 26000 } },
        lastRun,
        progress: ["welcome", "led"],
      },
    );
    expect(result.calibrations?.soil).toEqual({ dry: 54000, wet: 26000 });
    expect(result.lastRun).toEqual(lastRun);
    expect(result.progress).toEqual(["welcome", "led"]);
    expect(mergeSessionPatch({}, {})).toEqual({});
  });

  it("acumula ediciones del mismo grupo en una sola cola y genera una revisión nueva", () =>
    withStorage(() => {
      offline.queue("grupo-a", {
        drafts: { "led.python": "A", "blink.python": "conservar" },
        sensorEnabled: { soil: true },
      });
      const first = offline.pending()!;
      offline.queue("grupo-a", {
        drafts: { "led.python": "B" },
        calibrations: { soil: { dry: 53000, wet: 25000 } },
        sensorEnabled: { light: true },
      });
      const current = offline.pending()!;
      expect(first.revision).toEqual(expect.any(String));
      expect(current.revision).not.toBe(first.revision);
      expect(current.id).toBe("grupo-a");
      expect(current.patch.drafts).toEqual({
        "led.python": "B",
        "blink.python": "conservar",
      });
      expect(current.patch.sensorEnabled).toEqual({ soil: true, light: true });
      expect(current.patch.calibrations?.soil).toEqual({
        dry: 53000,
        wet: 25000,
      });
    }));

  it("una respuesta de sincronización antigua no elimina la edición que llegó después", () =>
    withStorage(() => {
      offline.queue("grupo-a", { drafts: { "led.python": "versión enviada" } });
      const sentRevision = offline.pending()!.revision;
      offline.queue("grupo-a", {
        drafts: { "led.python": "edición durante la petición" },
      });
      const newer = offline.pending()!;
      offline.synced(sentRevision);
      expect(offline.pending()).toEqual(newer);
      offline.synced(newer.revision);
      expect(offline.pending()).toBeNull();
    }));

  it("cambiar de grupo no mezcla borradores, calibraciones ni revisión anteriores", () =>
    withStorage(() => {
      offline.queue("grupo-a", {
        drafts: { "led.python": "privado de A" },
        calibrations: { soil: { dry: 52000, wet: 23000 } },
        sensorEnabled: { soil: true },
      });
      const oldRevision = offline.pending()!.revision;
      offline.queue("grupo-b", {
        drafts: { "water.python": "privado de B" },
        sensorEnabled: { water_level: true },
      });
      const pending = offline.pending()!;
      expect(pending.id).toBe("grupo-b");
      expect(pending.patch).toEqual({
        drafts: { "water.python": "privado de B" },
        sensorEnabled: { water_level: true },
      });
      offline.synced(oldRevision);
      expect(offline.pending()).toEqual(pending);
    }));

  it("remember recupera el grupo y forget elimina sesión y cambios pendientes", () =>
    withStorage(() => {
      const session = group();
      offline.remember(session);
      offline.queue(session.id, { progress: ["welcome", "led"] });
      expect(offline.session()).toEqual(session);
      expect(offline.pending()).not.toBeNull();
      offline.forget();
      expect(offline.session()).toBeNull();
      expect(offline.pending()).toBeNull();
    }));

  it("un registro local corrupto no rompe la recuperación", () => {
    const storage = memoryStorage();
    storage.setItem("raices.session.cache", "{JSON roto");
    storage.setItem("raices.session.pending", "{JSON roto");
    withStorage(() => {
      expect(offline.session()).toBeNull();
      expect(offline.pending()).toBeNull();
      offline.queue("grupo-a", { name: "Equipo recuperado" });
      expect(offline.pending()?.patch.name).toBe("Equipo recuperado");
    }, storage);
  });

  it("la denegación de almacenamiento no lanza excepciones en las acciones del taller", () => {
    const denied = () => {
      throw new Error("Almacenamiento denegado");
    };
    withStorage(
      () => {
        expect(offline.session()).toBeNull();
        expect(offline.pending()).toBeNull();
        expect(() => offline.remember(group())).not.toThrow();
        expect(() =>
          offline.queue("grupo-a", {
            drafts: { "led.python": "copiable por USB" },
          }),
        ).not.toThrow();
        expect(() => offline.synced("revision-enviada")).not.toThrow();
        expect(() => offline.synced()).not.toThrow();
        expect(() => offline.forget()).not.toThrow();
      },
      { getItem: denied, setItem: denied, removeItem: denied },
    );
  });
});
