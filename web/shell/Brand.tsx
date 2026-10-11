import { cx } from "../ui/cx";

/** Original plant-and-circuit mark; institutional affiliation is expressed as text. */
export function Brand({
  tone = "dark",
  compact = false,
  className,
}: {
  tone?: "dark" | "light";
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cx("flex items-center gap-2.5", className)}>
      <img
        src="/brand/raices-symbol.svg"
        alt=""
        width={40}
        height={40}
        className="size-10 shrink-0"
        decoding="async"
      />
      {!compact && (
        <span className="flex min-w-0 flex-col text-left leading-none">
          <span
            className={cx(
              "font-display text-[1.025rem] font-extrabold tracking-[-0.03em]",
              tone === "dark" ? "text-cream" : "text-ink",
            )}
          >
            Raíces Digitales
          </span>
          <span
            className={cx(
              "mt-2 text-xs font-semibold tracking-[0.01em]",
              tone === "dark" ? "text-accent-soft" : "text-ink-soft",
            )}
          >
            Taller IoT · Telemática USM
          </span>
        </span>
      )}
    </span>
  );
}
