import { useState } from "react";
import { Icon } from "../brand/Graphics";
import { useApp } from "../lib/context";
import { Button } from "../ui/Button";
import { Segmented, Tag } from "../ui/Card";
import { Callout } from "../ui/Feedback";
import { Field, Input } from "../ui/Form";
import { cx } from "../ui/cx";

type Target = "soil" | "water_level";

const TARGETS: Record<
  Target,
  { label: string; pin: number; low: string; high: string; lowHint: string; highHint: string }
> = {
  soil: {
    label: "Humedad del suelo",
    pin: 26,
    low: "Seco",
    high: "Húmedo",
    lowHint: "Deja la sonda al aire o en tierra bien seca. Espera unos segundos.",
    highHint: "Entierra la sonda hasta la línea en tierra húmeda, sin mojar la electrónica.",
  },
  water_level: {
    label: "Nivel de agua",
    pin: 28,
    low: "Vacío",
    high: "Máximo",
    lowHint: "Deja el sensor fuera del agua y sécalo.",
    highHint: "Sumerge solo las pistas hasta el nivel que quieras llamar 100 %.",
  },
};

/**
 * Calibración guiada: dos referencias físicas convierten el número crudo del ADC en un
 * porcentaje relativo. Se guarda por grupo y la estación la usa al instalarse.
 */
