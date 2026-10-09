import { cx } from "../ui/cx";

/**
 * Marca del taller: el emblema de Telemática USM (se usa el archivo tal cual, nunca
 * redibujado) junto al nombre «Raíces Digitales» en Montserrat 800.
 * `dark`: sobre bosque nocturno (crema + lima). `light`: sobre fondos claros.
 */
export function Brand({
  tone = "dark",
  compact = false,
  className,
}: {
  tone?: "dark" | "light";
  /** Solo el emblema, para la barra lateral plegada. */
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("flex items-center gap-3", className)}>
      <img
        src="/brand/telematica-usm.png"
        alt="Emblema de Telemática USM"
        width={44}
        height={44}
        className="size-11 shrink-0"
        decoding="async"
      />
      {!compact && (
        <span className="flex min-w-0 flex-col leading-none">
          <span
            className={cx(
              "font-display text-[1.125rem] font-extrabold tracking-[-0.02em]",
              tone === "dark" ? "text-cream" : "text-ink",
            )}
          >
            Raíces{" "}
            <span
              className={tone === "dark" ? "text-accent" : "text-ink-accent"}
            >
              Digitales
            </span>
          </span>
          <span
            className={cx(
              "mt-1.5 font-display text-[10px] font-bold uppercase tracking-[0.2em]",
              tone === "dark" ? "text-accent-soft" : "text-ink-soft",
            )}
          >
            Taller IoT 2.0
          </span>
        </span>
      )}
    </span>
  );
}
