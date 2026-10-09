import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { Icon, type IconName } from "../brand/Graphics";
import { cx } from "./cx";

/**
 * Variantes del botón de la marca:
 *  - primary: acción principal sobre superficies del tema. Una sola por vista.
 *  - cream: acción principal sobre fondos de bosque nocturno.
 *  - accent: avanzar en una secuencia («Siguiente»).
 *  - secondary / subtle: acciones de apoyo dentro de tarjetas.
 *  - outline / outlineLight: alternativas y reintentos (Light sobre azul noche).
 *  - danger / dangerOutline: acciones destructivas, siempre con ícono y confirmación.
 *  - ghost / ghostLight: enlaces de texto (Light sobre azul noche).
 */
export type ButtonVariant =
  | "primary"
  | "cream"
  | "accent"
  | "secondary"
  | "subtle"
  | "outline"
  | "outlineLight"
  | "danger"
  | "dangerOutline"
  | "ghost"
  | "ghostLight";
export type ButtonSize = "sm" | "md" | "lg";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-action text-action-ink hover:brightness-110",
  cream: "bg-cream text-primary hover:bg-cream-soft",
  accent: "bg-accent text-primary hover:bg-accent-soft",
  secondary: "bg-accent-soft text-primary hover:bg-accent",
  subtle: "bg-surface-alt text-ink-accent hover:bg-highlight",
  outline:
    "border-[1.5px] border-ink bg-transparent text-ink hover:bg-surface-alt",
  outlineLight:
    "border-[1.5px] border-accent-soft/55 bg-primary/55 text-cream hover:bg-primary-soft",
  danger: "bg-danger text-white hover:brightness-110",
  dangerOutline:
    "border-[1.5px] border-danger bg-transparent text-danger-text hover:bg-danger-soft",
  ghost: "bg-transparent text-ink-accent hover:bg-surface-alt",
  ghostLight: "bg-transparent text-accent-soft hover:bg-primary-soft",
};
const sizes: Record<ButtonSize, string> = {
  sm: "min-h-11 rounded-sm px-4 gap-2 text-sm font-body font-bold",
  md: "min-h-12 rounded-md px-5 gap-2.5 text-base font-display font-bold",
  lg: "min-h-14 rounded-md px-7 gap-3 text-[1.0625rem] font-display font-bold",
};

interface Shared {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconRight?: IconName;
  loading?: boolean;
  fullWidth?: boolean;
  children?: ReactNode;
}
type ButtonProps = Shared & ButtonHTMLAttributes<HTMLButtonElement>;

export function DotsLoader({ className }: { className?: string }) {
  return (
    <span
      role="progressbar"
      aria-label="Cargando"
      className={cx("inline-flex items-center gap-1", className)}
    >
      {[0, 1, 2].map((index) => (
        <span
          key={index}
          className="size-1.5 animate-dots rounded-full bg-current"
          style={{ animationDelay: `${index * 140}ms` }}
        />
      ))}
    </span>
  );
}

const base =
  "pressable focus-ring inline-flex select-none items-center justify-center whitespace-nowrap text-center leading-5 disabled:bg-border disabled:text-ink-soft disabled:border-transparent disabled:hover:brightness-100 aria-disabled:pointer-events-none aria-disabled:bg-border aria-disabled:text-ink-soft";

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      variant = "primary",
      size = "md",
      icon,
      iconRight,
      loading,
      fullWidth,
      className,
      children,
      disabled,
      type = "button",
      ...rest
    },
    ref,
  ) {
    const iconSize = size === "sm" ? 16 : size === "lg" ? 22 : 19;
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={cx(
          base,
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className,
        )}
        {...rest}
      >
        {loading ? (
          <DotsLoader />
        ) : (
          <>
            {icon && <Icon name={icon} size={iconSize} />}
            {children}
            {iconRight && <Icon name={iconRight} size={iconSize} />}
          </>
        )}
      </button>
    );
  },
);

/** Mismo aspecto que Button, para enlaces reales (navegación externa o descargas). */
export function LinkButton({
  variant = "primary",
  size = "md",
  icon,
  iconRight,
  fullWidth,
  className,
  children,
  ...rest
}: Shared & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const iconSize = size === "sm" ? 16 : size === "lg" ? 22 : 19;
  return (
    <a
      className={cx(
        base,
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {iconRight && <Icon name={iconRight} size={iconSize} />}
    </a>
  );
}

type IconButtonTone = "light" | "dark" | "ghost" | "ghostLight" | "outline";
const iconTones: Record<IconButtonTone, string> = {
  light: "bg-surface-alt text-ink hover:bg-highlight",
  dark: "bg-primary-soft text-cream hover:bg-secondary",
  ghost: "bg-transparent text-ink-soft hover:bg-surface-alt hover:text-ink",
  ghostLight:
    "bg-transparent text-accent-soft hover:bg-primary-soft hover:text-cream",
  outline:
    "border border-border bg-surface text-ink hover:border-border-strong hover:bg-surface-alt",
};

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  /** Nombre accesible obligatorio: el botón no tiene texto visible. */
  label: string;
  tone?: IconButtonTone;
  size?: "sm" | "md";
  active?: boolean;
  badge?: ReactNode;
}

/** Botón de solo ícono. Área táctil mínima de 44 px en ambos tamaños. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      tone = "light",
      size = "md",
      active,
      badge,
      className,
      type = "button",
      ...rest
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-label={label}
        title={label}
        aria-pressed={active}
        className={cx(
          "pressable focus-ring relative inline-flex shrink-0 items-center justify-center disabled:opacity-45",
          size === "md" ? "size-11 rounded-[14px]" : "size-11 rounded-sm",
          iconTones[tone],
          active && "bg-action! text-action-ink!",
          className,
        )}
        {...rest}
      >
        <Icon name={icon} size={size === "md" ? 20 : 17} />
        {badge !== undefined && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-pill bg-cream px-1 text-[10px] font-extrabold leading-none text-primary ring-2 ring-surface">
            {badge}
          </span>
        )}
      </button>
    );
  },
);
