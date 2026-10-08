import type { ReactNode } from "react";
import {
  Icon,
  Illustration,
  Rutix,
  type IconName,
  type IllustrationName,
  type RutixExpression,
  type RutixPose,
} from "../brand/Graphics";
import { cx } from "./cx";

/* ── Callout: aviso en línea con ícono y palabra (nunca solo color) ─── */

export type CalloutTone = "info" | "success" | "warning" | "danger" | "tip";

const calloutTones: Record<
  CalloutTone,
  { box: string; dot: string; icon: IconName; word: string }
> = {
  info: {
    box: "bg-highlight text-ink border-border-strong",
    dot: "bg-secondary text-white",
    icon: "info",
    word: "Dato",
  },
  tip: {
    box: "bg-surface-alt text-ink border-border",
    dot: "bg-pilar-hardware text-primary",
    icon: "lightbulb",
    word: "Consejo",
  },
  success: {
    box: "bg-success-soft text-success-ink border-success/45",
    dot: "bg-success text-white",
    icon: "check",
    word: "Listo",
  },
  warning: {
    box: "bg-warning-soft text-warning-ink border-warning/60",
    dot: "bg-warning text-primary",
    icon: "alert",
    word: "Cuidado",
  },
  danger: {
    box: "bg-danger-soft text-danger-ink border-danger/50",
    dot: "bg-danger text-white",
    icon: "bolt",
    word: "Peligro eléctrico",
  },
};

