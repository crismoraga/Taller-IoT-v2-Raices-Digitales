import { ApiError, type Session } from "./api";

export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;
type RestorableSession = Pick<
  Session,
  | "name"
  | "groupNumber"
  | "progress"
  | "drafts"
  | "calibrations"
  | "sensorEnabled"
  | "lastRun"
>;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const finite = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);
const invalidBackup = () =>
  new Error(
    "Este archivo no contiene un respaldo de sesión válido de Raíces Digitales.",
  );

export async function readSessionBackup(
  file: Pick<File, "size" | "text">,
): Promise<{ session: RestorableSession }> {
  if (file.size > MAX_BACKUP_BYTES)
    throw new Error("El respaldo debe pesar 5 MiB o menos.");
  let value: unknown;
  try {
    value = JSON.parse(await file.text());
  } catch {
    throw new Error(
      "No se pudo leer el respaldo. Selecciona un archivo JSON válido.",
    );
  }
  if (!record(value) || !record(value.session)) throw invalidBackup();
  const saved = value.session;
  if (
    typeof saved.name !== "string" ||
    !saved.name.trim() ||
    !finite(saved.groupNumber) ||
    !Number.isInteger(saved.groupNumber) ||
    saved.groupNumber < 1 ||
    saved.groupNumber > 10 ||
    !Array.isArray(saved.progress) ||
    !saved.progress.every((item) => typeof item === "string") ||
    !record(saved.drafts) ||
    !Object.values(saved.drafts).every((item) => typeof item === "string") ||
    !record(saved.calibrations) ||
    !Object.values(saved.calibrations).every(
      (item) => record(item) && finite(item.dry) && finite(item.wet),
    ) ||
    !record(saved.sensorEnabled) ||
    !Object.values(saved.sensorEnabled).every(
      (item) => typeof item === "boolean",
    )
  )
    throw invalidBackup();
  const session: RestorableSession = {
    name: saved.name,
    groupNumber: saved.groupNumber,
    progress: [...saved.progress],
    drafts: { ...(saved.drafts as Record<string, string>) },
    calibrations: Object.fromEntries(
      Object.entries(saved.calibrations).map(([key, item]) => {
        const calibration = item as { dry: number; wet: number };
        return [key, { dry: calibration.dry, wet: calibration.wet }];
      }),
    ),
    sensorEnabled: { ...(saved.sensorEnabled as Record<string, boolean>) },
  };
  if (saved.lastRun !== undefined) {
    const run = saved.lastRun;
    if (
      !record(run) ||
      typeof run.lessonId !== "string" ||
      typeof run.code !== "string" ||
      typeof run.at !== "string" ||
      typeof run.board !== "string" ||
      !["pico", "uno", "nano", "nano-old"].includes(run.board)
    )
      throw invalidBackup();
    session.lastRun = {
      lessonId: run.lessonId,
      board: run.board as NonNullable<Session["lastRun"]>["board"],
      code: run.code,
      at: run.at,
    };
  }
  return { session };
}

/** Fetch a download without replacing the workshop or its unsaved editor. */
export async function downloadExport(
  path: "/export" | "/session/export",
  fallbackName: string,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      credentials: "same-origin",
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(
      "No se pudo conectar con el servidor para exportar. Revisa tu conexión y vuelve a intentar.",
    );
  }
  if (!response.ok) {
    const problem: unknown = await response.json().catch(() => null);
    const message = record(problem)
      ? typeof problem.error === "string"
        ? problem.error
        : typeof problem.message === "string"
          ? problem.message
          : null
      : null;
    throw new ApiError(
      message ||
        `No se pudo exportar. El servidor respondió con error ${response.status}.`,
      response.status,
    );
  }
  const expected = path === "/export" ? "text/csv" : "application/json";
  const contentType = response.headers
    .get("content-type")
    ?.split(";")[0]
    .trim()
    .toLowerCase();
  if (contentType !== expected)
    throw new ApiError(
      "El servidor no entregó el archivo esperado. Vuelve a intentar.",
      502,
    );
  const blob = await response.blob().catch(() => {
    throw new Error(
      "La descarga se interrumpió. Revisa tu conexión y vuelve a intentar.",
    );
  });
  if (path === "/session/export") {
    const value: unknown = await blob
      .text()
      .then((text) => JSON.parse(text))
      .catch(() => null);
    if (!record(value) || !record(value.session))
      throw new ApiError(
        "El servidor entregó un respaldo inválido. Vuelve a intentar.",
        502,
      );
  }
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  try {
    anchor.href = url;
    anchor.download = fallbackName;
    document.body.append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
