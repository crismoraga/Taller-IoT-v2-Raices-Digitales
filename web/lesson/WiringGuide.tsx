import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Icon } from "../brand/Graphics";
import { BreadboardView } from "../circuit/BreadboardView";
import {
  RAIL_INFO,
  isPoint,
  parsePoint,
  shortPoint,
  stripOf,
} from "../circuit/breadboard";
import {
  WIRE_HEX,
  WIRE_MEANING,
  type Circuit,
  type WiringStep,
} from "../circuit/model";
import { analyze } from "../circuit/netlist";
import { partDef } from "../circuit/parts";
import { picoPinForStrip } from "../circuit/pico";
import { useApp } from "../lib/context";
import { readLocal, writeLocal } from "../lib/theme";
import { ConnectButton } from "../shell/ConnectButton";
import { Button } from "../ui/Button";
import { Segmented, Tag } from "../ui/Card";
import { Callout } from "../ui/Feedback";
import { Checkbox } from "../ui/Form";
import { Disclosure } from "../ui/Layout";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";
const CircuitExperience = lazy(() => import("../experience/CircuitExperience"));

/** Qué hay en un extremo: un agujero (con su pin de la Pico, si lo tiene) o un pin de módulo. */
function endpointInfo(
  circuit: Circuit,
  endpoint: string,
): { label: string; sub: string } {
  if (isPoint(endpoint)) {
    const point = parsePoint(endpoint);
    if (point.kind === "rail")
      return {
        label: `Riel ${RAIL_INFO[point.rail].color} (${RAIL_INFO[point.rail].sign})`,
        sub: `de ${point.rail.startsWith("t") ? "arriba" : "abajo"}, frente al ${point.column}`,
      };
    const pin = picoPinForStrip(stripOf(endpoint));
    return {
      label: shortPoint(endpoint),
      sub: pin
        ? `${pin.name} · pin ${pin.physical}`
        : `letra ${point.letter}, número ${point.column}`,
    };
  }
  const [partId, pinId] = endpoint.split(".");
  const part = circuit.parts.find((candidate) => candidate.id === partId);
  const pin =
    part && partDef(part).pins.find((candidate) => candidate.id === pinId);
  return { label: pin?.label ?? pinId, sub: part?.label ?? "" };
}

function EndpointChip({ label, sub }: { label: string; sub: string }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col rounded-sm border border-border bg-surface-alt px-3 py-2">
      <span className="t-mono truncate text-[15px] font-extrabold leading-5 text-ink">
        {label}
      </span>
      <span className="truncate text-xs font-semibold leading-4 text-ink-soft">
        {sub}
      </span>
    </span>
  );
}

const KIND: Record<
  WiringStep["kind"],
  { text: string; icon: "cable" | "cube" | "eye" | "tap" }
> = {
  wire: { text: "Conecta un cable", icon: "cable" },
  place: { text: "Coloca una pieza", icon: "cube" },
  check: { text: "Comprueba", icon: "eye" },
  prepare: { text: "Prepara", icon: "tap" },
};

/**
 * Conexión paso a paso: una sola acción a la vez, con sus agujeros exactos, el cable
 * resaltado en el diagrama y la advertencia eléctrica justo en el paso donde aplica.
 */
