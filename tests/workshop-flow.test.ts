import { describe, expect, it } from "vitest";
import {
  essentials,
  lessonById,
  lessons,
  nextLesson,
  normalizeProgress,
} from "../web/content";
import {
  lessonFlow,
  lessonIdFromRoute,
  resumeWorkshop,
  workshopRoute,
} from "../web/workshop/flow";

describe("recorrido del taller", () => {
  it("tolera un identificador mal codificado en un enlace", () => {
    expect(lessonIdFromRoute("/taller/%")).toBe("");
    expect(lessonIdFromRoute("/taller/%6ced")).toBe("led");
  });
  it("termina el recorrido al completar LED, sensores y monitoreo sin exigir extras", () => {
    const done = new Set(essentials.map((lesson) => lesson.id));
    expect(resumeWorkshop(true, done)).toBeUndefined();
    expect(
      lessonFlow(lessonById("dashboard")!, true).following,
    ).toBeUndefined();
    expect(resumeWorkshop(false, done)).toBeUndefined();
  });

  it("cambiar la vista a Libre conserva el recorrido y deja el catálogo disponible", () => {
    expect(lessonFlow(lessonById("welcome")!, false).following?.id).toBe(
      "led",
    );
    expect(lessonFlow(lessonById("welcome")!, true).following?.id).toBe(
      "led",
    );
    expect(lessonFlow(lessonById("soil")!, true).previous?.id).toBe("station");
    expect(lessonFlow(lessonById("soil")!, false).previous?.id).toBe("station");
    expect(lessonFlow(lessonById("led")!, false).following?.id).toBe("blink");
    expect(nextLesson("led", false)?.id).toBe("blink");
    expect(workshopRoute(false)).toEqual(workshopRoute(true));
  });

  it("entiende las conexiones, controla el LED y empieza la estación tras dos sensores", () => {
    const route = workshopRoute(true);
    expect(route.map((lesson) => lesson.id)).toEqual([
      "welcome", "led", "blink", "button_led", "ldr", "dht11",
      "station", "soil", "calibration", "dashboard",
    ]);
    for (let index = 0; index < route.length; index++) {
      const flow = lessonFlow(route[index], true);
      expect(flow.index).toBe(index);
      expect(flow.total).toBe(10);
      expect(flow.previous?.id).toBe(route[index - 1]?.id);
      expect(flow.following?.id).toBe(route[index + 1]?.id);
      expect(nextLesson(route[index].id, true)?.id).toBe(route[index + 1]?.id);
    }
    expect(nextLesson("station", true)?.id).toBe("soil");
  });

  it("conserva el progreso antiguo y retoma los básicos nuevos pendientes", () => {
    const saved = [
      "welcome",
      "led",
      "blink",
      "sensors",
      "calibration",
      "cloud",
      "led",
    ];
    const progress = normalizeProgress(saved);
    expect(progress).toEqual([
      "welcome",
      "led",
      "blink",
      "soil",
      "calibration",
      "cloud",
    ]);
    expect(resumeWorkshop(true, new Set(progress))?.id).toBe("button_led");
    expect(nextLesson("sensors", true)?.id).toBe("calibration");
  });

  it("una actividad opcional no se intercala en el recorrido principal", () => {
    const optional = lessonFlow(lessonById("led_onboard")!, true);
    expect(optional.express).toBe(false);
    expect(optional.following?.id).toBe("button");
    expect(workshopRoute(true).some((lesson) => lesson.id === "cloud")).toBe(
      false,
    );
  });

  it("retoma el primer pendiente sin saltarlo por tener progreso posterior", () => {
    expect(
      resumeWorkshop(true, new Set(["welcome", "blink", "cloud"]))?.id,
    ).toBe("led");
    expect(
      workshopRoute(false).every((lesson) => lesson.stage !== "explora"),
    ).toBe(true);
  });

  it("mantiene los experimentos libres dentro de Zona Explora", () => {
    const exploration = lessons.filter((lesson) => lesson.stage === "explora");
    const first = lessonFlow(exploration[0], true);
    const last = lessonFlow(exploration.at(-1)!, false);
    expect(first.previous).toBeUndefined();
    expect(first.following?.id).toBe(exploration[1].id);
    expect(last.following).toBeUndefined();
    expect(last.total).toBe(exploration.length);
  });
});
