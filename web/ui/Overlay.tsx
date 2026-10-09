import { useEffect, useId, useRef, type ReactNode } from "react";
import { Icon, type IconName } from "../brand/Graphics";
import { Button, IconButton, type ButtonVariant } from "./Button";
import { cx } from "./cx";

/**
 * Hoja modal sobre <dialog> nativo: el navegador atrapa el foco, cierra con Escape,
 * vuelve inerte el fondo y devuelve el foco al elemento que la abrió.
 * En pantallas angostas sube desde abajo; en escritorio se centra.
 */
export function Modal({
  open,
  onClose,
  title,
  kicker,
  description,
  children,
  footer,
  size = "md",
  tone = "surface",
  dismissable = true,
  icon,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  kicker?: string;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  /** `navy`: cabecera azul noche, para momentos de bienvenida o logro. */
  tone?: "surface" | "navy";
  /** Si es false, no se cierra con Escape ni tocando fuera (operaciones en curso). */
  dismissable?: boolean;
  icon?: IconName;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);
  const widths = {
    sm: "sm:max-w-md",
    md: "sm:max-w-xl",
    lg: "sm:max-w-3xl",
    xl: "sm:max-w-5xl",
  };
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const items = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
          ),
        ].filter((item) => item.getClientRects().length > 0);
        if (!items.length) {
          event.preventDefault();
          event.currentTarget.focus();
        } else if (event.shiftKey && document.activeElement === items[0]) {
          event.preventDefault();
          items.at(-1)?.focus();
        } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
          event.preventDefault();
          items[0]?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        if (dismissable) onClose();
      }}
      onClose={() => {
        if (open) onClose();
      }}
      onMouseDown={(event) => {
        if (dismissable && event.target === ref.current) onClose();
      }}
      className={cx(
        "m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-2xl bg-surface p-0 text-ink shadow-lifted backdrop:bg-overlay backdrop:backdrop-blur-[2px] open:flex open:animate-sheet open:flex-col sm:m-auto sm:rounded-2xl",
        widths[size],
      )}
    >
      {open && (
        <>
          <header
            className={cx(
              "flex shrink-0 items-start gap-3 px-5 pb-4 pt-5 sm:px-6",
              tone === "navy"
                ? "bg-night"
                : "border-b border-border bg-surface",
            )}
          >
            {icon && (
              <span
                className={cx(
                  "mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-sm",
                  tone === "navy"
                    ? "bg-primary-soft text-accent-soft"
                    : "bg-highlight text-ink-accent",
                )}
              >
                <Icon name={icon} size={20} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              {kicker && (
                <p
                  className={cx(
                    "t-overline mb-1",
                    tone === "navy" ? "text-accent" : "text-ink-accent",
                  )}
                >
                  {kicker}
                </p>
              )}
              <h2
                id={titleId}
                className={cx(
                  "t-title text-[1.375rem] leading-7",
                  tone === "navy" ? "text-cream" : "text-ink",
                )}
              >
                {title}
              </h2>
              {description && (
                <p
                  className={cx(
                    "mt-1 text-[15px] leading-[22px]",
                    tone === "navy" ? "text-accent-soft" : "text-ink-soft",
                  )}
                >
                  {description}
                </p>
              )}
            </div>
            {dismissable && (
              <IconButton
                icon="close"
                label="Cerrar"
                size="sm"
                tone={tone === "navy" ? "ghostLight" : "ghost"}
                onClick={onClose}
              />
            )}
          </header>
          {children && (
            <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
              {children}
            </div>
          )}
          {footer && (
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-border bg-surface px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}

/** Confirmación para acciones sensibles (reiniciar, eliminar, revocar). */
export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancelar",
  variant = "danger",
  icon = "alert",
  loading,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  children?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      icon={icon}
      dismissable={!loading}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={variant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children && (
        <div className="text-[15px] leading-[22px] text-ink-soft [&_strong]:font-extrabold [&_strong]:text-ink">
          {children}
        </div>
      )}
    </Modal>
  );
}

/* ── Toasts ───────────────────────────────────────────────────── */

export interface ToastItem {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
  title?: string;
}

const toastIcon: Record<ToastItem["tone"], IconName> = {
  success: "checkCircle",
  error: "alert",
  info: "info",
};

/** Avisos flotantes desde arriba. Los errores se anuncian como alerta y esperan a que los cierres. */
export function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: number) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex flex-col items-center gap-2 px-3 sm:top-5"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.tone === "error" ? "alert" : "status"}
          className="pointer-events-auto flex w-full max-w-md animate-rise items-start gap-3 rounded-lg border border-accent-soft/25 bg-primary p-3 pr-2 text-cream shadow-lifted"
        >
          <span
            className={cx(
              "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
              toast.tone === "error"
                ? "bg-danger text-white"
                : toast.tone === "success"
                  ? "bg-success text-white"
                  : "bg-secondary text-cream",
            )}
          >
            <Icon name={toastIcon[toast.tone]} size={17} />
          </span>
          <div className="min-w-0 flex-1 py-1">
            {toast.title && (
              <p className="t-overline mb-0.5 text-[10.5px] text-accent">
                {toast.title}
              </p>
            )}
            <p className="text-sm font-semibold leading-5">{toast.message}</p>
          </div>
          <IconButton
            icon="close"
            label="Cerrar aviso"
            size="sm"
            tone="ghostLight"
            onClick={() => onDismiss(toast.id)}
          />
        </div>
      ))}
    </div>
  );
}
