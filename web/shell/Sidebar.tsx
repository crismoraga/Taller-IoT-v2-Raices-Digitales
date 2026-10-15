import { Icon, type IconName } from "../brand/Graphics";
import { guidedRouteCopy } from "../content";
import { useApp } from "../lib/context";
import { useProgress } from "../lib/progress";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";
import { resumeWorkshop, workshopRoute } from "../workshop/flow";
import { Brand } from "./Brand";
import { ThemeSwitch } from "./ThemeSwitch";

export interface NavEntry {
  path: string;
  label: string;
  icon: IconName;
  /** Rutas que también marcan esta entrada como activa. */
  match?: (route: string) => boolean;
}

export const NAV: NavEntry[] = [
  {
    path: "/",
    label: "Mi taller",
    icon: "route",
    match: (route) => route === "/" || route.startsWith("/taller/"),
  },
  { path: "/planta", label: "Mi planta", icon: "sprout" },
  { path: "/explora", label: "Zona Explora", icon: "flask" },
  { path: "/estacion", label: "Estación", icon: "board" },
  { path: "/diagnostico", label: "Diagnóstico", icon: "stethoscope" },
];
export const NAV_END: NavEntry[] = [
  {
    path: "/profesor",
    label: "Espacio docente",
    icon: "school",
    match: (route) => route === "/profesor" || route === "/docente",
  },
];

export const isActive = (entry: NavEntry, route: string) =>
  entry.match ? entry.match(route) : route === entry.path;

/**
 * Navegación serena y siempre visible. En pantallas de trabajo puede plegarse
 * a una franja de íconos para dejarle el ancho a la protoboard y al editor.
 */
export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  className,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  className?: string;
}) {
  const app = useApp();
  const progress = useProgress();
  const next = resumeWorkshop(true, progress.done);
  const routeDone = progress.expressDone;
  const routeTotal = progress.expressTotal;
  const route = workshopRoute(true);
  const completedSteps = route.flatMap((lesson, index) =>
    progress.done.has(lesson.id) ? [index] : [],
  );
  const go = (path: string) => {
    app.navigate(path);
    onNavigate?.();
  };
  const item = (entry: NavEntry) => {
    const active = isActive(entry, app.route);
    return (
      <button
        key={entry.path}
        type="button"
        aria-current={active ? "page" : undefined}
        title={collapsed ? entry.label : undefined}
        onClick={() => go(entry.path)}
        className={cx(
          "solar-nav-item pressable focus-ring flex min-h-11 w-full items-center gap-3 rounded-md text-left text-[15px] font-bold",
          collapsed ? "justify-center px-0" : "px-3.5",
          active
            ? "bg-cream text-primary"
            : "text-on-dark hover:bg-primary-soft hover:text-cream",
        )}
      >
        <Icon name={entry.icon} size={20} />
        {!collapsed && <span className="truncate">{entry.label}</span>}
        {collapsed && <span className="sr-only">{entry.label}</span>}
      </button>
    );
  };
  return (
    <aside
      className={cx(
        "solar-sidebar scrollbar-thin relative isolate flex h-full flex-col overflow-x-hidden overflow-y-auto bg-night transition-[width] duration-300 ease-out",
        collapsed ? "w-[76px]" : "w-[264px]",
        className,
      )}
    >
      <div
        className={cx(
          "flex shrink-0 items-center gap-2 pb-5 pt-6",
          collapsed ? "justify-center px-0" : "px-5",
        )}
      >
        <button
          type="button"
          onClick={() => go("/")}
          aria-label="Raíces Digitales, ir al inicio"
          className="focus-ring rounded-md"
        >
          <Brand compact={collapsed} />
        </button>
      </div>

      <nav
        aria-label="Navegación principal"
        className={cx(
          "flex shrink-0 flex-col gap-1",
          collapsed ? "px-3" : "px-3.5",
        )}
      >
        {NAV.map(item)}
      </nav>

      {!collapsed && app.session && (
        <div className="mx-3.5 mt-5 shrink-0 border-t border-accent-soft/20 px-2 pt-5">
          <p className="text-xs font-semibold text-accent-soft">
            Tu avance · conexiones → LED → planta
          </p>
          <p className="mt-1 font-display text-[15px] font-bold leading-5 text-cream">
            {app.session
              ? routeDone === routeTotal
                ? "Ruta completada"
                : `${routeDone} de ${routeTotal} actividades`
              : "De cero a una planta conectada"}
          </p>
          <SegmentedProgress
            className="mt-3"
            total={routeTotal}
            done={completedSteps}
            current={route.findIndex((lesson) => lesson.id === next?.id)}
            label="Avance de la ruta guiada"
          />
          <button
            type="button"
            onClick={() =>
              app.session
                ? go(next ? `/taller/${next.id}` : "/planta")
                : app.openOnboarding()
            }
            className="pressable focus-ring mt-2 flex min-h-11 w-full items-center gap-2 rounded-sm px-1 py-2 text-left text-[13px] font-bold text-accent hover:text-cream"
          >
            <span className="line-clamp-2 min-w-0 flex-1">
              {next
                ? `${app.session ? "Seguir: " : "Empezar: "}${guidedRouteCopy[next.id]?.title ?? next.title}`
                : "Ver mi planta"}
            </span>
            <Icon name="arrowRight" size={16} />
          </button>
        </div>
      )}

      <div
        className={cx(
          "mt-auto flex shrink-0 flex-col gap-1 pb-4 pt-4",
          collapsed ? "px-3" : "px-3.5",
        )}
      >
        {NAV_END.map(item)}
        {!collapsed && (
          <ThemeSwitch value={app.theme} onChange={app.setTheme} />
        )}
        {onToggle && (
          <button
            type="button"
            onClick={onToggle}
            aria-label={
              collapsed
                ? "Expandir la barra lateral"
                : "Plegar la barra lateral"
            }
            aria-expanded={!collapsed}
            title={collapsed ? "Expandir" : "Plegar"}
            className={cx(
              "pressable focus-ring mt-1 flex min-h-11 items-center gap-3 rounded-md text-[13px] font-bold text-accent-soft hover:bg-primary-soft hover:text-cream",
              collapsed ? "justify-center" : "px-3.5",
            )}
          >
            <Icon name={collapsed ? "panelOpen" : "panelClose"} size={18} />
            {!collapsed && "Plegar"}
          </button>
        )}
        {!collapsed && (
          <a
            href="https://telematica.usm.cl/"
            target="_blank"
            rel="noreferrer"
            className="focus-ring mt-2 flex min-h-11 items-center gap-2 rounded-sm px-3.5 py-1 text-xs font-semibold leading-4 text-accent-soft hover:text-cream"
          >
            <span className="min-w-0 flex-1">
              Ingeniería Civil Telemática · USM
            </span>
            <Icon name="external" size={14} />
          </a>
        )}
      </div>
    </aside>
  );
}
