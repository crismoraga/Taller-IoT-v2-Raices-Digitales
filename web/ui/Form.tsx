import {
  forwardRef,
  useId,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Icon } from "../brand/Graphics";
import { cx } from "./cx";

const control =
  "focus-ring w-full rounded-sm border-[1.5px] border-border bg-surface px-3.5 text-[15px] font-semibold text-ink placeholder:font-normal placeholder:text-ink-soft/80 transition-colors hover:border-border-strong focus:border-ink-accent disabled:bg-surface-alt disabled:text-ink-soft aria-invalid:border-danger";

/** Etiqueta + control + ayuda/errores enlazados por id. Toda entrada lleva etiqueta visible. */
export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional,
}: {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Recibe el id y los aria-* que debe llevar el control. */
  children: (props: {
    id: string;
    "aria-describedby"?: string;
    "aria-invalid"?: boolean;
  }) => ReactNode;
  className?: string;
  optional?: boolean;
}) {
  const id = useId();
  const describedBy =
    [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <label
        htmlFor={id}
        className="t-label flex items-baseline gap-2 text-ink"
      >
        {label}
        {optional && (
          <span className="text-xs font-semibold text-ink-soft">opcional</span>
        )}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
      })}
      {hint && (
        <p
          id={`${id}-hint`}
          className="text-[13px] leading-[18px] text-ink-soft"
        >
          {hint}
        </p>
      )}
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="flex items-start gap-1.5 text-[13px] font-semibold leading-[18px] text-danger-text"
        >
          <Icon name="alert" size={14} className="mt-0.5" />
          {error}
        </p>
      )}
    </div>
  );
}

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return (
    <input ref={ref} className={cx(control, "h-12", className)} {...rest} />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cx(control, "min-h-24 py-3 leading-[22px]", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <span className="relative block">
      <select
        ref={ref}
        className={cx(control, "h-12 appearance-none pr-10", className)}
        {...rest}
      >
        {children}
      </select>
      <Icon
        name="chevronDown"
        size={18}
        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-soft"
      />
    </span>
  );
});

/** Interruptor accesible (role="switch") con etiqueta y descripción opcional. */
export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  className,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: ReactNode;
  description?: ReactNode;
  disabled?: boolean;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cx("flex items-start gap-3", className)}>
      <button
        type="button"
        role="switch"
        id={id}
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          "focus-ring relative mt-0.5 h-7 w-12 shrink-0 rounded-pill transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-success" : "bg-border-strong",
        )}
      >
        <span
          className={cx(
            "absolute left-1 top-1 flex size-5 items-center justify-center rounded-full bg-white text-success shadow-soft transition-transform duration-200 ease-spring",
            checked && "translate-x-5",
          )}
        >
          {checked && <Icon name="check" size={12} strokeWidth={3} />}
        </span>
      </button>
      <label htmlFor={id} className="min-w-0 flex-1">
        <span className="t-label block text-ink">{label}</span>
        {description && (
          <span
            id={`${id}-d`}
            className="mt-0.5 block text-[13px] leading-[18px] text-ink-soft"
          >
            {description}
          </span>
        )}
      </label>
    </div>
  );
}

/** Casilla grande para verificaciones del estudiante («Comprobé que…»). */
export function Checkbox({
  checked,
  onChange,
  children,
  className,
  onDark,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <label
      className={cx(
        "group flex min-h-11 cursor-pointer items-start gap-3 rounded-sm py-1.5",
        className,
      )}
    >
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span
        className={cx(
          "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-[7px] border-2 transition-colors peer-focus-visible:ring-4 peer-focus-visible:ring-accent/35",
          checked
            ? "border-success bg-success text-white"
            : onDark
              ? "border-accent-soft/70 bg-transparent text-transparent"
              : "border-border-strong bg-surface text-transparent group-hover:border-ink-accent",
        )}
      >
        <Icon name="check" size={15} strokeWidth={3} />
      </span>
      <span
        className={cx(
          "text-[15px] font-semibold leading-[22px]",
          onDark ? "text-cream" : "text-ink",
        )}
      >
        {children}
      </span>
    </label>
  );
}

/** Deslizador con valor visible, para simuladores y umbrales. */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  format,
  minLabel,
  maxLabel,
  className,
  disabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  format?: (value: number) => string;
  minLabel?: string;
  maxLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const percent = ((value - min) / (max - min)) * 100;
  return (
    <div className={cx("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="t-label text-ink">
          {label}
        </label>
        <output
          htmlFor={id}
          className="tabular font-display text-[15px] font-extrabold text-ink"
        >
          {format ? format(value) : `${value}${unit ? ` ${unit}` : ""}`}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
        className="rd-slider focus-ring h-7 w-full cursor-pointer appearance-none rounded-pill bg-transparent disabled:opacity-50"
        style={{ "--fill": `${percent}%` } as CSSProperties}
      />
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-xs font-semibold text-ink-soft">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
