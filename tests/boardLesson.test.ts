import { describe, expect, it } from "vitest";
import { lessonForBoard } from "../web/content/boardLesson";
import { led } from "../web/content/lessons/led";
import { potentiometer } from "../web/content/lessons/potentiometer";
import {
  welcome,
  onboard,
  blink,
  buttonLed,
} from "../web/content/lessons/foundations";
import {
  calibration,
  station,
  cloud,
} from "../web/content/lessons/integration";
import {
  soil,
  water,
  distance,
  rain,
  ldr,
  lm35,
  dht11,
  ds18b20,
  motion,
} from "../web/content/lessons/sensors";

const lessons = [
  welcome,
  led,
  potentiometer,
  onboard,
  blink,
  calibration,
  station,
  cloud,
  soil,
  water,
  distance,
  rain,
  ldr,
  lm35,
  dht11,
  ds18b20,
  motion,
];
const answerText = (lesson: typeof led, index: number) =>
  lesson.checkpoint[index].options[lesson.checkpoint[index].answer];

describe("Teaching content follows the selected physical board", () => {
  for (const board of ["uno", "nano", "nano-old", "nano-168"] as const) {
    it(`${board}: welcome teaches its headers and real USB upload instead of Pico GPIO`, () => {
      const result = lessonForBoard(welcome, board);
      expect(result.expected).toContain("Cargar en Arduino");
      expect(result.expected).toContain("memoria de la placa");
      expect(result.experiment.join(" ")).toContain("D2, A0 y GND");
      expect(result.experiment.join(" ")).not.toContain("GP2");
      expect(result.modify[0].instruction).toContain("Serial.println");
      expect(
        result.troubleshooting.flatMap((item) => item.checks).join(" "),
      ).not.toContain("GP, GND");
    });
    it(`${board}: LED explanations name D2/5 V and the sketch instruction`, () => {
      const result = lessonForBoard(led, board);
      expect(result.concept.facts).toContainEqual({
        label: "Pin de Arduino",
        value: "D2",
      });
      expect(result.concept.facts).toContainEqual({
        label: "Voltaje de la señal",
        value: "5 V",
      });
      expect(result.checkpoint[2].question).toBe(
        "¿Qué hace digitalWrite(2, LOW)?",
      );
      expect(answerText(result, 2)).toContain("D2 en 0 V");
      expect(result.sampleOutput).toBe("LED encendido en D2");
    });
    it(`${board}: the basic station names its actual analog and digital pins`, () => {
      expect(lessonForBoard(soil, board).concept.facts).toContainEqual({
        label: "AOUT",
        value: "A0",
      });
      const result = lessonForBoard(water, board);
      expect(answerText(result, 1)).toBe("A2, ADC2");
      expect(result.checkpoint[1].explain).toContain("A2");
      expect(result.checkpoint[1].explain).not.toContain("GP28");
      expect(
        lessonForBoard(station, board).concept.facts?.map((fact) => fact.value),
      ).toEqual(["Suelo A0", "Luz A1", "DHT11 D4", "Luz, aire y suelo"]);
    });
    it(`${board}: HC-SR04 teaches direct D8 instead of the Pico divider`, () => {
      const result = lessonForBoard(distance, board);
      expect(result.why).toContain("D8");
      expect(result.why).not.toContain("divisor");
      expect(result.concept.facts).toContainEqual({
        label: "ECHO",
        value: "D8 directo",
      });
      expect(answerText(result, 0)).toBe("Directamente a D8");
      expect(result.challenge.prompt).not.toContain("GP18");
      expect(
        result.troubleshooting.flatMap((item) => item.checks).join(" "),
      ).not.toContain("divisor");
    });
    it(`${board}: potentiometer uses 5 V/1023 while soil preserves 3.3 V supply`, () => {
      const result = lessonForBoard(potentiometer, board);
      expect(result.concept.facts).toContainEqual({
        label: "Extremos",
        value: "5 V y GND",
      });
      expect(result.expected).toContain("1023");
      expect(answerText(result, 0)).toContain("0 V y 5 V");
      expect(lessonForBoard(soil, board).why).toContain(
        "alimentación de 3,3 V",
      );
    });
    it(`${board}: executable code, connections and modification fragments are unchanged`, () => {
      for (const lesson of lessons) {
        const snapshot = JSON.stringify(lesson);
        const result = lessonForBoard(lesson, board);
        expect(result.code).toBe(lesson.code);
        expect(result.arduinoCode).toBe(lesson.arduinoCode);
        expect(result.circuit).toBe(lesson.circuit);
        expect(result.arduino?.rows).toBe(lesson.arduino?.rows);
        expect(
          result.modify.map(({ find, replace }) => ({ find, replace })),
        ).toEqual(
          lesson.modify.map(({ find, replace }) => ({ find, replace })),
        );
        expect(JSON.stringify(lesson)).toBe(snapshot);
        for (const quiz of result.checkpoint)
          expect(quiz.answer).toBeLessThan(quiz.options.length);
      }
    });
  }
  it("Pico lessons remain the exact original objects", () => {
    for (const lesson of lessons)
      expect(lessonForBoard(lesson, "pico")).toBe(lesson);
  });
  it("Arduino network instructions use the PC bridge and do not promise MCU Wi-Fi", () => {
    const result = lessonForBoard(cloud, "uno");
    expect(result.expected).toContain("página abierta");
    expect(result.concept.body.join(" ")).toContain("Internet del PC");
    expect(result.concept.body.join(" ")).toContain("no añade Wi-Fi");
    expect(
      result.troubleshooting.some((trouble) =>
        trouble.symptom.includes("Wi-Fi"),
      ),
    ).toBe(false);
  });
  it("Arduino inverted-button checkpoint uses the C++ logical operator", () => {
    const result = lessonForBoard(buttonLed, "uno");
    expect(result.checkpoint[1].question).toContain("!pressed");
    expect(result.checkpoint[1].explain).toContain("! convierte");
    expect(result.modify[0].find).toBe(buttonLed.modify[0].find);
    expect(result.arduinoCode).toBe(buttonLed.arduinoCode);
  });
  it("rain checks teach the comparator threshold", () => {
    const result = lessonForBoard(rain, "uno");
    expect(result.checkpoint[1].question).toContain("trimmer");
    expect(answerText(result, 1)).toContain("umbral");
  });
  it("Arduino calibration instructions allow actual USB RAW and keep the 10-bit range", () => {
    const result = lessonForBoard(calibration, "uno");
    expect(result.expected).toContain("RAW USB reciente");
    expect(result.expected).toContain("0 a 1023");
    expect(result.expected).toContain("al menos 8");
    expect(result.modify[0].arduino?.instruction).not.toContain("desactivado");
  });
});
