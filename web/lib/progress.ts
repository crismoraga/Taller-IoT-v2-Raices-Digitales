import { useMemo } from "react";
import {
  essentials,
  lessons,
  lessonsOf,
  normalizeProgress,
  stages,
  type Lesson,
  type Stage,
} from "../content";
import { useApp } from "./context";

export interface Progress {
  done: Set<string>;
  /** Avance de la ruta exprés (0–100). */
  expressPercent: number;
  expressDone: number;
  expressTotal: number;
  /** Avance de la ruta completa, sin la Zona Explora. */
  routeDone: number;
  routeTotal: number;
  /** Lo siguiente por hacer: primero la ruta exprés, después el resto. */
  next: Lesson | undefined;
  stageDone: (stage: Stage) => boolean;
  stageCount: (stage: Stage) => { done: number; total: number };
}

/** Avance del grupo, calculado desde las actividades completadas de su sesión. */
export function useProgress(): Progress {
  const { session } = useApp();
  return useMemo(() => {
    const done = new Set(normalizeProgress(session?.progress ?? []));
    const route = lessons.filter((lesson) => lesson.stage !== "explora");
    const expressDone = essentials.filter((lesson) => done.has(lesson.id)).length;
    const next =
      essentials.find((lesson) => !done.has(lesson.id)) ??
      route.find((lesson) => !done.has(lesson.id));
    const stageCount = (stage: Stage) => {
      const list = lessonsOf(stage);
      return { done: list.filter((lesson) => done.has(lesson.id)).length, total: list.length };
    };
    return {
      done,
      expressDone,
      expressTotal: essentials.length,
      expressPercent: essentials.length
        ? Math.round((expressDone / essentials.length) * 100)
        : 0,
      routeDone: route.filter((lesson) => done.has(lesson.id)).length,
      routeTotal: route.length,
      next,
      stageCount,
      stageDone: (stage) => {
        const count = stageCount(stage);
        return count.total > 0 && count.done === count.total;
      },
    };
  }, [session?.progress]);
}

export { stages };
