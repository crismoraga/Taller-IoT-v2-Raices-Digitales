import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../brand/Graphics";
import { BreadboardView } from "../circuit/BreadboardView";
import { WIRE_HEX, type Circuit, type WiringStep } from "../circuit/model";
import { useApp } from "../lib/context";
import { readLocal, writeLocal } from "../lib/theme";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Card";
import { Disclosure } from "../ui/Layout";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";
import { useDhtPinOrder } from "./dhtLayout";
import {
  circuitProgressSignature,
  configureDhtPinOrder,
  DHT_PIN_ORDERS,
  assemblyEndpointLabel,
  assemblyPartPins,
  endpointInfo,
  firstAssemblyAction,
  identifyAssemblyPart,
  normalizeCircuitSteps,
  restoreAssemblyAction,
  restoreAssemblyPinIndex,
  restoreAssemblyProgress,
  wireItemInfo,
  type AssemblyAction,
  type DhtPinOrder,
} from "./assembly";
const CircuitExperience = lazy(() => import("../experience/CircuitExperience"));

type Endpoint = "a" | "b";
type Props = { circuit: Circuit; storageKey: string; onDone?: () => void };

/** The same board and atomic sequence feed both renderers. */
export function WiringGuide({ circuit: source, storageKey, onDone }: Props) {
  const app = useApp();
  // Switching hardware starts that board's own journey, while retaining the
  // participant's chosen view of the same workbench.
  const [dimension, setDimension] = useState<"3d" | "2d">(() =>
    readLocal<string>("raices.wiring.view", "3d") === "2d" ? "2d" : "3d",
  );
  const [view, setView] = useState<"step" | "all">("step");
  const [dhtPinOrder, setDhtPinOrder] = useDhtPinOrder();
  const hasDht = source.parts.some((part) => part.type === "dht11");
  const circuit = useMemo(
    () => normalizeCircuitSteps(configureDhtPinOrder(source, dhtPinOrder)),
    [source, dhtPinOrder],
  );
  const journeyKey =
    hasDht && dhtPinOrder !== "vcc-data-gnd"
      ? `${storageKey}:dht:${dhtPinOrder}`
      : storageKey;
  const signature = useMemo(
    () => circuitProgressSignature(app.board, circuit),
    [app.board, circuit],
  );
  return (
    <div className="min-w-0 space-y-3">
      {hasDht && (
        <Disclosure
          title="Mi DHT11 tiene otras marcas"
          icon="layers"
          tone="alt"
        >
          <p className="mb-3">
            Mira la rejilla de frente y lee las tres marcas de izquierda a
            derecha. El modelo y cada cable se adaptarán a tu módulo.
          </p>
          <label className="block text-sm font-bold text-ink">
            Marcas de mi DHT11
            <select
              aria-label="Marcas de mi DHT11"
              className="focus-ring mt-2 block min-h-11 w-full rounded-md border border-border bg-surface px-3 text-ink"
              value={dhtPinOrder}
              onChange={(event) => {
                const value = event.target.value as DhtPinOrder;
                setDhtPinOrder(value);
              }}
            >
              {Object.entries(DHT_PIN_ORDERS).map(([value, item]) => (
                <option key={value} value={value}>
                  {item.label} · {item.pins.join(" / ")}
                </option>
              ))}
            </select>
          </label>
          <p className="mt-2 text-xs text-ink-soft">
            Cada orden conserva su propio avance del montaje.
          </p>
        </Disclosure>
      )}
      <WiringSession
        key={`${journeyKey}:${signature}`}
        circuit={circuit}
        storageKey={journeyKey}
        signature={signature}
        onDone={onDone}
        dimension={dimension}
        onDimensionChange={(value) => {
          setDimension(value);
          writeLocal("raices.wiring.view", value);
        }}
        view={view}
        onViewChange={setView}
      />
    </div>
  );
}

