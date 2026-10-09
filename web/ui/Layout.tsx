import { useId, useState, type ReactNode } from "react";
import {
  Backdrop,
  Icon,
  type BackdropPattern,
  type IconName,
} from "../brand/Graphics";
import { cx } from "./cx";

/** Ancho máximo y márgenes laterales de toda pantalla. */
export function Page({
  children,
  className,
  wide,
}: {
  children: ReactNode;
  className?: string;
  /** Pantallas de trabajo (lección, dashboard) usan todo el ancho disponible. */
  wide?: boolean;
}) {
  return (
    <div
      className={cx(
        "mx-auto w-full px-4 pb-16 pt-5 sm:px-6 lg:px-8 lg:pt-7",
        wide ? "max-w-[1640px]" : "max-w-[1240px]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Cabecera de bosque nocturno: kicker lima, título crema y subtítulo.
 * Es `primary` con texto `cream` en los dos temas.
 */
export function PageHeader({
  kicker,
  title,
  subtitle,
  actions,
  art,
  pattern = "estrellas",
  children,
  className,
  compact,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Medalla, Rutix o ilustración a la derecha. */
  art?: ReactNode;
  pattern?: BackdropPattern | "none";
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}) {
  return (
    <header
      className={cx(
        "relative isolate overflow-hidden rounded-2xl bg-night",
        compact ? "px-5 py-5 sm:px-7" : "px-5 py-6 sm:px-8 sm:py-8",
        className,
      )}
    >
      {pattern !== "none" && (
        <Backdrop pattern={pattern} opacity={0.5} className="-z-10" />
      )}
      <div className="flex items-start gap-5">
        <div className="min-w-0 flex-1">
          {kicker && <p className="t-overline mb-2 text-accent">{kicker}</p>}
          <h1 className={cx(compact ? "t-title" : "t-hero", "text-cream")}>
            {title}
          </h1>
          {subtitle && (
            <p className="mt-2 max-w-2xl text-base leading-6 text-accent-soft">
              {subtitle}
            </p>
          )}
          {actions && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              {actions}
            </div>
          )}
        </div>
        {art && <div className="hidden shrink-0 sm:block">{art}</div>}
      </div>
      {children}
    </header>
  );
}

/** Encabezado de sección dentro de una pantalla: kicker + título + acción a la derecha. */
export function SectionHeader({
  kicker,
  title,
  description,
  actions,
  className,
  as: Heading = "h2",
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  as?: "h2" | "h3";
}) {
  return (
    <div
      className={cx(
        "flex flex-wrap items-end justify-between gap-x-6 gap-y-3",
        className,
      )}
    >
      <div className="min-w-0">
        {kicker && (
          <p className="t-overline mb-1.5 text-ink-accent">{kicker}</p>
        )}
        <Heading className="t-title text-ink">{title}</Heading>
        {description && (
          <p className="mt-1 max-w-2xl text-[15px] leading-[22px] text-ink-soft">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2">{actions}</div>
      )}
    </div>
  );
}

/** Cifra con ícono y etiqueta. Las cifras que cambian usan números tabulares. */
export function Stat({
  icon,
  label,
  value,
  unit,
  hint,
  className,
  onDark,
}: {
  icon?: IconName;
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: ReactNode;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <div
      className={cx(
        "flex min-w-0 flex-col gap-1 rounded-md p-3.5",
        onDark
          ? "bg-primary-soft/70 text-cream"
          : "border border-border bg-surface text-ink",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {icon && (
          <span
            className={cx(
              "flex size-8 shrink-0 items-center justify-center rounded-[10px]",
              onDark
                ? "bg-primary text-accent-soft"
                : "bg-highlight text-ink-accent",
            )}
          >
            <Icon name={icon} size={17} />
          </span>
        )}
        <span
          className={cx(
            "t-caption truncate",
            onDark ? "text-accent-soft" : "text-ink-soft",
          )}
        >
          {label}
        </span>
      </div>
      <p className="t-number truncate">
        {value}
        {unit && (
          <span className="ml-1 text-base font-bold opacity-70">{unit}</span>
        )}
      </p>
      {hint && (
        <p
          className={cx(
            "text-xs font-semibold leading-4",
            onDark ? "text-on-dark" : "text-ink-soft",
          )}
        >
          {hint}
        </p>
      )}
    </div>
  );
}

/** Fila de lista con ícono, título, detalle y acción final. */
export function ListRow({
  icon,
  title,
  detail,
  end,
  className,
  tone = "sky",
}: {
  icon?: IconName;
  title: ReactNode;
  detail?: ReactNode;
  end?: ReactNode;
  className?: string;
  tone?: "sky" | "success" | "warning" | "danger" | "neutral";
}) {
  const iconTone = {
    sky: "bg-highlight text-ink-accent",
    success: "bg-success-soft text-success-ink",
    warning: "bg-warning-soft text-warning-ink",
    danger: "bg-danger-soft text-danger-ink",
    neutral: "bg-surface-alt text-ink-soft",
  }[tone];
  return (
    <div
      className={cx(
        "flex items-center gap-3.5 rounded-[18px] border border-border bg-surface p-3.5",
        className,
      )}
    >
      {icon && (
        <span
          className={cx(
            "flex size-11 shrink-0 items-center justify-center rounded-sm",
            iconTone,
          )}
        >
          <Icon name={icon} size={20} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="t-label truncate text-[15px] text-ink">{title}</p>
        {detail && (
          <p className="mt-0.5 text-[13px] leading-[18px] text-ink-soft">
            {detail}
          </p>
        )}
      </div>
      {end}
    </div>
  );
}

/** Bloque plegable accesible (pistas, problemas comunes, «¿por qué?»). */
export function Disclosure({
  title,
  icon,
  children,
  defaultOpen = false,
  className,
  tone = "surface",
}: {
  title: ReactNode;
  icon?: IconName;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  tone?: "surface" | "alt" | "plain";
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div
      className={cx(
        tone === "surface" && "rounded-[18px] border border-border bg-surface",
        tone === "alt" && "rounded-[18px] bg-surface-alt",
        className,
      )}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className={cx(
          "focus-ring flex min-h-12 w-full items-center gap-3 rounded-[18px] text-left",
          tone === "plain" ? "py-2" : "px-4 py-3",
        )}
      >
        {icon && <Icon name={icon} size={19} className="text-ink-accent" />}
        <span className="t-label min-w-0 flex-1 text-[15px] text-ink">
          {title}
        </span>
        <Icon
          name="chevronDown"
          size={18}
          className={cx(
            "text-ink-soft transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>
      <div
        id={id}
        hidden={!open}
        className={cx(
          "animate-fade text-[15px] leading-[23px] text-ink",
          tone === "plain" ? "pb-2" : "px-4 pb-4",
        )}
      >
        {children}
      </div>
    </div>
  );
}

export interface TabItem<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  badge?: ReactNode;
}

/** Pestañas con navegación por flechas (patrón ARIA tabs). El panel lo dibuja quien las usa. */
export function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  label,
  className,
  idBase,
}: {
  tabs: TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  className?: string;
  /** Prefijo de ids: el panel debe llevar id `${idBase}-panel-${id}`. */
  idBase: string;
}) {
  const move = (delta: number) => {
    const index = tabs.findIndex((tab) => tab.id === value);
    const next = tabs[(index + delta + tabs.length) % tabs.length];
    onChange(next.id);
    requestAnimationFrame(() =>
      document.getElementById(`${idBase}-tab-${next.id}`)?.focus(),
    );
  };
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cx(
        "scrollbar-thin flex gap-1 overflow-x-auto border-b border-border",
        className,
      )}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        }
        if (event.key === "Home" || event.key === "End") {
          event.preventDefault();
          const next = event.key === "Home" ? tabs[0] : tabs[tabs.length - 1];
          if (next) {
            onChange(next.id);
            requestAnimationFrame(() =>
              document.getElementById(`${idBase}-tab-${next.id}`)?.focus(),
            );
          }
        }
      }}
    >
      {tabs.map((tab) => {
        const active = tab.id === value;
        return (
          <button
            key={tab.id}
            id={`${idBase}-tab-${tab.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            aria-controls={`${idBase}-panel-${tab.id}`}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(tab.id)}
            className={cx(
              "focus-ring relative -mb-px inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-t-sm border-b-[3px] px-3.5 text-sm font-bold transition-colors",
              active
                ? "border-action text-ink"
                : "border-transparent text-ink-soft hover:text-ink",
            )}
          >
            {tab.icon && <Icon name={tab.icon} size={16} />}
            {tab.label}
            {tab.badge}
          </button>
        );
      })}
    </div>
  );
}
