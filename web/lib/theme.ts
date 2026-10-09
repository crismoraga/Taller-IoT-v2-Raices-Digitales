/** Tema de la interfaz: sigue al sistema por defecto, o lo fija la persona en la barra lateral. */
export type ThemePref = "system" | "light" | "dark";

const KEY = "raices.theme";

export function readThemePref(): ThemePref {
  try {
    const stored = localStorage.getItem(KEY);
    if (stored === "light" || stored === "dark" || stored === "system") return stored;
  } catch {
    /* Sin almacenamiento: se usa el tema del sistema. */
  }
  return "system";
}

export function resolveTheme(pref: ThemePref): "light" | "dark" {
  if (pref !== "system") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Aplica el tema al documento y recuerda la preferencia. */
export function applyTheme(pref: ThemePref): "light" | "dark" {
  const resolved = resolveTheme(pref);
  const root = document.documentElement;
  root.dataset.theme = resolved;
  root.style.colorScheme = resolved;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", resolved === "dark" ? "#061724" : "#0b2d45");
  try {
    localStorage.setItem(KEY, pref);
  } catch {
    /* Preferencia válida solo para esta visita. */
  }
  return resolved;
}

/** Avisa cuando cambia el tema del sistema (solo importa si la preferencia es "system"). */
export function watchSystemTheme(onChange: () => void): () => void {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** Valor guardado con respaldo, tolerante a navegadores sin almacenamiento. */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}
export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Almacenamiento lleno o bloqueado: la interfaz sigue funcionando. */
  }
}