export function WiringGuide({
  circuit,
  storageKey,
  onDone,
}: {
  circuit: Circuit;
  /** Clave para recordar en qué paso iba el grupo. */
  storageKey: string;
  onDone?: () => void;
}) {
  const app = useApp();
  const total = circuit.steps.length;
  // −1 = preparación · 0…n−1 = pasos · n = revisión final
  const [position, setPosition] = useState(() =>
    Math.max(-1, Math.min(total, readLocal<number>(storageKey, -1))),
  );
  const [verified, setVerified] = useState<Record<string, boolean>>({});
  const [nudge, setNudge] = useState(false);
  const [view, setView] = useState<"step" | "all">("step");
  const [dimension, setDimension] = useState<"3d" | "2d">("3d");
  useEffect(() => writeLocal(storageKey, position), [storageKey, position]);
  useEffect(() => setNudge(false), [position]);

  const step =
    position >= 0 && position < total ? circuit.steps[position] : undefined;
  const check = useMemo(
    () => analyze(circuit, { splitRails: true, vbus: 5.25 }),
    [circuit],
  );

  const go = (next: number) => setPosition(Math.max(-1, Math.min(total, next)));
  const advance = () => {
    if (app.guided && step?.verify && !verified[step.id]) {
      setNudge(true);
      return;
    }
    if (position === total) onDone?.();
    else go(position + 1);
  };

  const wire = step?.wires?.length
    ? circuit.wires.find((candidate) => candidate.id === step.wires![0])
    : undefined;
  const placed = (step?.parts ?? [])
    .map((id) => circuit.parts.find((candidate) => candidate.id === id))
    .filter((part) => part !== undefined);

  return (
    <div
      className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_392px]"
      onKeyDown={(event) => {
        if ((event.target as HTMLElement).closest("input, textarea, select"))
          return;
        if (event.key === "ArrowRight") advance();
        if (event.key === "ArrowLeft") go(position - 1);
      }}
    >
      <div className="flex min-w-0 flex-col gap-2.5">
        <div
          className={
            dimension === "3d"
              ? "min-w-0"
              : "h-[340px] sm:h-[420px] xl:h-[520px]"
          }
        >
          {dimension === "3d" ? (
            <Suspense
              fallback={
                <div className="grid h-full place-items-center rounded-lg bg-surface-alt text-ink-soft">
                  Preparando tu circuito 3D…
                </div>
              }
            >
              <CircuitExperience
                circuit={circuit}
                activeStep={position}
                mode={view === "all" || position >= total ? "all" : "step"}
              />
            </Suspense>
          ) : (
            <BreadboardView
              circuit={circuit}
              stepIndex={position}
              complete={view === "all" || position >= total}
              description={step ? `${step.title}. ${step.detail}` : undefined}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            size="sm"
            label="Vista del circuito"
            value={dimension}
            onChange={setDimension}
            options={[
              { value: "3d", label: "3D interactivo", icon: "cube" },
              { value: "2d", label: "Plano 2D", icon: "layers" },
            ]}
          />
          <Segmented
            size="sm"
            label="Qué mostrar en el diagrama"
            value={view}
            onChange={setView}
            options={[
              { value: "step", label: "Paso a paso", icon: "steps" },
              { value: "all", label: "Montaje completo", icon: "layers" },
            ]}
          />
          <p className="flex items-center gap-3 text-xs font-bold text-ink-soft">
            {(["rojo", "naranja", "negro"] as const).map((color) => (
              <span key={color} className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-5 rounded-pill ring-1 ring-border-strong"
                  style={{ background: WIRE_HEX[color] }}
                />
                {color === "rojo"
                  ? "3,3 V"
                  : color === "naranja"
                    ? "5 V"
                    : "GND"}
              </span>
            ))}
          </p>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-3">
        <section
          aria-live="polite"
          className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-[18px]"
        >
          <div>
            <div className="flex items-center justify-between gap-3">
              <p className="t-overline text-ink-accent">
                {position < 0
                  ? "Antes de cablear"
                  : position >= total
                    ? "Revisión final"
                    : `Paso ${position + 1} de ${total}`}
              </p>
              {step && (
                <Tag
                  tone={step.kind === "wire" ? "sky" : "neutral"}
                  icon={KIND[step.kind].icon}
                >
                  {KIND[step.kind].text}
                </Tag>
              )}
            </div>
            <SegmentedProgress
              className="mt-2.5"
              total={total}
              done={Math.max(0, position)}
              current={position}
              onDark={false}
              label="Avance del cableado"
            />
          </div>

          {position < 0 && <Intro />}

          {step && (
            <>
              <h3 className="t-heading text-ink">{step.title}</h3>
              {wire && (
                <div>
                  <div className="flex items-stretch gap-2">
                    <EndpointChip {...endpointInfo(circuit, wire.from)} />
                    <span className="flex items-center text-ink-soft">
                      <Icon name="arrowRight" size={18} />
                    </span>
                    <EndpointChip {...endpointInfo(circuit, wire.to)} />
                  </div>
                  <p className="mt-2 flex items-center gap-2 text-[13px] font-bold leading-[18px] text-ink">
                    <span
                      className="h-3 w-7 shrink-0 rounded-pill ring-1 ring-border-strong"
                      style={{ background: WIRE_HEX[wire.color] }}
                    />
                    {wire.kind === "cable" ? "Hilo" : "Cable"} {wire.color} ·
                    lleva {wire.carries}
                    {WIRE_MEANING[wire.color] && (
                      <span className="font-semibold text-ink-soft">
                        ({WIRE_MEANING[wire.color]})
                      </span>
                    )}
                  </p>
                </div>
              )}
              {!wire &&
                placed.map(
                  (part) =>
                    part.holes && (
                      <div key={part.id} className="flex flex-wrap gap-2">
                        {Object.entries(part.holes).map(([pinId, hole]) => {
                          const pin = partDef(part).pins.find(
                            (candidate) => candidate.id === pinId,
                          );
                          return (
                            <EndpointChip
                              key={pinId}
                              label={shortPoint(hole)}
                              sub={
                                pin?.aka?.[0]
                                  ? `${pin.label} · ${pin.aka[0]}`
                                  : (pin?.label ?? pinId)
                              }
                            />
                          );
                        })}
                      </div>
                    ),
                )}
              <p className="text-[15px] leading-[23px] text-ink">
                {step.detail}
              </p>
              {step.shared && (
                <Callout
                  tone="info"
                  compact
                  title="¿Ya lo tienes de una actividad anterior?"
                >
                  Si este cable ya está puesto, déjalo como está y sigue.
                </Callout>
              )}
              {step.warning && (
                <Callout tone="danger" compact title="Cuidado">
                  {step.warning}
                </Callout>
              )}
              {step.tip && (
                <Callout tone="tip" compact>
                  {step.tip}
                </Callout>
              )}
              {step.why && (
                <Disclosure
                  tone="alt"
                  icon="lightbulb"
                  title="¿Por qué se conecta así?"
                >
                  {step.why}
                </Disclosure>
              )}
              {step.verify && (
                <div
                  className={cx(
                    "rounded-md px-3 transition-colors",
                    nudge && !verified[step.id]
                      ? "bg-warning-soft ring-2 ring-warning"
                      : "bg-surface-alt",
                  )}
                >
                  <Checkbox
                    checked={Boolean(verified[step.id])}
                    onChange={(value) =>
                      setVerified((all) => ({ ...all, [step.id]: value }))
                    }
                  >
                    {step.verify}
                  </Checkbox>
                  {nudge && !verified[step.id] && (
                    <p
                      role="alert"
                      className="pb-2.5 text-[13px] font-bold text-warning-ink"
                    >
                      Compruébalo en tu protoboard y marca la casilla para
                      seguir.
                    </p>
                  )}
                </div>
              )}
            </>
          )}

          {position >= total && (
            <Final
              issues={check.issues.length}
              circuit={circuit}
              check={check}
            />
          )}

          <div className="mt-1 flex flex-wrap gap-2">
            <Button
              variant="outline"
              icon="arrowLeft"
              disabled={position < 0}
              onClick={() => go(position - 1)}
              aria-label="Paso anterior"
            >
              Atrás
            </Button>
            <Button
              className="flex-1"
              iconRight={position >= total ? "check" : "arrowRight"}
              onClick={advance}
              disabled={position >= total && !onDone}
            >
              {position < 0
                ? "Empezar a cablear"
                : position >= total
                  ? "Cableado listo"
                  : position === total - 1
                    ? "Listo, revisar"
                    : "Listo, siguiente"}
            </Button>
          </div>
          <p className="hidden items-center gap-1.5 text-xs font-semibold text-ink-soft xl:flex">
            <Icon name="keyboard" size={14} />
            También puedes avanzar con las flechas <kbd>←</kbd> <kbd>→</kbd>
          </p>
        </section>

        <ol className="scrollbar-thin flex max-h-[260px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-1.5">
          {circuit.steps.map((item, index) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => go(index)}
                aria-current={index === position ? "step" : undefined}
                className={cx(
                  "focus-ring flex min-h-10 w-full items-center gap-2.5 rounded-sm px-2.5 py-1.5 text-left text-[13px] leading-[18px]",
                  index === position
                    ? "bg-highlight font-bold text-ink"
                    : "font-semibold text-ink-soft hover:bg-surface-alt hover:text-ink",
                )}
              >
                <span
                  className={cx(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold",
                    index < position
                      ? "bg-success text-white"
                      : index === position
                        ? "bg-action text-action-ink"
                        : "bg-surface-alt text-ink-soft",
                  )}
                >
                  {index < position ? (
                    <Icon name="check" size={13} strokeWidth={3} />
                  ) : (
                    index + 1
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Intro() {
  const app = useApp();
  return (
    <>
      <h3 className="t-heading text-ink">Primero, sin energía</h3>
      {app.connected ? (
        <Callout tone="danger" title="Tu placa está conectada">
          Desconecta el cable USB antes de mover cables o piezas. Con energía,
          un cable mal puesto puede hacer un cortocircuito.
          <div className="mt-2.5">
            <ConnectButton />
          </div>
        </Callout>
      ) : (
        <Callout
          tone="success"
          title="Placa sin conectar: así se cablea"
          compact
        >
          Vuelve a conectar el USB solo cuando termines y hayas revisado todo.
        </Callout>
      )}
      <ul className="flex flex-col gap-2 text-[15px] leading-[22px] text-ink">
        {[
          "Pon la protoboard con el número 1 a tu izquierda.",
          "La Pico va en los números 1 al 20, con el conector USB hacia afuera.",
          "Sigue siempre la letra y el número de cada agujero: «a4» es letra a, número 4.",
        ].map((line) => (
          <li key={line} className="flex gap-2.5">
            <Icon
              name="check"
              size={18}
              className="mt-0.5 text-success"
              strokeWidth={2.6}
            />
            {line}
          </li>
        ))}
      </ul>
    </>
  );
}

function Final({
  circuit,
  check,
  issues,
}: {
  circuit: Circuit;
  check: ReturnType<typeof analyze>;
  issues: number;
}) {
  const app = useApp();
  const volts = Object.entries(check.gpioVolts);
  const peak = volts.length
    ? Math.max(...volts.map(([, value]) => value))
    : null;
  const led = Object.values(check.ledMilliamps)[0];
  return (
    <>
      <h3 className="t-heading text-ink">Revisa antes de dar energía</h3>
      <ul className="flex flex-col gap-2 text-[15px] leading-[22px] text-ink">
        {[
          "Cada cable está en la letra y el número que indica su paso.",
          "Los cables rojos llegan solo a líneas rojas; los negros, solo a líneas azules.",
          ...(circuit.wires.some((wire) => wire.color === "naranja")
            ? ["El cable naranja (5 V) va solo al pin VCC de su sensor."]
            : []),
          "Ninguna pata metálica toca a otra.",
        ].map((line) => (
          <li key={line} className="flex gap-2.5">
            <Icon
              name="checkCircle"
              size={18}
              className="mt-0.5 text-ink-accent"
            />
            {line}
          </li>
        ))}
      </ul>
      <Callout
        tone={issues ? "warning" : "success"}
        compact
        icon="shieldCheck"
        title="Revisión eléctrica del plano"
      >
        {issues
          ? "Este plano tiene observaciones. Avísale a tu docente."
          : [
              "Sin cortocircuitos.",
              peak !== null
                ? `Ningún pin GP recibe más de ${peak.toFixed(1).replace(".", ",")} V.`
                : null,
              led
                ? `El LED recibe unos ${led.toFixed(1).replace(".", ",")} mA.`
                : null,
            ]
              .filter(Boolean)
              .join(" ")}
      </Callout>
      {!app.connected && (
        <div className="flex flex-wrap items-center gap-3 rounded-md bg-surface-alt p-3">
          <p className="min-w-0 flex-1 text-sm font-bold leading-5 text-ink">
            Todo en orden: ahora sí, conecta el cable USB.
          </p>
          <ConnectButton />
        </div>
      )}
    </>
  );
}
