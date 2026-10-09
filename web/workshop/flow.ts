import { essentials, lessons, type Lesson } from "../content";

export function lessonIdFromRoute(route: string): string {
  try {
    return decodeURIComponent(route.split("/")[2] ?? "");
  } catch {
    return "";
  }
}

/** The guided workshop ends after its six essentials; extra lessons are opt-in. */
export function workshopRoute(guided: boolean): Lesson[] {
  return guided
    ? essentials
    : lessons.filter((lesson) => lesson.stage !== "explora");
}

export function resumeWorkshop(guided: boolean, done: ReadonlySet<string>) {
  return workshopRoute(guided).find((lesson) => !done.has(lesson.id));
}

/** Keep next/previous navigation inside the route the learner actually chose. */
export function lessonFlow(lesson: Lesson, guided: boolean) {
  const express = guided && Boolean(lesson.essential);
  const route =
    lesson.stage === "explora"
      ? lessons.filter((candidate) => candidate.stage === "explora")
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
