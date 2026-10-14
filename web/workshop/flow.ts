import { essentials, lessons, type Lesson } from "../content";

export function lessonIdFromRoute(route: string): string {
  try {
    return decodeURIComponent(route.split("/")[2] ?? "");
  } catch {
    return "";
  }
}

/** Guided/free changes the presentation, never the recommended lesson order. */
export function workshopRoute(_guided: boolean): Lesson[] {
  return essentials;
}

export function resumeWorkshop(guided: boolean, done: ReadonlySet<string>) {
  return workshopRoute(guided).find((lesson) => !done.has(lesson.id));
}

/** Keep next/previous navigation inside the route the learner actually chose. */
export function lessonFlow(lesson: Lesson, _guided: boolean) {
  const express = Boolean(lesson.essential);
  const route =
    lesson.stage === "explora"
      ? lessons.filter((candidate) => candidate.stage === "explora")
      : !express
        ? lessons.filter(
            (candidate) =>
              candidate.stage !== "explora" && !candidate.essential,
          )
        : workshopRoute(express);
  const index = route.findIndex((candidate) => candidate.id === lesson.id);
  return {
    express,
    index,
    total: route.length,
    previous: index > 0 ? route[index - 1] : undefined,
    following: index >= 0 ? route[index + 1] : undefined,
  };
}
