import type { Session } from "./api";
const sessionKey = "raices.session.cache";
const pendingKey = "raices.session.pending";
type Pending = { id: string; patch: Partial<Session> };
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
      patch: { ...(old?.id === id ? old.patch : {}), ...patch },
    });
  },
  synced: () => {
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
