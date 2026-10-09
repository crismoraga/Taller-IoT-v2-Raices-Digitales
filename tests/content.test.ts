import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { lessons } from "../web/content/index.ts";
import { expressRoute, stages } from "../web/content/route.ts";
import { circuits } from "../web/circuit/layouts.ts";
import type { Lesson } from "../web/content/types.ts";

const text = (lesson: Lesson) =>
  [
    lesson.title,
    lesson.summary,
    lesson.objective,
    lesson.why,
    lesson.expected,
    ...lesson.concept.body,
    ...(lesson.safety ?? []),
    ...lesson.experiment,
    lesson.challenge.prompt,
    ...lesson.challenge.hints,
    ...lesson.modify.flatMap((task) => [
      task.title,
      task.instruction,
      task.observe,
    ]),
    ...lesson.checkpoint.flatMap((quiz) => [
      quiz.question,
      quiz.explain,
      ...quiz.options,
    ]),
    ...lesson.troubleshooting.flatMap((trouble) => [
      trouble.symptom,
      ...trouble.checks,
    ]),
  ].join("\n");

describe("contenido del taller", () => {
  it("cada actividad escrita pertenece a la ruta y a su etapa", () => {
    for (const lesson of lessons) {
      const stage = stages.find((candidate) => candidate.id === lesson.stage);
      expect(stage, `${lesson.id}: etapa ${lesson.stage}`).toBeDefined();
      expect(stage!.lessons, lesson.id).toContain(lesson.id);
    }
    expect(new Set(lessons.map((lesson) => lesson.id)).size).toBe(
      lessons.length,
    );
  });

  for (const lesson of lessons) {
    describe(lesson.id, () => {
      it("cubre las 14 partes de una actividad", () => {
        expect(lesson.title.length).toBeGreaterThan(3);
        expect(lesson.title.endsWith(".")).toBe(false);
        expect(lesson.summary.length).toBeGreaterThan(20);
        expect(lesson.summary.length).toBeLessThanOrEqual(110);
        expect(lesson.objective.length).toBeGreaterThan(20);
        expect(lesson.duration).toBeGreaterThanOrEqual(3);
        expect(lesson.duration).toBeLessThanOrEqual(20);
        expect(lesson.materials.length).toBeGreaterThan(0);
        expect(lesson.concept.title.length).toBeGreaterThan(5);
        expect(lesson.concept.body.length).toBeGreaterThanOrEqual(2);
        expect(lesson.concept.body.length).toBeLessThanOrEqual(4);
        expect(lesson.why.length).toBeGreaterThan(30);
        expect(lesson.expected.length).toBeGreaterThan(20);
        expect(lesson.modify.length).toBeGreaterThanOrEqual(1);
        expect(lesson.experiment.length).toBeGreaterThanOrEqual(2);
        expect(lesson.challenge.prompt.length).toBeGreaterThan(20);
        expect(lesson.challenge.hints.length).toBeGreaterThanOrEqual(2);
        expect(lesson.checkpoint.length).toBeGreaterThanOrEqual(2);
        expect(lesson.checkpoint.length).toBeLessThanOrEqual(3);
        expect(lesson.troubleshooting.length).toBeGreaterThanOrEqual(2);
      });

      it("tiene un montaje: plano de protoboard, guía de pines o una herramienta", () => {
        if (lesson.circuit)
          expect(Object.keys(circuits)).toContain(lesson.circuit);
        const wiringFree = ["welcome", "led_onboard"].includes(lesson.id);
        expect(
          Boolean(lesson.circuit || lesson.pins || lesson.tool || wiringFree),
        ).toBe(true);
        for (const row of [
          ...(lesson.pins?.rows ?? []),
          ...(lesson.arduino?.rows ?? []),
        ]) {
          expect(row.from.length).toBeGreaterThan(1);
          expect(row.to.length).toBeGreaterThan(1);
        }
      });

      it("el código base existe y cada cambio guiado apunta a una línea real", () => {
        if (!lesson.tool)
          expect(lesson.code?.length ?? 0, "falta código base").toBeGreaterThan(
            20,
          );
        for (const task of lesson.modify)
          if (task.find)
            expect(lesson.code ?? "", `modify: ${task.title}`).toContain(
              task.find,
            );
        for (const task of lesson.modify)
          if (task.arduino?.find)
            expect(
              lesson.arduinoCode ?? "",
              `Arduino modify: ${task.title}`,
            ).toContain(task.arduino.find);
        for (const note of lesson.codeNotes ?? [])
          expect(lesson.code ?? "", `codeNotes: ${note.line}`).toContain(
            note.line,
          );
        if (lesson.code) {
          expect(lesson.code).not.toMatch(/\t/);
          expect(lesson.code.endsWith("\n")).toBe(true);
        }
      });

      it("el checkpoint tiene una respuesta válida y explicada", () => {
        for (const quiz of lesson.checkpoint) {
          expect(quiz.options.length).toBeGreaterThanOrEqual(3);
          expect(quiz.options.length).toBeLessThanOrEqual(4);
          expect(quiz.answer).toBeGreaterThanOrEqual(0);
          expect(quiz.answer).toBeLessThan(quiz.options.length);
          expect(new Set(quiz.options).size).toBe(quiz.options.length);
          expect(quiz.explain.length).toBeGreaterThan(30);
        }
      });

      it("respeta la voz del taller", () => {
        const all = text(lesson);
        // Sin emoji ni tratamiento de usted.
        expect(all).not.toMatch(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u);
        expect(all).not.toMatch(
          /\b(usted|conecte|presione|verifique|coloque|retire)\b/i,
        );
        // Decimales con coma y unidades separadas del número.
        expect(all, "usa «3,3 V» (coma y espacio)").not.toMatch(/3\.3 ?V|3,3V/);
        expect(all, "usa «5 V» (con espacio)").not.toMatch(/\b5V\b/);
        expect(all, "separa el número de Ω y kΩ").not.toMatch(/\dk?Ω/);
        // Cada instrucción nombra una sola placa.
        for (const sentence of all.split(/(?<=[.!?])\s+|\n/)) {
          const both =
            /\bPico\b/.test(sentence) &&
            /\b(Arduino|Uno|Nano)\b/.test(sentence);
          expect(both, `mezcla dos placas: «${sentence}»`).toBe(false);
        }
      });
    });
  }

  it("la ruta exprés coincide con las actividades marcadas como esenciales", () => {
    for (const lesson of lessons)
      expect(Boolean(lesson.essential), lesson.id).toBe(
        expressRoute.includes(lesson.id),
      );
  });

  it("la ruta exprés dura 60 minutos y culmina en telemetría y una alerta", () => {
    const route = expressRoute.map((id) =>
      lessons.find((item) => item.id === id)!,
    );
    expect(route.every(Boolean)).toBe(true);
    expect(route.reduce((minutes, item) => minutes + item.duration, 0)).toBe(
      60,
    );
    expect(route.map((item) => item.id)).toEqual([
      "welcome",
      "led",
      "blink",
      "soil",
      "calibration",
      "cloud",
    ]);
    expect(route.at(-1)!.tool).toBe("station");
    expect(
      route
        .at(-1)!
        .modify.some((task) => /umbral|alerta/i.test(task.instruction)),
    ).toBe(true);
  });

  it("todas las muestras, soluciones y reemplazos Python tienen sintaxis válida", () => {
    const programs = lessons.flatMap((lesson) => {
      const items: { name: string; code: string }[] = [];
      if (lesson.code) items.push({ name: lesson.id, code: lesson.code });
      if (lesson.challenge.solution)
        items.push({
          name: `${lesson.id}: solución`,
          code: lesson.challenge.solution,
        });
      for (const task of lesson.modify)
        if (lesson.code && task.find && task.replace)
          items.push({
            name: `${lesson.id}: ${task.title}`,
            code: lesson.code.replace(task.find, task.replace),
          });
      return items;
    });
    const result = spawnSync(
      "python",
      [
        "-c",
        "import ast,json,sys\nfor p in json.load(sys.stdin):\n ast.parse(p['code'],filename=p['name'])\nprint('Sintaxis válida')",
      ],
      { input: JSON.stringify(programs), encoding: "utf8" },
    );
    expect(
      result.error,
      "Python debe estar instalado para verificar el currículo",
    ).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(programs.length).toBeGreaterThan(40);
  });

  it("incluye los siete modelos comprados y enseña los límites de diagnóstico", () => {
    for (const id of [
      "soil",
      "ds18b20",
      "dht11",
      "rain",
      "water_level",
      "distance",
      "motion",
    ])
      expect(
        lessons.some((item) => item.id === id),
        id,
      ).toBe(true);
    for (const id of ["soil", "ldr", "water_level", "rain", "motion"])
      expect(text(lessons.find((item) => item.id === id)!)).toMatch(
        /flotante|no (?:comprueba|demuestra|verifica|permite)|tampoco permite identificar|no identifica|no es lo mismo|más evidencia/i,
      );
    const ultrasonic = text(lessons.find((item) => item.id === "distance")!);
    expect(ultrasonic).toMatch(/2 kΩ/);
    expect(ultrasonic).toMatch(/3 kΩ/);
    expect(ultrasonic).toMatch(/nunca llega directo/);
    const servo = text(lessons.find((item) => item.id === "servo")!);
    expect(servo).toMatch(/no está en el inventario/);
    expect(servo).toMatch(/desconectado/);
  });
});

describe("ruta completa", () => {
  const written = new Set(lessons.map((lesson) => lesson.id));
  const expected = stages.flatMap((stage) => stage.lessons);
  it("cada etapa lista actividades sin repetir", () => {
    expect(new Set(expected).size).toBe(expected.length);
  });
  it.each(expected)("la actividad «%s» está escrita", (id) => {
    expect(written.has(id), `falta web/content/lessons/ para ${id}`).toBe(true);
  });
});
