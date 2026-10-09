import type { Session } from "./api";
const sessionKey = "raices.session.cache";
const pendingKey = "raices.session.pending";
type Pending = { id: string; patch: Partial<Session>; revision?: string };
/** Respeta la misma combinación parcial que la base de datos, con el cambio más reciente al final. */
export function mergeSessionPatch(
  older: Partial<Session>,
  newer: Partial<Session>,
): Partial<Session> {
  const combined = { ...older, ...newer };
  for (const key of ["drafts", "calibrations", "sensorEnabled"] as const) {
    if (older[key] || newer[key])
      Object.assign(combined, { [key]: { ...older[key], ...newer[key] } });
  }
  return combined;
}
function read<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) || "null") as T | null;
  } catch {
    return null;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* USB and download remain available if browser storage is full. */
  }
}
export const offline = {
  session: () => read<Session>(sessionKey),
  remember: (session: Session) => write(sessionKey, session),
  pending: () => read<Pending>(pendingKey),
  queue: (id: string, patch: Partial<Session>) => {
    const old = read<Pending>(pendingKey);
    write(pendingKey, {
      id,
      revision: crypto.randomUUID(),
      patch: mergeSessionPatch(old?.id === id ? old.patch : {}, patch),
    });
  },
  synced: (revision?: string) => {
    if (read<Pending>(pendingKey)?.revision !== revision) return;
    try {
      localStorage.removeItem(pendingKey);
    } catch {}
  },
  forget: () => {
    try {
      localStorage.removeItem(sessionKey);
      localStorage.removeItem(pendingKey);
    } catch {}
  },
};
export function isNetworkError(error: unknown) {
  return (
    error instanceof Error &&
    ["TypeError", "TimeoutError", "AbortError"].includes(error.name)
  );
}
