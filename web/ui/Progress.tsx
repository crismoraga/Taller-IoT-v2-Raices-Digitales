import type { ReactNode } from "react";
import { cx } from "./cx";

/** Barra de avance continua. Anima hacia su valor. */
export function ProgressBar({
  value,
  max = 100,
  label,
  tone = "accent",
  className,
  onDark,
}: {
  value: number;
  max?: number;
  /** Nombre accesible: qué mide la barra. */
  label: string;
  tone?: "accent" | "success" | "gold";
  className?: string;
  /** Sobre fondos azul noche. */
  onDark?: boolean;
}) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.round(value)}
      className={cx(
        "h-2 overflow-hidden rounded-pill",
        onDark ? "bg-primary-deep/70" : "bg-surface-alt",
        className,
      )}
    >
      <span
        className={cx(
          "block h-full rounded-pill transition-[width] duration-700 ease-out",
          tone === "success"
            ? "bg-success"
            : tone === "gold"
              ? "bg-pilar-hardware"
              : onDark
                ? "bg-accent"
                : "bg-ink-accent",
        )}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

/**
 * Avance por tramos (etapas de la ruta, pasos de cableado):
 * completados celeste, actual crema, pendientes azul secundario.
 */
export function SegmentedProgress({
  total,
  done,
  current,
  label,
  onDark = true,
  className,
}: {
  total: number;
  /** Índices completados. */
  done: number[] | number;
  /** Índice del tramo actual. */
  current?: number;
  label: string;
  onDark?: boolean;
  className?: string;
}) {
  const isDone = (index: number) =>
    typeof done === "number" ? index < done : done.includes(index);
  const count = typeof done === "number" ? done : done.length;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={count}
      aria-valuetext={`${count} de ${total}`}
      className={cx("flex gap-1.5", className)}
    >
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={cx(
            "h-2 flex-1 rounded-pill transition-colors duration-500",
            isDone(index)
              ? onDark
                ? "bg-accent"
                : "bg-success"
              : index === current
                ? onDark
                  ? "bg-cream"
                  : "bg-action"
                : onDark
                  ? "bg-secondary"
                  : "bg-border",
          )}
        />
      ))}
    </div>
  );
}

/** Anillo de avance con contenido centrado. */
export function ProgressRing({
  value,
  size = 64,
  stroke = 6,
  label,
  onDark,
  children,
  className,
}: {
  /** 0–100. */
  value: number;
  size?: number;
  stroke?: number;
  label: string;
  onDark?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const percent = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(percent)}
      className={cx(
        "relative inline-flex shrink-0 items-center justify-center",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={onDark ? "stroke-secondary" : "stroke-surface-alt"}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - percent / 100)}
          className={cx(
            "transition-[stroke-dashoffset] duration-700 ease-out",
            onDark ? "stroke-accent" : "stroke-ink-accent",
          )}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">
        {children}
      </span>
    </div>
  );
}
