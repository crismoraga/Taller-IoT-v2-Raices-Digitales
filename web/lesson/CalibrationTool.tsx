import { useEffect, useState } from "react";
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
  {
    label: string;
    pin: number;
    arduinoPin: string;
    low: string;
    high: string;
    lowHint: string;
    highHint: string;
  }
> = {
  soil: {
    label: "Humedad del suelo",
    pin: 26,
    arduinoPin: "A0",
    low: "Seco",
    high: "Húmedo",
    lowHint:
      "Pon la sonda al aire o en tierra seca. Espera a que la lectura se estabilice.",
    highHint: "Ahora introduce la sonda hasta su línea en tierra húmeda.",
  },
  water_level: {
    label: "Nivel de agua",
    pin: 28,
    arduinoPin: "A2",
    low: "Vacío",
    high: "Máximo",
    lowHint: "Pon el sensor fuera del agua: será tu referencia de nivel vacío.",
    highHint:
      "Introduce las pistas en el agua hasta el nivel que llamarás 100 %.",
  },
};

/** Two real ADC references define the group's relative percentage, regardless of ADC direction. */
export function CalibrationTool() {
  const app = useApp();
  const [target, setTarget] = useState<Target>("soil");
  const info = TARGETS[target];
  const stored = app.session?.calibrations[target];
  const [low, setLow] = useState(stored ? String(stored.dry) : "");
  const [high, setHigh] = useState(stored ? String(stored.wet) : "");
  const [phase, setPhase] = useState<1 | 2 | 3>(stored ? 3 : 1);
  const [capturing, setCapturing] = useState<"low" | "high" | null>(null);
  const [saving, setSaving] = useState(false);
  const pico = app.board === "pico";
  const max = pico ? 65535 : 1023;
  const minimumGap = pico ? 500 : 8;

  useEffect(() => {
    const saved = app.session?.calibrations[target];
    // Changing the group or MCU must not retain another board's ADC draft.
    setLow(saved && saved.dry <= max ? String(saved.dry) : "");
    setHigh(saved && saved.wet <= max ? String(saved.wet) : "");
    setPhase(saved && saved.dry <= max && saved.wet <= max ? 3 : 1);
  }, [app.session?.id, app.board]);

  const pick = (next: Target) => {
    if (capturing || app.busy || saving) return;
    setTarget(next);
    const saved = app.session?.calibrations[next];
    setLow(saved && saved.dry <= max ? String(saved.dry) : "");
    setHigh(saved && saved.wet <= max ? String(saved.wet) : "");
    setPhase(1);
  };

  const latestRaw = app.localReadings
    .filter(
      (reading) => reading.sensor === target && reading.source === "hardware",
    )
    .sort(
      (a, b) =>
        new Date(b.timestamp || 0).getTime() -
        new Date(a.timestamp || 0).getTime(),
    )[0];
  const live = latestRaw?.raw;

  const capture = async (which: "low" | "high") => {
    if (!app.connected || app.busy || capturing) return;
    setCapturing(which);
    try {
      let raw: number;
      if (pico) {
        const output = await app.queryPico(
          `from machine import ADC, Pin\nfrom time import sleep_ms\na=ADC(Pin(${info.pin}))\ns=[]\nfor _ in range(20):\n s.append(a.read_u16())\n sleep_ms(25)\nprint('RAW:',sum(s)//len(s))`,
        );
        const match = /RAW:\s*(\d+)/.exec(output);
        if (!match)
          throw new Error(
            "La Pico todavía no entregó muestras. Sigue la conexión del sensor en su actividad y vuelve a capturar.",
          );
        raw = Number(match[1]);
      } else {
        const capturedAt = Date.parse(latestRaw?.timestamp || "");
        if (
          typeof live !== "number" ||
          !Number.isFinite(capturedAt) ||
          Date.now() - capturedAt > 20000 ||
          capturedAt - Date.now() > 1000 ||
          ["DISABLED", "ERROR", "NO_RESPONSE"].includes(latestRaw.status)
        )
          throw new Error(
            "Ejecuta la estación Arduino para recibir un RAW USB reciente de este sensor. También puedes escribir una lectura real de la terminal.",
          );
        raw = live;
      }
      if (!Number.isInteger(raw) || raw < 0 || raw > max)
        throw new Error(
          `Esta placa entrega lecturas enteras entre 0 y ${max}. Vuelve a tomar la referencia.`,
        );
      if (which === "low") {
        setLow(String(raw));
        setPhase(2);
      } else {
        setHigh(String(raw));
        setPhase(3);
      }
      app.notify(
        pico
          ? `Referencia capturada: promedio real de 20 muestras = ${raw}.`
          : `Referencia tomada de tu Arduino por USB: ${raw}.`,
      );
    } catch (problem) {
      app.notify(
        problem instanceof Error ? problem.message : String(problem),
        "error",
      );
    } finally {
      setCapturing(null);
    }
  };

  const lowNumber = Number(low);
  const highNumber = Number(high);
  const referenceValid = (value: string) =>
    value !== "" &&
    Number.isInteger(Number(value)) &&
    Number(value) >= 0 &&
    Number(value) <= max;
  const filled = low !== "" && high !== "";
  const gap = Math.abs(lowNumber - highNumber);
  const problem = !filled
    ? null
    : !referenceValid(low) || !referenceValid(high)
      ? `Usa lecturas enteras entre 0 y ${max.toLocaleString("es-CL")}.`
      : gap < minimumGap
        ? `Las referencias son muy parecidas (diferencia ${gap}). Vuelve a tomar una: necesitamos al menos ${minimumGap} de diferencia.`
        : null;
  const valid = filled && !problem;
  const changed =
    !stored || stored.dry !== lowNumber || stored.wet !== highNumber;
  const percent =
    valid && typeof live === "number" && Number.isFinite(live)
      ? Math.max(
          0,
          Math.min(100, (100 * (live - lowNumber)) / (highNumber - lowNumber)),
        )
      : null;

  const save = async () => {
    if (!valid || !app.session || saving) return;
    setSaving(true);
    try {
      await app.updateSession({
        calibrations: {
          ...app.session.calibrations,
          [target]: { dry: lowNumber, wet: highNumber },
        },
      });
      app.notify(
        "¡Tu sensor ya conoce sus referencias! La próxima instalación de estación las usará.",
      );
    } catch (failure) {
      app.notify(
        failure instanceof Error ? failure.message : String(failure),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const reference = (which: "low" | "high") => {
    const value = which === "low" ? low : high;
    const set = which === "low" ? setLow : setHigh;
    const name = which === "low" ? info.low : info.high;
    return (
      <div className="grid gap-5 rounded-xl border border-border bg-surface-alt p-5 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.8fr)]">
        <div className="flex flex-col items-start gap-3">
          <span className="flex size-14 items-center justify-center rounded-full bg-highlight text-ink-accent">
            <Icon name={which === "low" ? "sun" : "drop"} size={30} />
          </span>
          <h4 className="font-display text-xl font-extrabold text-ink">
            {phase}. Referencia «{name.toLowerCase()}»
          </h4>
          <p className="max-w-md text-base leading-relaxed text-ink">
            {which === "low" ? info.lowHint : info.highHint}
          </p>
          <Button
            variant="secondary"
            icon="gauge"
            disabled={!app.connected || app.busy || !!capturing}
            loading={capturing === which}
            onClick={() => void capture(which)}
          >
            {pico ? "Capturar 20 muestras" : "Tomar lectura USB"}
          </Button>
          {pico && (
            <p className="text-sm text-ink-soft">
              La captura pausa el programa. Al terminar, vuelve a Ejecutar.
            </p>
          )}
          {capturing && (
            <p role="status" className="text-sm font-semibold text-ink-accent">
              {pico
                ? "Tomando muestras en tu placa…"
                : "Leyendo la señal USB de tu Arduino…"}
            </p>
          )}
        </div>
        <div className="flex flex-col justify-center gap-4 rounded-xl bg-surface p-4">
          {referenceValid(value) && (
            <Tag tone="success" icon="check">
              Referencia lista
            </Tag>
          )}
          <Field
            label={`Lectura cruda «${name.toLowerCase()}»`}
            hint="Se completa al capturar. También puedes escribir el RAW real de la terminal."
          >
            {(props) => (
              <Input
                {...props}
                type="number"
                inputMode="numeric"
                min={0}
                max={max}
                step={1}
                value={value}
                placeholder={`0 a ${max.toLocaleString("es-CL")}`}
                onChange={(event) => set(event.target.value)}
                className="t-mono"
              />
            )}
          </Field>
          <Button
            iconRight="arrowRight"
            disabled={!referenceValid(value) || !!capturing}
            onClick={() => setPhase(which === "low" ? 2 : 3)}
          >
            {which === "low"
              ? "Continuar a la referencia húmeda"
              : "Ver mi escala"}
          </Button>
        </div>
      </div>
    );
  };

  return (
    <section className="solarpunk-discovery-card flex flex-col gap-4 rounded-xl border border-border bg-surface p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="t-overline text-ink-accent">
            Descubrimiento · calibración
          </p>
          <h3 className="mt-1 font-display text-xl font-extrabold text-ink">
            Dos referencias. Tu propia escala.
          </h3>
        </div>
        <Segmented<Target>
          label="Sensor a calibrar"
          value={target}
          onChange={pick}
          options={[
            {
              value: "soil",
              label: `Suelo · ${pico ? "GP26" : "A0"}`,
              icon: "sprout",
            },
            {
              value: "water_level",
              label: `Agua · ${pico ? "GP28" : "A2"}`,
              icon: "drop",
            },
          ]}
        />
      </div>
      <nav className="grid grid-cols-3 gap-2" aria-label="Pasos de calibración">
        {([1, 2, 3] as const).map((step) => (
          <button
            key={step}
            aria-current={phase === step ? "step" : undefined}
            onClick={() => setPhase(step)}
            disabled={!!capturing || saving}
            className={cx(
              "rounded-lg border px-2 py-3 text-sm font-bold transition-colors",
              phase === step
                ? "border-accent bg-highlight text-ink-accent"
                : "border-border bg-surface-alt text-ink-soft",
            )}
          >
            {step}.{" "}
            {step === 1 ? info.low : step === 2 ? info.high : "Mi escala"}
          </button>
        ))}
      </nav>
      {phase === 1 && reference("low")}
      {phase === 2 && reference("high")}
      {phase === 3 && (
        <div className="flex flex-col gap-4 rounded-xl bg-surface-alt p-5">
          <h4 className="font-display text-xl font-bold text-ink">
            3. Tu sensor ya tiene una escala
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="text-sm text-ink-soft">{info.low} · 0 %</span>
              <strong className="mt-1 block font-mono text-xl text-ink">
                {low || "Por capturar"}
              </strong>
            </div>
            <div className="rounded-xl border border-border bg-surface p-4">
              <span className="text-sm text-ink-soft">{info.high} · 100 %</span>
              <strong className="mt-1 block font-mono text-xl text-ink">
                {high || "Por capturar"}
              </strong>
            </div>
          </div>
          {percent !== null && (
            <div>
              <div className="mb-2 flex items-center justify-between gap-2 text-sm font-bold text-ink">
                <span>Lectura USB: {live}</span>
                <span>{percent.toFixed(0)} %</span>
              </div>
              <div
                className="h-4 overflow-hidden rounded-full bg-surface"
                role="meter"
                aria-label="Lectura relativa del sensor"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(percent)}
              >
                <div
                  className="h-full rounded-full bg-action transition-[width] duration-500 motion-reduce:transition-none"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </div>
          )}
          {problem && (
            <Callout tone="info" compact title="Ajustemos las referencias">
              {problem}
            </Callout>
          )}
          {!filled && (
            <p className="text-sm text-ink-soft">
              Toca «1. {info.low}» o «2. {info.high}» para completar las
              referencias.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <Button
              icon="check"
              disabled={!valid || !app.session || !changed}
              loading={saving}
              onClick={() => void save()}
            >
              Guardar calibración
            </Button>
            {stored && (
              <p className="text-sm font-semibold text-success-ink">
                Guardada: {info.low.toLowerCase()} {stored.dry} ·{" "}
                {info.high.toLowerCase()} {stored.wet}
              </p>
            )}
          </div>
          <details className="simple-details">
            <summary>
              Descubre cómo se transforma el número en porcentaje
            </summary>
            <p className="mt-3 overflow-x-auto whitespace-nowrap rounded-lg bg-surface p-3 font-mono text-sm text-ink">
              % = 100 × (RAW − {low || info.low.toLowerCase()}) ÷ (
              {high || info.high.toLowerCase()} −{" "}
              {low || info.low.toLowerCase()})
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              La escala pertenece a esta sonda y a tus dos referencias. Puedes
              repetirla cuando cambie el sustrato.
            </p>
          </details>
        </div>
      )}
    </section>
  );
}
