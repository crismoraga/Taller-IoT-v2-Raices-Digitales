import { Icon } from "../brand/Graphics";
import { useApp } from "../lib/context";
import { ProgressBar } from "../ui/Progress";
import { cx } from "../ui/cx";

/** The editor and station installation report the same actual USB operation. */
export function UploadFeedback({
  className,
  retryLabel = "Compilar y cargar",
}: {
  className?: string;
  retryLabel?: string;
}) {
  const app = useApp();
  const upload = app.board !== "pico" ? app.uploadStatus : null;
  if (!upload) return null;
  const label = {
    compile: "1 de 3 · Compilando tu programa",
    sync: "2 de 3 · Conectando con tu Arduino",
    write: "3 de 3 · Grabando y verificando",
    verify: "3 de 3 · Grabando y verificando",
    complete: "Programa grabado y verificado",
    error: "La carga no se completó",
  }[upload.stage];
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Estado de carga del programa"
      className={cx(
        "flex flex-col gap-2 border-t border-border bg-highlight px-3.5 py-3 text-sm text-ink",
        className,
      )}
    >
      <span className="inline-flex items-center gap-2 font-bold">
        <Icon
          name={
            upload.stage === "complete"
              ? "check"
              : upload.stage === "error"
                ? "alert"
                : "usb"
          }
          size={17}
        />
        {label}
      </span>
      {upload.percent !== undefined &&
        upload.stage !== "complete" &&
        upload.stage !== "error" && (
          <ProgressBar
            value={upload.percent}
            label="Avance de grabación y verificación"
          />
        )}
      {upload.stage === "error" && (
        <>
          <p className="text-xs leading-5 text-ink-soft">
            Puedes corregirlo y volver a pulsar «{retryLabel}».
          </p>
          {upload.message && (
            <details className="text-xs leading-5">
              <summary className="cursor-pointer font-bold">
                Detalle de la carga
              </summary>
              <p className="mt-2 whitespace-pre-wrap break-words text-ink-soft">
                {upload.message.slice(0, 1600)}
              </p>
            </details>
          )}
        </>
      )}
    </div>
  );
}
