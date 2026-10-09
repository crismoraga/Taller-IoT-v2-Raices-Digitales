import { expressRoute, legacyLessonIds, stages } from "./route";
import type { Lesson, Stage } from "./types";

// Cada archivo de ./lessons exporta una o más actividades; se reúnen sin índice manual.
const modules = import.meta.glob<Record<string, unknown>>("./lessons/*.ts", {
  eager: true,
});

const isLesson = (value: unknown): value is Lesson =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Lesson).id === "string" &&
  typeof (value as Lesson).title === "string" &&
  "checkpoint" in value;

const found = new Map<string, Lesson>();
for (const module of Object.values(modules))
  for (const value of Object.values(module))
    if (isLesson(value)) found.set(value.id, value);

/** Actividades en el orden de la ruta. */
export const lessons: Lesson[] = stages.flatMap((stage) =>
  stage.lessons.flatMap((id) => (found.has(id) ? [found.get(id)!] : [])),
);

const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));

export function lessonById(id: string): Lesson | undefined {
  return byId.get(legacyLessonIds[id] ?? id);
}
export function stageOf(lesson: Lesson): Stage {
  return stages.find((stage) => stage.id === lesson.stage)!;
}
export function lessonsOf(stage: Stage): Lesson[] {
  return stage.lessons.flatMap((id) => (byId.has(id) ? [byId.get(id)!] : []));
}
/** Actividad siguiente dentro de la ruta completa, o de la ruta exprés. */
export function nextLesson(id: string, express = false): Lesson | undefined {
  const order = express ? expressRoute : lessons.map((lesson) => lesson.id);
  const index = order.indexOf(id);
  return index >= 0 ? byId.get(order[index + 1]) : undefined;
}
/** Normaliza un progreso guardado: ids antiguos y duplicados. */
export function normalizeProgress(progress: string[]): string[] {
  return [...new Set(progress.map((id) => legacyLessonIds[id] ?? id))].filter(
    (id) => byId.has(id),
  );
}
export const essentials: Lesson[] = expressRoute.flatMap((id) =>
  byId.has(id) ? [byId.get(id)!] : [],
);

export { stages, expressRoute };
export type { Lesson, Stage };
