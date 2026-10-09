import { Icon } from "../brand/Graphics";
import { lessonById, stageOf } from "../content";
import { useApp } from "../lib/context";
import { IconButton } from "../ui/Button";
import { ConnectButton, ConnectionChip } from "./ConnectButton";

function useCrumbs(route: string): { section: string; page?: string } {
  if (route.startsWith("/taller/")) {
    const lesson = lessonById(decodeURIComponent(route.split("/")[2] ?? ""));
    if (lesson) {
      const stage = stageOf(lesson);
      return { section: `${stage.label} · ${stage.title}`, page: lesson.title };
    }
    return { section: "Mi taller" };
  }
  const names: Record<string, string> = {
    "/": "Mi taller",
    "/planta": "Mi planta",
    "/explora": "Zona Explora",
    "/estacion": "Estación",
    "/diagnostico": "Diagnóstico",
    "/profesor": "Espacio docente",
  };
  return { section: names[route] ?? "Raíces Digitales" };
}

/** Barra superior: dónde estoy, estado de la placa y acceso al grupo. */
export function Topbar({ onMenu }: { onMenu: () => void }) {
  const app = useApp();
  const crumbs = useCrumbs(app.route);
  return (
    <header className="sticky top-0 z-40 flex h-16 items-center gap-2 border-b border-border bg-paper/92 px-3 backdrop-blur-md sm:gap-3 sm:px-6 lg:px-8">
      <IconButton
        icon="menu"
        label="Abrir menú"
        tone="ghost"
        className="lg:hidden"
        onClick={onMenu}
      />
      <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
        <span className="hidden truncate font-semibold text-ink-soft sm:inline">
          {crumbs.section}
        </span>
        {crumbs.page && (
          <>
            <Icon
              name="chevronRight"
              size={14}
              className="hidden text-ink-soft sm:block"
            />
            <strong className="truncate font-display font-bold text-ink">
              {crumbs.page}
            </strong>
          </>
        )}
        {!crumbs.page && (
          <strong className="truncate font-display font-bold text-ink sm:hidden">
            {crumbs.section}
          </strong>
        )}
      </div>
      {app.offline && (
        <span
          role="status"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-pill bg-warning-soft px-2 text-[13px] font-bold text-warning-ink md:px-3"
          title="Sin conexión con el servidor. Tus borradores y el USB siguen funcionando; se sincronizarán al volver."
        >
          <Icon name="wifiOff" size={15} />
          <span className="hidden md:inline">Modo local</span>
          <span className="sr-only md:hidden">
            Modo local: sin conexión con el servidor
          </span>
        </span>
      )}
      <div className="hidden shrink-0 md:block">
        <ConnectionChip />
      </div>
      <ConnectButton compactLabel />
      <button
        type="button"
        onClick={() =>
          app.session ? app.navigate("/estacion") : app.openOnboarding()
        }
        title={
          app.session
            ? `${app.session.name} · estación ${app.session.groupNumber}`
            : "Crear mi grupo"
        }
        aria-label={
          app.session
            ? `Grupo ${app.session.name}, ver estación`
            : "Crear mi grupo"
        }
        className="pressable focus-ring flex size-11 shrink-0 items-center justify-center rounded-full bg-primary font-display text-sm font-extrabold text-cream ring-2 ring-accent/40"
      >
        {app.session ? (
          String(app.session.groupNumber).padStart(2, "0")
        ) : (
          <Icon name="users" size={18} />
        )}
      </button>
    </header>
  );
}
