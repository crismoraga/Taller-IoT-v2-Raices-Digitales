import { describe, expect, it } from "vitest";
import { essentials, lessonById, lessons } from "../web/content";
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
  it("termina la ruta guiada al completar las seis actividades esenciales", () => {
    const done = new Set(essentials.map((lesson) => lesson.id));
    expect(resumeWorkshop(true, done)).toBeUndefined();
    expect(lessonFlow(lessonById("cloud")!, true).following).toBeUndefined();
    expect(resumeWorkshop(false, done)?.id).toBe("led_onboard");
  });

  it("respeta los pasos intermedios al elegir el recorrido completo", () => {
    expect(lessonFlow(lessonById("welcome")!, false).following?.id).toBe(
      "led_onboard",
    );
    expect(lessonFlow(lessonById("welcome")!, true).following?.id).toBe("led");
    expect(lessonFlow(lessonById("soil")!, true).previous?.id).toBe("blink");
    expect(lessonFlow(lessonById("soil")!, false).previous?.id).toBe("dht11");
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
