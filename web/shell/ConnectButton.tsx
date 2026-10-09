import { Icon } from "../brand/Graphics";
import { BOARD_NAMES, useApp } from "../lib/context";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";

/** Estado de la placa, siempre con ícono y palabra (nunca solo color). */
export function ConnectionChip({ className }: { className?: string }) {
  const app = useApp();
  const state = app.connected
    ? app.running
      ? {
          text: "Programa en marcha",
          tone: "bg-success-soft text-success-ink",
          dot: "bg-success",
        }
      : {
          text: "Placa conectada",
          tone: "bg-success-soft text-success-ink",
          dot: "bg-success",
        }
    : app.connecting
      ? {
          text: "Conectando…",
          tone: "bg-warning-soft text-warning-ink",
          dot: "bg-warning",
        }
      : {
          text: "Sin placa",
          tone: "bg-surface-alt text-ink-soft",
          dot: "bg-slate",
        };
  return (
    <span
      role="status"
      title={app.connected ? BOARD_NAMES[app.board] : undefined}
      className={cx(
        "inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-pill px-3 text-[13px] font-bold",
        state.tone,
        className,
      )}
    >
      <span className="relative flex size-2">
        {app.connected && (
          <span
            className={cx(
              "absolute inset-0 animate-pulse-ring rounded-full",
              state.dot,
            )}
          />
        )}
        <span className={cx("relative size-2 rounded-full", state.dot)} />
      </span>
      {state.text}
    </span>
  );
}

/** Conectar o desconectar la placa por USB. Es la acción más repetida del taller. */
export function ConnectButton({
  size = "sm",
  className,
  variant,
  compactLabel = false,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  variant?: "primary" | "cream" | "outline";
  /** Etiqueta breve en la barra móvil; el nombre accesible conserva la acción completa. */
  compactLabel?: boolean;
}) {
  const app = useApp();
  if (app.connected)
    return (
      <Button
        size={size}
        variant="outline"
        icon="unlink"
        className={cx(compactLabel && "shrink-0", className)}
        aria-label="Desconectar"
        disabled={app.busy}
        onClick={() => void app.disconnect()}
      >
        Desconectar
      </Button>
    );
  return (
    <Button
      size={size}
      variant={variant ?? "primary"}
      icon="usb"
      className={cx(
        compactLabel && "shrink-0 min-w-[110px] sm:min-w-0",
        className,
      )}
      aria-label="Conectar placa"
      loading={app.connecting}
      onClick={() => void app.connect()}
    >
      {compactLabel ? (
        <>
          <span className="sm:hidden">Conectar</span>
          <span className="hidden sm:inline">Conectar placa</span>
        </>
      ) : (
        "Conectar placa"
      )}
    </Button>
  );
}
