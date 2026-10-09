import {
  forwardRef,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "../brand/Graphics";
import { cx } from "./cx";

export type CardTone =
  | "surface"
  | "alt"
  | "navy"
  | "dark"
  | "cream"
  | "sky"
  | "success"
  | "warning"
  | "danger";

const tones: Record<CardTone, string> = {
  surface: "bg-surface border border-border text-ink",
  alt: "bg-surface-alt text-ink",
  navy: "bg-primary text-cream",
  dark: "bg-primary-soft text-cream",
  cream: "bg-cream text-primary",
  sky: "bg-highlight text-ink",
  success: "bg-success-soft text-success-ink border border-success/40",
  warning: "bg-warning-soft text-warning-ink border border-warning/50",
  danger: "bg-danger-soft text-danger-ink border border-danger/40",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  /** Solo para tarjetas flotantes: la marca separa con bordes antes que con sombras. */
  elevated?: boolean;
  padded?: boolean;
  as?: "div" | "section" | "article" | "aside" | "li";
}

/** Contenedor de radio 20 y relleno 18–20. No anides tarjetas con borde dentro de otras con borde. */
export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { tone = "surface", elevated, padded = true, as = "div", className, ...rest },
  ref,
) {
  // El elemento cambia (section, li…), pero los atributos son los comunes de HTML.
  const Tag = as as "div";
  return (
    <Tag
      ref={ref}
      className={cx(
        "rounded-lg",
        tones[tone],
        padded && "p-[18px] sm:p-5",
        elevated && "shadow-card",
        className,
      )}
      {...rest}
    />
  );
});

/** Tarjeta completa que funciona como botón (encoge a 98 % al presionar). */
export const CardButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { tone?: CardTone }
>(function CardButton(
  { tone = "surface", className, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        "focus-ring block w-full rounded-lg p-[18px] text-left transition-[transform,border-color,box-shadow,background-color] duration-200 ease-out hover:border-border-strong hover:shadow-soft active:scale-[0.98] sm:p-5",
        tones[tone],
        className,
      )}
      {...rest}
    />
  );
});

/* ── Tag: etiqueta de estado o metadato ───────────────────────── */

export type TagTone =
  | "navy"
  | "cream"
  | "success"
  | "neutral"
  | "sky"
  | "warning"
  | "danger"
  | "glass"
  | "gold";

const tagTones: Record<TagTone, string> = {
  navy: "bg-primary text-cream",
  cream: "bg-cream text-primary",
  success: "bg-success-soft text-success-ink",
  neutral: "bg-surface-alt text-ink-soft",
  sky: "bg-highlight text-ink-accent",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger-ink",
  glass: "bg-accent-soft/16 text-accent-soft",
  gold: "bg-pilar-hardware text-primary",
};

/**
 * Etiqueta de 24 px. El tono siempre significa algo: success = completado,
 * neutral = pendiente, navy = actual, warning/danger = requiere atención.
 */
export function Tag({
  tone = "neutral",
  icon,
  live,
  children,
  className,
}: {
  tone?: TagTone;
  icon?: IconName;
  /** Punto celeste que late: dato en vivo. */
  live?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex h-6 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-2.5 text-[11px] font-extrabold leading-none tracking-[0.03em]",
        tagTones[tone],
        className,
      )}
    >
      {live && (
        <span className="relative flex size-[7px]">
          <span className="absolute inset-0 animate-pulse-ring rounded-full bg-accent" />
          <span className="relative size-[7px] rounded-full bg-accent" />
        </span>
      )}
      {icon && <Icon name={icon} size={13} strokeWidth={2.4} />}
      {children}
    </span>
  );
}

/* ── Chip y Segmented: una opción activa a la vez ─────────────── */

interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean;
  tone?: "light" | "dark";
  icon?: IconName;
  count?: number;
}

export function Chip({
  active,
  tone = "light",
  icon,
  count,
  className,
  children,
  type = "button",
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={active}
      className={cx(
        "pressable focus-ring inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill border-[1.5px] px-3.5 text-[13px] font-bold",
        tone === "light"
          ? active
            ? "border-action bg-action text-action-ink"
            : "border-border bg-surface text-ink-accent hover:border-border-strong hover:bg-surface-alt"
          : active
            ? "border-cream bg-cream text-primary"
            : "border-secondary bg-transparent text-on-dark hover:bg-primary-soft",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={15} />}
      {children}
      {count !== undefined && (
        <span className="tabular opacity-75">· {count}</span>
      )}
    </button>
  );
}

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: IconName;
}

/** Selector compacto de 2–4 opciones excluyentes (vista 2D/3D, rango de tiempo, tema). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = "light",
  size = "md",
  className,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Nombre accesible del grupo. */
  label: string;
  tone?: "light" | "dark";
  size?: "sm" | "md";
  className?: string;
}) {
  const id = useId();
  const selectAt = (index: number) => {
    const next = options[index];
    if (!next) return;
    onChange(next.value);
    requestAnimationFrame(() =>
      document.getElementById(`${id}-${index}`)?.focus(),
    );
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={(event) => {
        const current = Math.max(
          0,
          options.findIndex((option) => option.value === value),
        );
        const next =
          event.key === "ArrowRight" || event.key === "ArrowDown"
            ? (current + 1) % options.length
            : event.key === "ArrowLeft" || event.key === "ArrowUp"
              ? (current - 1 + options.length) % options.length
              : event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : undefined;
        if (next !== undefined && options.length) {
          event.preventDefault();
          selectAt(next);
        }
      }}
      className={cx(
        "inline-flex gap-1 rounded-md p-1",
        tone === "light" ? "bg-surface-alt" : "bg-primary-deep/60",
        className,
      )}
    >
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            id={`${id}-${index}`}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cx(
              "pressable focus-ring inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-sm font-bold",
              size === "md"
                ? "min-h-11 px-3.5 text-[13px]"
                : "min-h-11 px-2.5 text-xs",
              tone === "light"
                ? active
                  ? "bg-action text-action-ink shadow-soft"
                  : "text-ink-soft hover:text-ink"
                : active
                  ? "bg-cream text-primary"
                  : "text-accent-soft hover:text-cream",
            )}
          >
            {option.icon && <Icon name={option.icon} size={15} />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
