import { useEffect, useState } from "react";
import { useApp } from "../lib/context";
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
  const [arduino, setArduino] = useState(false);
  useEffect(() => {
    if (!app.usbChoice) setArduino(false);
  }, [app.usbChoice]);
  return (
    <Modal
      open={Boolean(app.usbChoice)}
      onClose={app.cancelUSBChoice}
      title={arduino ? "¿Tu Arduino es Uno o Nano?" : "Reconozcamos tu placa"}
      description={
        arduino
          ? "Elige tu Uno o Nano clásico con ATmega328P."
          : "El puerto ya está elegido. ¿Qué placa estás conectando?"
      }
      icon="usb"
      size="sm"
    >
      <div className="grid gap-3">
        {arduino ? (
          <>
            <Button
              size="lg"
              aria-label="Arduino Uno"
              onClick={() => void app.chooseUSBBoard("uno")}
            >
              <BoardThumbnail model="uno" />
              Arduino Uno
            </Button>
            <Button
              size="lg"
              variant="outline"
              aria-label="Arduino Nano"
              onClick={() => void app.chooseUSBBoard("nano")}
            >
              <BoardThumbnail model="nano" />
              Arduino Nano
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setArduino(false)}>
              Volver
            </Button>
          </>
        ) : (
          <>
            <Button
              size="lg"
              aria-label="Raspberry Pi Pico"
              onClick={() => void app.chooseUSBBoard("pico")}
            >
              <BoardThumbnail model="pico" /> Raspberry Pi Pico
            </Button>
            <Button
              size="lg"
              variant="outline"
              aria-label="Arduino Uno / Nano"
              onClick={() => setArduino(true)}
            >
              <BoardThumbnail model="uno" /> Arduino Uno / Nano
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
