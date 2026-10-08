import { useState } from "react";
import { Droplets, Sun, Check, ArrowRight } from "lucide-react";
import { useApp } from "../lib/context";
import { serial } from "../lib/serial";
import { Button, Notice } from "./Common";
export default function CalibrationWizard() {
  const app = useApp();
  const [sensor, setSensor] = useState("soil"),
    [dry, setDry] = useState(""),
    [wet, setWet] = useState(""),
    [capturing, setCapturing] = useState(false),
    [phase, setPhase] = useState<"dry" | "wet">("dry");
  const pin = sensor === "soil" ? 26 : 28;
  const capture = async (target: "dry" | "wet") => {
    setPhase(target);
    setCapturing(true);
    try {
      if (!app.connected || app.board !== "pico")
        throw new Error(
          "Captura automática disponible con Pico conectada. También puedes introducir lecturas RAW reales desde la terminal.",
        );
      const out = await serial.exec(
        `from machine import ADC, Pin\nfrom time import sleep_ms\na=ADC(Pin(${pin}))\ns=[]\nfor _ in range(20):\n s.append(a.read_u16())\n sleep_ms(25)\nprint('RAW:',sum(s)//len(s))`,
      );
      const m = out.match(/RAW:\s*(\d+)/);
      if (!m)
        throw new Error(
          "La Pico no entregó muestras ADC. Revisa terminal y cableado.",
        );
      if (target === "dry") {
        setDry(m[1]);
        setPhase("wet");
      } else setWet(m[1]);
      app.notify("Promedio de 20 muestras capturado.");
    } catch (e) {
      app.notify((e as Error).message, true);
    } finally {
      setCapturing(false);
    }
  };
  const save = async () => {
    const d = Number(dry),
      w = Number(wet);
    const max = app.board === "pico" ? 65535 : 1023;
    if (
      !dry ||
      !wet ||
      d < 0 ||
      w < 0 ||
      d > max ||
      w > max ||
      Math.abs(d - w) < (max === 65535 ? 500 : 8)
    ) {
      app.notify(
        `Usa dos lecturas distintas entre 0 y ${max}; el rango debe ser suficiente.`,
        true,
      );
      return;
    }
    try {
      await app.updateSession({
        calibrations: {
          ...app.session?.calibrations,
          [sensor]: { dry: d, wet: w },
        },
      });
      app.notify(
        "Calibración guardada para tu grupo. Instala la estación para aplicarla en Pico.",
      );
    } catch (e) {
      app.notify((e as Error).message, true);
    }
  };
  return (
    <div className="calibration-wizard">
      <div className="section-heading">
        <h3>Enséñale a tu sensor qué es seco y húmedo.</h3>
        <Droplets size={23} />
      </div>
      <label>
        Sensor a calibrar
        <select
          value={sensor}
          onChange={(e) => {
            setSensor(e.target.value);
            setDry("");
            setWet("");
            setPhase("dry");
          }}
        >
          <option value="soil">Humedad del suelo · GP26</option>
          <option value="water_level">Nivel de agua · GP28</option>
        </select>
      </label>
      <div className="calibration-steps">
        <div className={phase === "dry" ? "current" : ""}>
          <Sun size={22} />
          <strong>1. Referencia seca</strong>
          <p>
            {sensor === "soil"
              ? "Mantén la parte sensible al aire."
              : "Mantén la placa fuera del agua."}
          </p>
          <label>
            RAW seco
            <input
              type="number"
              value={dry}
              onChange={(e) => setDry(e.target.value)}
              placeholder="Lectura ADC"
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => void capture("dry")}
            disabled={!app.connected || app.board !== "pico"}
            loading={capturing && phase === "dry"}
          >
            Capturar 20 muestras
          </Button>
        </div>
        <div className={phase === "wet" ? "current" : ""}>
          <Droplets size={22} />
          <strong>2. Referencia húmeda</strong>
          <p>
            {sensor === "soil"
              ? "Introduce solo la sonda en sustrato húmedo."
              : "Sumerge solo las pistas hasta el nivel máximo."}
          </p>
          <label>
            RAW húmedo
            <input
              type="number"
              value={wet}
              onChange={(e) => setWet(e.target.value)}
              placeholder="Lectura ADC"
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => void capture("wet")}
            disabled={!app.connected || app.board !== "pico"}
            loading={capturing && phase === "wet"}
          >
            Capturar 20 muestras
          </Button>
        </div>
      </div>
      <Notice>
        La captura detiene el programa actual. No mojes la electrónica. Este
        porcentaje es relativo a tus referencias; no mide contenido volumétrico
        de agua.
      </Notice>
      <div className="calibration-result">
        <code>% = 100 × (RAW − seco) / (húmedo − seco)</code>
        <Button onClick={() => void save()} disabled={!app.session}>
          <Check size={16} />
          Guardar calibración
        </Button>
      </div>
      {app.session?.calibrations[sensor] && (
        <p className="success-text">
          Guardado: seco {app.session.calibrations[sensor].dry} · húmedo{" "}
          {app.session.calibrations[sensor].wet}
        </p>
      )}
    </div>
  );
}