export function CalibrationTool() {
  const app = useApp();
  const [target, setTarget] = useState<Target>("soil");
  const info = TARGETS[target];
  const stored = app.session?.calibrations[target];
  const [low, setLow] = useState(stored ? String(stored.dry) : "");
  const [high, setHigh] = useState(stored ? String(stored.wet) : "");
  const [capturing, setCapturing] = useState<"low" | "high" | null>(null);
  const [saving, setSaving] = useState(false);
  const pico = app.board === "pico";
  const max = pico ? 65535 : 1023;
  const minimumGap = pico ? 500 : 8;

  const pick = (next: Target) => {
    if (capturing || app.busy) return;
    setTarget(next);
    const saved = app.session?.calibrations[next];
    setLow(saved ? String(saved.dry) : "");
    setHigh(saved ? String(saved.wet) : "");
  };

  const capture = async (which: "low" | "high") => {
    setCapturing(which);
    try {
      // Veinte muestras del ADC, promediadas en la propia placa.
      const output = await app.queryPico(
        `from machine import ADC, Pin\nfrom time import sleep_ms\na=ADC(Pin(${info.pin}))\ns=[]\nfor _ in range(20):\n s.append(a.read_u16())\n sleep_ms(25)\nprint('RAW:',sum(s)//len(s))`,
      );
      const match = /RAW:\s*(\d+)/.exec(output);
      if (!match) throw new Error("La Pico no entregó muestras. Revisa el cableado del sensor.");
      if (which === "low") setLow(match[1]);
      else setHigh(match[1]);
      app.notify(`Capturado: promedio de 20 muestras = ${match[1]}.`);
    } catch (problem) {
      app.notify(problem instanceof Error ? problem.message : String(problem), "error");
    } finally {
      setCapturing(null);
    }
  };

  const lowNumber = Number(low);
  const highNumber = Number(high);
  const filled = low !== "" && high !== "";
  const inRange = [lowNumber, highNumber].every(
    (value) => Number.isFinite(value) && value >= 0 && value <= max,
  );
  const gap = Math.abs(lowNumber - highNumber);
  const problem = !filled
    ? null
    : !inRange
      ? `Las lecturas deben estar entre 0 y ${max.toLocaleString("es-CL")}.`
      : gap < minimumGap
        ? `Las dos referencias son casi iguales (diferencia de ${gap}). Repite la captura: deben diferir en al menos ${minimumGap}.`
        : null;
  const valid = filled && !problem;
  const changed = !stored || stored.dry !== lowNumber || stored.wet !== highNumber;

  const live = app.localReadings.find((reading) => reading.sensor === target)?.raw;
  const percent =
    valid && typeof live === "number"
      ? Math.max(0, Math.min(100, (100 * (live - lowNumber)) / (highNumber - lowNumber)))
      : null;

  const save = async () => {
    setSaving(true);
    try {
      await app.updateSession({
        calibrations: {
          ...app.session?.calibrations,
          [target]: { dry: lowNumber, wet: highNumber },
        },
      });
      app.notify("Calibración guardada. La estación la usará la próxima vez que la instales.");
    } catch (failure) {
      app.notify(failure instanceof Error ? failure.message : String(failure), "error");
    } finally {
      setSaving(false);
    }
  };

  const reference = (which: "low" | "high") => {
    const value = which === "low" ? low : high;
    const set = which === "low" ? setLow : setHigh;
    const name = which === "low" ? info.low : info.high;
    return (
      <div
        className={cx(
          "flex flex-col gap-3 rounded-md border p-4",
          value !== "" ? "border-success/45 bg-success-soft/40" : "border-border bg-surface-alt",
        )}
      >
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action font-display text-sm font-extrabold text-action-ink">
            {which === "low" ? 1 : 2}
          </span>
          <h4 className="t-subtitle text-ink">Referencia «{name.toLowerCase()}»</h4>
          {value !== "" && (
            <Tag tone="success" icon="check" className="ml-auto">
              Lista
            </Tag>
          )}
        </div>
        <p className="text-[15px] leading-[22px] text-ink">
          {which === "low" ? info.lowHint : info.highHint}
        </p>
        <Button
          variant="secondary"
          icon="gauge"
          disabled={!app.connected || !pico || app.busy}
          loading={capturing === which}
          onClick={() => void capture(which)}
        >
          Capturar 20 muestras
        </Button>
        <Field
          label={`Lectura cruda «${name.toLowerCase()}»`}
          hint={
            app.connected && pico
              ? "Se llena sola al capturar. También puedes escribirla."
              : "Sin Pico conectada: escribe el número «raw» que ves en la terminal."
          }
        >
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={0}
              max={max}
              value={value}
              placeholder={`0 a ${max.toLocaleString("es-CL")}`}
              onChange={(event) => set(event.target.value)}
              className="t-mono"
            />
          )}
        </Field>
      </div>
    );
  };

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-[18px] sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="t-overline text-ink-accent">Asistente de calibración</p>
          <h3 className="t-heading mt-1 text-ink">Enséñale a tu sensor dos referencias</h3>
        </div>
        <Segmented<Target>
          label="Sensor a calibrar"
          value={target}
          onChange={pick}
          options={[
            { value: "soil", label: "Suelo · GP26", icon: "sprout" },
            { value: "water_level", label: "Agua · GP28", icon: "drop" },
          ]}
        />
      </div>

      <Callout tone="warning" compact title="La captura detiene el programa que esté corriendo">
        Después de calibrar, vuelve a presionar Ejecutar. Mantén seca la electrónica del sensor.
      </Callout>

      <div className="grid gap-3.5 md:grid-cols-2">
        {reference("low")}
        {reference("high")}
      </div>

      <div className="flex flex-col gap-3 rounded-md bg-surface-alt p-4">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-action font-display text-sm font-extrabold text-action-ink">
            3
          </span>
          <h4 className="t-subtitle text-ink">Convierte la lectura en porcentaje</h4>
        </div>
        <p className="t-mono overflow-x-auto whitespace-nowrap rounded-sm bg-surface px-3 py-2.5 text-ink">
          % = 100 × (lectura − {valid ? lowNumber : info.low.toLowerCase()}) ÷ (
          {valid ? highNumber : info.high.toLowerCase()} − {valid ? lowNumber : info.low.toLowerCase()})
        </p>
        {percent !== null && (
          <p className="flex items-center gap-2 text-[15px] font-bold text-ink">
            <Icon name="activity" size={18} className="text-ink-accent" />
            Lectura actual: {live} → {percent.toFixed(0)} %
          </p>
        )}
        {problem && (
          <p role="alert" className="flex items-start gap-2 text-sm font-bold leading-5 text-danger-text">
            <Icon name="alert" size={16} className="mt-0.5" />
            {problem}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button icon="check" disabled={!valid || !app.session || !changed} loading={saving} onClick={() => void save()}>
            Guardar calibración
          </Button>
          {stored && (
            <p className="text-sm font-semibold text-success-ink">
              Guardada: {info.low.toLowerCase()} {stored.dry} · {info.high.toLowerCase()} {stored.wet}
            </p>
          )}
        </div>
        <p className="text-[13px] leading-[18px] text-ink-soft">
          El porcentaje es relativo a tus dos referencias y a esta sonda. No es una medida de
          laboratorio ni una recomendación de riego: observa también tu planta.
        </p>
      </div>
    </section>
  );
}
