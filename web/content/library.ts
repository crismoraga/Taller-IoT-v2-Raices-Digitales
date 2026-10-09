import { lessons as validatedExamples } from "../data/lessons";
import type { Lesson, QuizQuestion } from "./types";

/** Ejemplos probados de la primera versión: conservamos el código y enriquecemos su guía. */
export function example(id: string) {
  const found = validatedExamples.find((item) => item.id === id);
  if (!found) throw new Error(`No existe un ejemplo validado para ${id}`);
  return found;
}

type Activity = Pick<
  Lesson,
  | "stage"
  | "summary"
  | "concept"
  | "why"
  | "modify"
  | "experiment"
  | "challenge"
  | "checkpoint"
  | "troubleshooting"
> &
  Partial<Lesson>;

/** Normaliza la prosa; no altera las instrucciones ejecutables del ejemplo. */
function prose(text: string): string {
  return text
    .replace(/3\.3\s?V/g, "3,3 V")
    .replace(/\b5V\b/g, "5 V")
    .replace(/(\d)(k?Ω)/g, "$1 $2")
    .replace(/(\d)\.(\d)/g, "$1,$2");
}

export function activity(id: string, content: Activity): Lesson {
  const source = example(id);
  return {
    id,
    title: source.title,
    duration: source.duration,
    icon: "flask",
    objective: prose(source.objective),
    materials: source.materials.map((name) => ({ name: prose(name) })),
    expected: prose(source.expected),
    code: source.code,
    arduinoCode: source.arduinoCode,
    sensor: source.sensor,
    safety: ["Desconecta el cable USB antes de cambiar cualquier conexión."],
    ...content,
  };
}

/** Distribuye la respuesta correcta para que comprender sea más útil que memorizar su posición. */
export function quiz(
  question: string,
  correct: string,
  alternatives: string[],
  explain: string,
): QuizQuestion {
  const answer = question.length % (alternatives.length + 1);
  const options = [...alternatives];
  options.splice(answer, 0, correct);
  return { question, options, answer, explain };
}

export const serialTrouble = {
  symptom: "La placa no ejecuta el programa",
  checks: [
    "Conecta un cable USB de datos y elige el puerto de tu placa en «Conectar placa».",
    "Cierra Thonny, Arduino IDE y otros monitores que tengan abierto el mismo puerto.",
    "Comprueba el modelo seleccionado. Para Nano, el bootloader antiguo requiere su opción específica.",
  ],
};