export function Callout({
  tone = "info",
  title,
  icon,
  children,
  className,
  compact,
  role,
}: {
  tone?: CalloutTone;
  /** Si no se entrega, usa la palabra del tono («Cuidado», «Dato»…). */
  title?: ReactNode;
  icon?: IconName;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  role?: "alert" | "status" | "note";
}) {
  const config = calloutTones[tone];
  return (
    <div
      role={role ?? (tone === "danger" ? "alert" : "note")}
      className={cx(
        "flex gap-3 rounded-[18px] border",
        compact ? "p-3" : "p-4",
        config.box,
        className,
      )}
    >
      <span
        className={cx(
          "flex shrink-0 items-center justify-center rounded-full",
          compact ? "size-7" : "size-8",
          config.dot,
        )}
      >
        <Icon name={icon ?? config.icon} size={compact ? 15 : 17} strokeWidth={2.4} />
      </span>
      <div className="min-w-0 flex-1">
        <p
          className={cx(
            "font-display font-bold",
            compact ? "text-sm leading-5" : "text-[15px] leading-6",
          )}
        >
          {title ?? config.word}
        </p>
        {children && (
          <div
            className={cx(
              "mt-0.5 [&_a]:font-bold [&_a]:underline [&_strong]:font-extrabold",
              compact ? "text-[13px] leading-[18px]" : "text-sm leading-[22px]",
            )}
          >
            {children}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── CoachBubble: Rutix hablando ──────────────────────────────── */

export type CoachMood =
  | "intro"
  | "tip"
  | "good"
  | "great"
  | "bad"
  | "think"
  | "alert"
  | "idle";

const moods: Record<
  CoachMood,
  { expression: RutixExpression; pose: RutixPose; signal: number }
> = {
  intro: { expression: "happy", pose: "wave", signal: 4 },
  tip: { expression: "wink", pose: "point", signal: 3 },
  good: { expression: "proud", pose: "thumbsUp", signal: 4 },
  great: { expression: "celebrate", pose: "celebrate", signal: 4 },
  bad: { expression: "worried", pose: "shrug", signal: 2 },
  think: { expression: "think", pose: "think", signal: 3 },
  alert: { expression: "alert", pose: "idle", signal: 3 },
  idle: { expression: "neutral", pose: "idle", signal: 3 },
};

/**
 * Rutix junto a una burbuja de diálogo: pistas, presentaciones de etapa y reacciones.
 * Frases de una línea, cálidas y en primera persona; ante un error anima, nunca reta.
 * Rutix va dentro de un círculo azul noche, por eso funciona en ambos temas.
 * Máximo un Rutix por pantalla.
 */
export function CoachBubble({
  mood = "tip",
  tone = "info",
  title,
  children,
  side = "left",
  size = 72,
  className,
  action,
}: {
  mood?: CoachMood;
  tone?: "info" | "good" | "bad";
  /** Kicker, por ejemplo «PISTA DE RUTIX». */
  title?: string;
  children: ReactNode;
  side?: "left" | "right";
  size?: number;
  className?: string;
  action?: ReactNode;
}) {
  const config = moods[mood];
  return (
    <div
      className={cx(
        "flex items-end gap-3",
        side === "right" && "flex-row-reverse",
        className,
      )}
    >
      <span
        className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-night ring-2 ring-accent/35"
        style={{ width: size, height: size }}
      >
        <Rutix
          expression={config.expression}
          pose={config.pose}
          signal={config.signal}
          size={size * 0.94}
          shadow={false}
        />
      </span>
      <div
        className={cx(
          "relative min-w-0 flex-1 rounded-[18px] px-4 py-3 text-[15px] leading-[22px]",
          side === "left" ? "rounded-bl-sm" : "rounded-br-sm",
          tone === "good"
            ? "bg-success-soft text-success-ink"
            : tone === "bad"
              ? "bg-danger-soft text-danger-ink"
              : "bg-cream text-primary",
        )}
      >
        {title && (
          <p className="t-overline mb-1 text-[10.5px] opacity-80">{title}</p>
        )}
        <div className="font-semibold [&_strong]:font-extrabold">{children}</div>
        {action && <div className="mt-2.5">{action}</div>}
      </div>
    </div>
  );
}

/* ── Vacío, carga y esqueletos ────────────────────────────────── */

/** Estado vacío: ilustración, título corto, una frase y una acción. Nunca una pantalla en blanco. */
export function EmptyState({
  illustration = "connect",
  title,
  description,
  action,
  className,
  size = 168,
}: {
  illustration?: IllustrationName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  size?: number;
}) {
  return (
    <div
      className={cx(
        "flex flex-col items-center px-6 py-10 text-center",
        className,
      )}
    >
      <Illustration name={illustration} size={size} />
      <h3 className="t-heading mt-3 text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-md text-[15px] leading-[22px] text-ink-soft">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Skeleton({
  className,
  dark,
}: {
  className?: string;
  dark?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cx(
        "relative block overflow-hidden rounded-xs",
        dark ? "bg-accent-soft/12" : "bg-[var(--skeleton)]",
        className,
      )}
    >
      <span
        className="absolute inset-0 -translate-x-full animate-shimmer"
        style={{
          backgroundImage: `linear-gradient(90deg, transparent, ${dark ? "rgba(167,212,237,.22)" : "var(--skeleton-shine)"}, transparent)`,
        }}
      />
    </span>
  );
}

/** Ondas Wi-Fi que se encienden en secuencia: cargas de más de un segundo. */
export function SignalSpinner({
  size = 40,
  label = "Cargando",
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  return (
    <svg
      role="progressbar"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      className={className}
    >
      <circle cx="12" cy="19.2" r="1.3" fill="currentColor" stroke="none" />
      {[
        "M8.8 15.7a4.8 4.8 0 0 1 6.4 0",
        "M5.6 12.3a9.5 9.5 0 0 1 12.8 0",
        "M2.5 8.8a14 14 0 0 1 19 0",
      ].map((d, index) => (
        <path
          key={d}
          d={d}
          className="animate-twinkle"
          style={{ animationDelay: `${index * 220}ms`, animationDuration: "660ms" }}
        />
      ))}
    </svg>
  );
}

export function PageLoader({ label = "Preparando tu espacio…" }: { label?: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-ink-accent">
      <SignalSpinner size={44} label={label} />
      <p className="t-label text-ink-soft">{label}</p>
    </div>
  );
}
