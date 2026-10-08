import {
  ArrowRight,
  Check,
  LoaderCircle,
  X,
  Leaf,
  TriangleAlert,
} from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="brand">
      <span className="brand-mark">
        <svg viewBox="0 0 48 48" aria-hidden="true">
          <path d="M24 36V20M24 27C10 27 12 12 12 12c13 0 12 15 12 15M24 22c0-12 13-14 13-14 0 13-13 14-13 14M24 34l-7 6M24 31l8 9" />
          <circle cx="17" cy="40" r="2" />
          <circle cx="32" cy="40" r="2" />
        </svg>
      </span>
      {!compact && (
        <span>
          raíces
          <span className="brand-digital">
            digitales<span className="brand-dot">.</span>
          </span>
        </span>
      )}
    </span>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Button({
  children,
  onClick,
  disabled = false,
  loading = false,
  variant = "primary",
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  return (
    <button
      type={type}
      className={`button ${variant} ${className}`}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading && <LoaderCircle className="spin" size={16} />} {children}
    </button>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Notice({
  children,
  tone = "info",
}: {
  children: ReactNode;
  tone?: string;
}) {
  return (
    <div className={`notice ${tone}`}>
      <TriangleAlert size={18} />
      <div>{children}</div>
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const dialog = useRef<HTMLElement>(null),
    returnFocus = useRef(document.activeElement as HTMLElement | null),
    close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const element = dialog.current;
    if (element && !element.contains(document.activeElement))
      (
        element.querySelector<HTMLElement>("input,select,textarea") ||
        element.querySelector<HTMLElement>('button,[tabindex="0"]')
      )?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close.current();
        return;
      }
      if (event.key !== "Tab" || !element) return;
      const targets = [
        ...element.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]',
        ),
      ].filter((target) => target.getClientRects().length > 0);
      const first = targets[0],
        last = targets.at(-1);
      if (!first) {
        event.preventDefault();
        element.focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", keydown);
    return () => {
      document.removeEventListener("keydown", keydown);
      document.body.style.overflow = overflow;
      returnFocus.current?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        tabIndex={-1}
        className={`modal ${wide ? "wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Cerrar">
            <X size={20} />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Leaf size={30} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function StepCheck({ complete }: { complete: boolean }) {
  return (
    <span className={`step-check ${complete ? "complete" : ""}`}>
      {complete ? <Check size={15} /> : <ArrowRight size={15} />}
    </span>
  );
}
