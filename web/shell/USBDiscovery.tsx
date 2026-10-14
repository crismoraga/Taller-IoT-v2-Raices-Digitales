import { BOARD_NAMES, useApp } from "../lib/context";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Overlay";

/** Decorative silhouettes help beginners compare the physical board in their hand. */
function BoardThumbnail({ model }: { model: "pico" | "uno" | "nano" }) {
  const narrow = model !== "uno";
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 72"
      className="h-14 w-20 shrink-0 drop-shadow-sm"
    >
      {narrow ? (
        <>
          <rect
            x="34"
            y="5"
            width="32"
            height="62"
            rx="3"
            fill={model === "pico" ? "#087d53" : "#087b9c"}
          />
          <rect
            x="42"
            y="2"
            width="16"
            height="12"
            rx="2"
            fill="#dbe7e9"
            stroke="#809294"
          />
          <rect x="44" y="31" width="12" height="12" rx="1" fill="#192929" />
          {Array.from({ length: model === "pico" ? 20 : 15 }, (_, index) => (
            <g key={index} fill="#f6d16d">
              <circle
                cx="36.5"
                cy={15 + index * (model === "pico" ? 2.5 : 3.3)}
                r="1.2"
              />
              <circle
                cx="63.5"
                cy={15 + index * (model === "pico" ? 2.5 : 3.3)}
                r="1.2"
              />
            </g>
          ))}
        </>
      ) : (
        <>
          <path d="M27 8H85L92 15V58L84 65H27Z" fill="#087b9c" />
          <rect
            x="10"
            y="14"
            width="29"
            height="26"
            rx="2"
            fill="#dbe7e9"
            stroke="#809294"
          />
          <rect x="11" y="47" width="23" height="14" rx="2" fill="#172f31" />
          <rect x="39" y="45" width="40" height="10" rx="1" fill="#142425" />
          <rect x="36" y="11" width="48" height="5" rx="1" fill="#172f31" />
          <rect x="58" y="59" width="29" height="5" rx="1" fill="#172f31" />
          <text
            x="58"
            y="33"
            textAnchor="middle"
            fontSize="9"
            fontWeight="bold"
            fill="#e6ffff"
          >
            UNO
          </text>
        </>
      )}
    </svg>
  );
}

/** Only adapters with an ambiguous identity need this small choice. */
export function USBDiscovery() {
  const app = useApp();
  return (
    <Modal
      open={Boolean(app.usbChoice)}
      onClose={app.cancelUSBChoice}
      title="Reconozcamos tu placa"
      description="El puerto ya está elegido. Toca la placa que tienes conectada."
      icon="usb"
      size="sm"
    >
      <div className="grid gap-3">
        {(
          [
            ["uno", "Arduino Uno", "Uno clásico · USB grande y placa ancha"],
            ["nano", "Arduino Nano", "Nano clásico · placa azul y alargada"],
            [
              "pico",
              "Raspberry Pi Pico",
              "Pico / Pico W / Pico 2 / Pico 2 W · MicroPython",
            ],
          ] as const
        ).map(([model, label, description]) => (
          <Button
            key={model}
            size="lg"
            variant="outline"
            className="justify-start border-border bg-surface-alt text-left hover:border-ink-accent"
            aria-label={label}
            onClick={() => void app.chooseUSBBoard(model)}
          >
            <BoardThumbnail model={model} />
            <span className="min-w-0 text-left">
              <span className="block">{label}</span>
              <span className="mt-1 block font-body text-xs font-semibold leading-5 text-ink-soft">
                {description}
              </span>
            </span>
          </Button>
        ))}
      </div>
      <details className="simple-details mt-4">
        <summary>Variantes de Arduino Nano</summary>
        <p className="mt-2 text-sm text-ink-soft">
          El adaptador USB no revela el procesador. Si tu placa indica
          ATmega168, elige esa variante; los Nano ATmega328P ajustan la
          velocidad automáticamente.
        </p>
        <div className="mt-3 grid gap-2">
          {(["nano-old", "nano-168"] as const).map((variant) => (
            <Button
              key={variant}
              variant="outline"
              onClick={() => void app.chooseUSBBoard(variant)}
            >
              {BOARD_NAMES[variant]}
            </Button>
          ))}
        </div>
      </details>
    </Modal>
  );
}