function WiringSession({
  circuit,
  storageKey,
  signature,
  onDone,
  dimension,
  onDimensionChange,
  view,
  onViewChange,
}: Props & {
  signature: string;
  dimension: "3d" | "2d";
  onDimensionChange: (value: "3d" | "2d") => void;
  view: "step" | "all";
  onViewChange: (value: "step" | "all") => void;
}) {
  const total = circuit.steps.length;
  const partAt = (candidate?: WiringStep) =>
    circuit.parts.find((part) => part.id === candidate?.parts?.[0]);
  const initialAction = (candidate?: WiringStep) =>
    firstAssemblyAction(candidate, partAt(candidate));
  const [progress, setProgress] = useState(() =>
    restoreAssemblyProgress(
      readLocal<unknown>(storageKey, null),
      signature,
      circuit.steps,
    ),
  );
  const position = Math.max(0, progress.position);
  const step = position < total ? circuit.steps[position] : undefined;
  const placed = partAt(step);
  const [actionState, setActionState] = useState(() => ({
    stepId: step?.id,
    action: step
      ? restoreAssemblyAction(
          readLocal<unknown>(storageKey, null),
          signature,
          step,
          placed,
        )
      : ("done" as AssemblyAction),
  }));
  const action =
    actionState.stepId === step?.id
      ? actionState.action
      : step
        ? initialAction(step)
        : "done";
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>();
  const [requestFocusEndpoint, setRequestFocusEndpoint] = useState<{
    endpoint: Endpoint;
    token: number;
  }>();
  const diagramAnchor = useRef<HTMLDivElement>(null);
  const scrollAfterNavigation = useRef(false);
  const reviewed = (item: WiringStep) =>
    progress.completed[item.id] && (!item.verify || progress.verified[item.id]);
  const frontier = circuit.steps.findIndex((item) => !reviewed(item));
  const reviewedCount = circuit.steps.filter(reviewed).length;
  const wire = circuit.wires.find(
    (candidate) => candidate.id === step?.wires?.[0],
  );
  const [lastConfirmation, setLastConfirmation] = useState<{
    position: number;
    label: string;
  }>();
  const partPins = placed ? assemblyPartPins(placed) : [];
  const [pinState, setPinState] = useState(() => ({
    stepId: step?.id,
    index: step
      ? restoreAssemblyPinIndex(
          readLocal<unknown>(storageKey, null),
          signature,
          step,
          partPins.length,
        )
      : 0,
  }));
  const pinIndex = pinState.stepId === step?.id ? pinState.index : 0;
  const activePin = action === "place" ? partPins[pinIndex] : undefined;
  const [requestFocusPartPin, setRequestFocusPartPin] = useState<{
    partId: string;
    pinId: string;
    token: number;
  }>();
  const wireItem = wire ? wireItemInfo(circuit, wire) : undefined;
  const completedSteps = circuit.steps.filter(
    (item) => reviewed(item) || (item.id === step?.id && action === "done"),
  );
  const cableCount = new Set(completedSteps.flatMap((item) => item.wires ?? []))
    .size;
  const partCount = new Set(completedSteps.flatMap((item) => item.parts ?? []))
    .size;
  const activeEndpoint: Endpoint | undefined =
    wire && (action === "a" || action === "b") ? action : undefined;
  const activeInfo =
    wire && activeEndpoint
      ? endpointInfo(circuit, activeEndpoint === "a" ? wire.from : wire.to)
      : undefined;
  const stageLabel =
    position >= total ? "Montaje completo" : `Paso ${position + 1} de ${total}`;
  const actionTitle = wire
    ? action === "take"
      ? wireItem?.ownLead
        ? `Sigue el hilo ${wire.color} del sensor`
        : `Toma un cable ${wire.color}`
      : action === "a"
        ? wireItem?.a === "hilo del sensor"
          ? `Encuentra el hilo ${wire.color}: ${endpointInfo(circuit, wire.from).label}`
          : `Conecta A en ${endpointInfo(circuit, wire.from).label}`
        : action === "b"
          ? `Conecta B en ${endpointInfo(circuit, wire.to).label}`
          : "¡Cable conectado!"
    : placed
      ? action === "take"
        ? `Toma ${placed.label}`
        : action === "place"
          ? activePin
            ? `Alinea ${activePin.label} con ${endpointInfo(circuit, activePin.hole).label}`
            : (step?.title ?? `Ubica ${placed.label}`)
          : action === "insert"
            ? `Inserta ${placed.label}`
            : "¡Pieza en su lugar!"
      : (step?.title ?? "¡Tu circuito está listo!");

  useEffect(
    () =>
      writeLocal(storageKey, {
        version: 2,
        signature,
        ...progress,
        position,
        journey: step ? { stepId: step.id, action, pinIndex } : undefined,
      }),
    [storageKey, signature, progress, position, step, action, pinIndex],
  );
  useEffect(() => {
    if (!placed || !activePin) return;
    setRequestFocusPartPin((current) => ({
      partId: placed.id,
      pinId: activePin.id,
      token: (current?.token ?? 0) + 1,
    }));
  }, [placed?.id, activePin?.id]);
  useEffect(() => {
    setSelectedEndpoint(undefined);
    if (!scrollAfterNavigation.current) return;
    scrollAfterNavigation.current = false;
    if (window.matchMedia("(min-width: 1280px)").matches) return;
    diagramAnchor.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }, [position]);

  const focusEndpoint = (endpoint: Endpoint) => {
    setSelectedEndpoint(endpoint);
    setRequestFocusEndpoint((current) => ({
      endpoint,
      token: (current?.token ?? 0) + 1,
    }));
  };
  const changeAction = (next: AssemblyAction) => {
    setActionState({ stepId: step?.id, action: next });
    if (next === "take") setPinState({ stepId: step?.id, index: 0 });
    if (next === "place" && (action === "done" || action === "insert"))
      setPinState({
        stepId: step?.id,
        index: Math.max(0, partPins.length - 1),
      });
    setSelectedEndpoint(undefined);
    if (next === "a" || next === "b")
      setRequestFocusEndpoint((current) => ({
        endpoint: next,
        token: (current?.token ?? 0) + 1,
      }));
  };
  const go = (next: number, lastPhysicalAction = false) => {
    if (frontier >= 0 && next > frontier) return;
    setLastConfirmation(undefined);
    setRequestFocusPartPin(undefined);
    scrollAfterNavigation.current = next !== position;
    const target = Math.max(0, Math.min(total, next));
    const targetStep = circuit.steps[target];
    const targetPins = partAt(targetStep)
      ? assemblyPartPins(partAt(targetStep)!)
      : [];
    if (lastPhysicalAction && targetStep?.wires?.length)
      setRequestFocusEndpoint((current) => ({
        endpoint: "b",
        token: (current?.token ?? 0) + 1,
      }));
    else setRequestFocusEndpoint(undefined);
    setActionState({
      stepId: targetStep?.id,
      action: targetStep
        ? lastPhysicalAction
          ? targetStep.wires?.length
            ? "b"
            : targetPins.length
              ? "insert"
              : "place"
          : initialAction(targetStep)
        : "done",
    });
    setPinState({
      stepId: targetStep?.id,
      index: lastPhysicalAction ? Math.max(0, targetPins.length - 1) : 0,
    });
    setProgress((current) => ({ ...current, position: target }));
  };
  const advance = () => {
    if (!step) {
      onDone?.();
      return;
    }
    if (action === "take") {
      changeAction(wire ? (wireItem?.ownLead ? "b" : "a") : "place");
      return;
    }
    if (action === "a") {
      changeAction("b");
      return;
    }
    if (action === "place" && partPins.length) {
      if (pinIndex < partPins.length - 1)
        setPinState({ stepId: step.id, index: pinIndex + 1 });
      else changeAction("insert");
      return;
    }
    // The physical confirmation also advances the guide. A separate success
    // screen must never ask for a second approval of the very same connection.
    scrollAfterNavigation.current = true;
    setRequestFocusEndpoint(undefined);
    setRequestFocusPartPin(undefined);
    const next = circuit.steps[position + 1];
    setActionState({
      stepId: next?.id,
      action: next ? initialAction(next) : "done",
    });
    setPinState({ stepId: next?.id, index: 0 });
    setProgress((current) => ({
      ...current,
      position: position + 1,
      completed: { ...current.completed, [step.id]: true },
      verified: { ...current.verified, [step.id]: true },
    }));
    setLastConfirmation({
      position,
      label: wire
        ? `Cable ${wire.color} conectado`
        : placed?.type === "soil"
          ? "Conector de la sonda listo"
          : placed?.type === "rain"
            ? "Placa de lluvia conectada"
            : `${placed?.label ?? step.title} listo`,
    });
  };
  const primaryLabel = !step
    ? "Montaje listo, continuar"
    : action === "take"
      ? "Lo tengo"
      : action === "a"
        ? wireItem?.a === "hilo del sensor"
          ? "Encontré el hilo"
          : "Ya conecté A"
        : action === "b"
          ? "Ya conecté B"
          : action === "place"
            ? placed
              ? partPins.length
                ? pinIndex < partPins.length - 1
                  ? "Ubicar siguiente pata"
                  : "Patas alineadas"
                : placed.type === "soil"
                  ? "Conector listo"
                  : placed.type === "rain"
                    ? "Placa conectada"
                    : "Módulo ubicado"
              : "Entendido"
            : action === "insert"
              ? "Ya lo coloqué"
              : wire
                ? "Conectado, siguiente"
                : "Listo, siguiente";
  const microSteps: { action: AssemblyAction; label: string }[] = wire
    ? wireItem?.ownLead
      ? [
          { action: "take", label: "Identifica el hilo" },
          { action: "b", label: "Punta libre" },
        ]
      : [
          { action: "take", label: "Toma" },
          { action: "a", label: "Extremo A" },
          { action: "b", label: "Extremo B" },
        ]
    : placed && !partPins.length
      ? [{ action: "place", label: "Conecta el módulo" }]
      : [
          { action: "take", label: "Toma" },
          {
            action: "place",
            label: partPins.length
              ? `Pata ${pinIndex + 1}/${partPins.length}`
              : "Ubica",
          },
          ...(partPins.length
            ? [{ action: "insert" as const, label: "Inserta" }]
            : []),
        ];
  const diagramProps = {
    circuit,
    activeEndpoint,
    activePartPin:
      placed && activePin
        ? { partId: placed.id, pinId: activePin.id }
        : undefined,
    requestFocusPartPin,
    connectionState: wire
      ? action === "done"
        ? ("placed" as const)
        : action === "take" || action === "a" || action === "b"
          ? action
          : undefined
      : undefined,
    requestFocusEndpoint,
    onEndpointActivate: (endpoint: Endpoint) => focusEndpoint(endpoint),
  };

  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div
        ref={diagramAnchor}
        className="scroll-mt-[140px] flex min-w-0 flex-col gap-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented
            size="sm"
            label="Vista del circuito"
            value={dimension}
            onChange={onDimensionChange}
            options={[
              { value: "3d", label: "3D interactivo", icon: "cube" },
              { value: "2d", label: "Plano 2D", icon: "layers" },
            ]}
          />
          <span className="text-xs font-bold text-ink-accent">
            {stageLabel}
          </span>
        </div>
        <div
          className={
            dimension === "3d"
              ? "min-w-0"
              : "h-[350px] sm:h-[470px] xl:h-[580px]"
          }
        >
          {dimension === "3d" ? (
            <Suspense
              fallback={
                <div className="grid h-[470px] place-items-center rounded-lg bg-surface-alt text-ink-accent">
                  Tu circuito está tomando forma…
                </div>
              }
            >
              <CircuitExperience
                {...diagramProps}
                activeStep={position}
                mode={view === "all" || position >= total ? "all" : "step"}
              />
            </Suspense>
          ) : (
            <BreadboardView
              {...diagramProps}
              stepIndex={position}
              complete={view === "all" || position >= total}
              description={actionTitle}
            />
          )}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold leading-5 text-ink-soft">
            {activeEndpoint
              ? `Toca la marca ${activeEndpoint.toUpperCase()} para explorar dónde va.`
              : dimension === "3d"
                ? "Arrastra para girar · rueda para acercarte · toca para descubrir"
                : "Acércate a los agujeros y toca las marcas del circuito."}
          </p>
          <Segmented
            size="sm"
            label="Qué mostrar en el diagrama"
            value={view}
            onChange={onViewChange}
            options={[
              { value: "step", label: "Este paso", icon: "steps" },
              { value: "all", label: "Todo", icon: "layers" },
            ]}
          />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3 xl:sticky xl:top-24">
        <section
          aria-label="Instrucción de montaje"
          className="rd-guided-step flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
        >
          <div>
            <p className="t-overline text-ink-accent">{stageLabel}</p>
            <SegmentedProgress
              className="mt-2.5"
              total={total}
              done={reviewedCount}
              current={position}
              label="Avance del montaje"
            />
            <p
              className="mt-2 text-xs font-semibold text-ink-soft"
              aria-live="polite"
            >
              {cableCount} {cableCount === 1 ? "cable" : "cables"} · {partCount}{" "}
              {partCount === 1 ? "pieza colocada" : "piezas colocadas"}
            </p>
          </div>
          {step ? (
            <>
              {microSteps.length > 1 && (
                <ol
                  className="flex gap-1.5"
                  aria-label="Acciones de esta conexión"
                >
                  {microSteps.map((item, index) => (
                    <li
                      key={item.action}
                      aria-current={item.action === action ? "step" : undefined}
                      className={cx(
                        "flex min-w-0 flex-1 flex-col items-center gap-1 text-center text-xs font-bold",
                        item.action === action
                          ? "text-ink-accent"
                          : "text-ink-soft",
                      )}
                    >
                      <span
                        className={cx(
                          "grid size-7 place-items-center rounded-full",
                          item.action === action
                            ? "bg-accent text-primary ring-4 ring-accent-soft"
                            : microSteps.findIndex(
                                  (candidate) => candidate.action === action,
                                ) > index
                              ? "bg-success text-white"
                              : "bg-surface-alt",
                        )}
                      >
                        {microSteps.findIndex(
                          (candidate) => candidate.action === action,
                        ) > index ? (
                          <Icon name="check" size={15} />
                        ) : (
                          index + 1
                        )}
                      </span>
                      <span>{item.label}</span>
                    </li>
                  ))}
                </ol>
              )}
              <h3 className="t-heading text-ink" aria-live="polite">
                {actionTitle}
              </h3>
              {wire && action === "take" && (
                <>
                  <div className="flex items-center gap-3 rounded-md bg-surface-alt p-4">
                    <span
                      className="h-3.5 w-20 shrink-0 rounded-pill shadow-sm ring-1 ring-border-strong"
                      style={{ background: WIRE_HEX[wire.color] }}
                    />
                    <p className="text-sm font-bold text-ink">
                      {wireItem?.label}
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-ink-soft">
                    {wireItem?.ownLead
                      ? "Sigue el hilo desde el sensor. Después insertaremos su punta libre en el agujero indicado."
                      : `A: extremo ${wireItem?.a}. B: extremo ${wireItem?.b}. Primero conectaremos A; después B.`}
                  </p>
                </>
              )}
              {wire && activeEndpoint && activeInfo && (
                <>
                  <EndpointTarget
                    end={activeEndpoint.toUpperCase()}
                    {...activeInfo}
                    selected={selectedEndpoint === activeEndpoint}
                    onClick={() => focusEndpoint(activeEndpoint)}
                  />
                  <p className="text-sm leading-6 text-ink">
                    {activeEndpoint === "a"
                      ? wireItem?.a === "hilo del sensor"
                        ? "Este extremo ya sale del sensor. Encuentra el hilo indicado y síguelo hasta su punta libre."
                        : wireItem?.a === "hembra"
                          ? "Encaja el extremo hembra sobre el pin marcado A."
                          : "Inserta el extremo macho en el agujero marcado A."
                      : wireItem?.b === "hembra"
                        ? "Ahora encaja el otro extremo, hembra, sobre el pin marcado B."
                        : wireItem?.ownLead
                          ? "Inserta la punta libre del hilo del sensor en el agujero marcado B."
                          : "Ahora inserta el otro extremo, macho, en el agujero marcado B."}
                  </p>
                </>
              )}
              {placed && action === "take" && (
                <div className="space-y-2 rounded-md bg-surface-alt p-3 text-sm leading-6 text-ink">
                  <p>
                    Toma <strong>una sola pieza: {placed.label}</strong>.
                  </p>
                  <p>{identifyAssemblyPart(placed)}</p>
                </div>
              )}
              {placed && action === "place" && (
                <>
                  {activePin ? (
                    <>
                      <p className="text-xs font-bold text-ink-accent">
                        Pata {pinIndex + 1} de {partPins.length} ·{" "}
                        {placed.label}
                      </p>
                      <EndpointTarget
                        end={String(pinIndex + 1)}
                        {...endpointInfo(circuit, activePin.hole)}
                        selected={false}
                        onClick={() =>
                          setRequestFocusPartPin((current) => ({
                            partId: placed.id,
                            pinId: activePin.id,
                            token: (current?.token ?? 0) + 1,
                          }))
                        }
                        ariaLabel={`Explorar ${activePin.label}: ${activePin.hole}`}
                      />
                      <p className="text-sm leading-6 text-ink">
                        {placed.type === "led" && activePin.id === "catodo"
                          ? "Encuentra la pata corta, junto al lado plano del LED."
                          : placed.type === "resistor"
                            ? pinIndex === 0
                              ? "Dobla las patas en forma de U. Cualquiera de sus extremos sirve como pata 1."
                              : "Mantén la primera pata alineada y lleva la otra a este agujero."
                            : `Identifica ${activePin.label} en la pieza.`}{" "}
                        Sostén la pieza sobre la protoboard y alinea esta pata
                        con <strong>{activePin.hole}</strong>.
                      </p>
                      {pinIndex > 0 && (
                        <p className="text-xs leading-5 text-ink-soft">
                          {partPins
                            .slice(0, pinIndex)
                            .map((pin) => `${pin.label}: ${pin.hole}`)
                            .join(" · ")}{" "}
                          ya{" "}
                          {pinIndex === 1 ? "está alineada" : "están alineadas"}
                          .
                        </p>
                      )}
                    </>
                  ) : (
                    <div className="space-y-2 rounded-md bg-surface-alt p-3 text-sm leading-6 text-ink">
                      <p>{step.detail}</p>
                      <p className="text-ink-soft">
                        {identifyAssemblyPart(placed)}
                      </p>
                    </div>
                  )}
                </>
              )}
              {placed && action === "insert" && (
                <div
                  className="rounded-md bg-surface-alt p-3 text-sm leading-6 text-ink"
                  aria-label="Colocar la pieza completa"
                >
                  <p className="font-semibold">
                    {partPins
                      .map((pin) => `${pin.label}: ${pin.hole}`)
                      .join(" · ")}
                  </p>
                  <p className="mt-2">
                    Con todas las patas alineadas, inserta la pieza completa en
                    estos agujeros. Conserva la orientación que acabas de
                    identificar.
                  </p>
                </div>
              )}
              {!wire && !placed && (
                <p className="text-sm leading-6 text-ink">{step.detail}</p>
              )}
              {action === "done" && (
                <div
                  className="flex items-start gap-2 rounded-md bg-success-soft p-3 text-success-ink"
                  role="status"
                >
                  <Icon name="check" size={20} className="mt-0.5 shrink-0" />
                  <p className="text-sm font-semibold leading-6">
                    {wire
                      ? `Sigue el cable ${wire.color}: A (${endpointInfo(circuit, wire.from).label}) → B (${endpointInfo(circuit, wire.to).label}). Coincide con la línea del modelo.`
                      : partPins.length
                        ? `${placed?.label}: ${partPins.map((pin) => `${pin.label} en ${pin.hole}`).join(" · ")}. Las patas coinciden con el modelo.`
                        : "El módulo está junto a tu placa, con sus terminales a la vista."}
                  </p>
                </div>
              )}
              {step.shared && action === "take" && (
                <p className="text-xs leading-5 text-ink-soft">
                  Si este cable ya está en tu montaje, sigue sus extremos y
                  consérvalo.
                </p>
              )}
              {step.why && (
                <Disclosure
                  key={step.id}
                  tone="alt"
                  icon="lightbulb"
                  title="¿Qué descubrimos con esta conexión?"
                >
                  <p>{step.why}</p>
                  {wire && (
                    <p className="mt-2 font-semibold text-ink-accent">
                      Este cable lleva {wire.carries}.
                    </p>
                  )}
                </Disclosure>
              )}
            </>
          ) : (
            <>
              <div className="grid size-14 place-items-center rounded-full bg-success-soft text-success-ink">
                <Icon name="check" size={30} />
              </div>
              <h3 className="t-heading text-ink">¡Tu circuito está listo!</h3>
              <p className="text-sm leading-6 text-ink">
                Construiste {circuit.wires.length} conexiones y colocaste{" "}
                {circuit.parts.length} piezas, una a una. Ahora haz que cobren
                vida con el programa.
              </p>
              <Disclosure
                title="Mi mapa de conexiones"
                icon="layers"
                tone="alt"
              >
                <div
                  aria-label="Resumen del montaje"
                  className="space-y-3 text-xs leading-5"
                >
                  <p className="font-semibold text-ink">
                    El mismo mapa aparece en 2D y 3D.
                  </p>
                  {circuit.wires.map((item) => (
                    <p key={item.id} className="border-b border-border pb-2">
                      <strong className="text-ink">{item.color}</strong> ·{" "}
                      {wireItemInfo(circuit, item).ownLead
                        ? "hilo del sensor"
                        : wireItemInfo(circuit, item).connector}
                      <br />
                      {assemblyEndpointLabel(circuit, item.from)} →{" "}
                      {assemblyEndpointLabel(circuit, item.to)}
                      <br />
                      <span className="text-ink-soft">{item.carries}</span>
                    </p>
                  ))}
                  {circuit.parts.map((item) => (
                    <p key={item.id}>
                      <strong className="text-ink">{item.label}</strong>
                      <br />
                      {assemblyPartPins(item).length
                        ? assemblyPartPins(item)
                            .map((pin) => `${pin.label}: ${pin.hole}`)
                            .join(" · ")
                        : "Módulo externo · conectado por las marcas de sus terminales"}
                    </p>
                  ))}
                </div>
              </Disclosure>
            </>
          )}
          {lastConfirmation && (
            <div className="rd-guided-confirmation flex items-center gap-2 rounded-md bg-success-soft px-3 text-success-ink">
              <Icon name="check" size={16} className="shrink-0" />
              <p
                className="min-w-0 flex-1 text-xs font-semibold leading-5"
                role="status"
              >
                {lastConfirmation.label}
              </p>
              <button
                type="button"
                className="focus-ring min-h-11 shrink-0 rounded-sm px-2 text-xs font-bold underline underline-offset-4"
                onClick={() => go(lastConfirmation.position, true)}
              >
                Revisar
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon="arrowLeft"
              disabled={position <= 0 && action === initialAction(step)}
              onClick={() => {
                const index = microSteps.findIndex(
                  (item) => item.action === action,
                );
                if (step && action === "done")
                  changeAction(
                    wire ? "b" : partPins.length ? "insert" : "place",
                  );
                else if (step && action === "place" && pinIndex > 0)
                  setPinState({ stepId: step.id, index: pinIndex - 1 });
                else if (step && index > 0)
                  changeAction(microSteps[index - 1].action);
                else go(position - 1, true);
              }}
              aria-label="Acción anterior"
            >
              Atrás
            </Button>
            <Button
              className="flex-1"
              iconRight={action === "done" || !step ? "check" : "arrowRight"}
              onClick={advance}
              disabled={!step && !onDone}
            >
              {primaryLabel}
            </Button>
          </div>
        </section>
        <Disclosure title={`Explorar los ${total} pasos`} icon="steps">
          <ol className="scrollbar-thin flex max-h-[260px] flex-col overflow-y-auto">
            {circuit.steps.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => go(index)}
                  disabled={frontier >= 0 && index > frontier}
                  aria-current={index === position ? "step" : undefined}
                  className={cx(
                    "focus-ring flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-sm leading-5 disabled:opacity-45",
                    index === position
                      ? "bg-highlight font-bold text-ink"
                      : "font-semibold text-ink-soft hover:bg-surface-alt hover:text-ink",
                  )}
                >
                  <span
                    className={cx(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                      reviewed(item)
                        ? "bg-success text-white"
                        : "bg-surface-alt text-ink-soft",
                    )}
                  >
                    {reviewed(item) ? (
                      <Icon name="check" size={13} strokeWidth={3} />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className="min-w-0 flex-1">{item.title}</span>
                </button>
              </li>
            ))}
          </ol>
        </Disclosure>
      </div>
    </div>
  );
}

function EndpointTarget({
  end,
  label,
  sub,
  selected,
  onClick,
  ariaLabel,
}: {
  end: string;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel ?? `Explorar extremo ${end}: ${label}`}
      aria-pressed={selected}
      className="focus-ring flex min-w-0 items-center gap-3 rounded-lg border-2 border-accent bg-accent-soft p-4 text-left transition-transform hover:scale-[1.02] motion-reduce:transform-none"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-cream">
        {end}
      </span>
      <span className="min-w-0">
        <span className="t-mono block break-words text-xl font-extrabold leading-7 text-ink">
          {label}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-ink-soft">
          {sub}
        </span>
      </span>
      <Icon
        name="search"
        size={18}
        className="ml-auto shrink-0 text-ink-accent"
      />
    </button>
  );
}
