import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../brand/Graphics";
import { BreadboardView } from "../circuit/BreadboardView";
import { WIRE_HEX, type Circuit, type WiringStep } from "../circuit/model";
import { partDef } from "../circuit/parts";
import { useApp } from "../lib/context";
import { readLocal, writeLocal } from "../lib/theme";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Card";
import { Disclosure } from "../ui/Layout";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";
import {
  circuitProgressSignature,
  endpointInfo,
  firstAssemblyAction,
  normalizeCircuitSteps,
  restoreAssemblyAction,
  restoreAssemblyProgress,
  type AssemblyAction,
} from "./assembly";
const CircuitExperience = lazy(() => import("../experience/CircuitExperience"));

type Endpoint = "a" | "b";
type Props = { circuit: Circuit; storageKey: string; onDone?: () => void };

/** The same board and atomic sequence feed both renderers. */
export function WiringGuide({ circuit: source, storageKey, onDone }: Props) {
  const app = useApp();
  const circuit = useMemo(() => normalizeCircuitSteps(source), [source]);
  const signature = useMemo(
    () => circuitProgressSignature(app.board, circuit),
    [app.board, circuit],
  );
  return (
    <WiringSession
      key={`${storageKey}:${signature}`}
      circuit={circuit}
      storageKey={storageKey}
      signature={signature}
      onDone={onDone}
    />
  );
}

function WiringSession({
  circuit,
  storageKey,
  signature,
  onDone,
}: Props & { signature: string }) {
  const total = circuit.steps.length;
  const [progress, setProgress] = useState(() =>
    restoreAssemblyProgress(
      readLocal<unknown>(storageKey, null),
      signature,
      circuit.steps,
    ),
  );
  const position = Math.max(0, progress.position);
  const step = position < total ? circuit.steps[position] : undefined;
  const [actionState, setActionState] = useState(() => ({
    stepId: step?.id,
    action: step
      ? restoreAssemblyAction(
          readLocal<unknown>(storageKey, null),
          signature,
          step,
        )
      : ("done" as AssemblyAction),
  }));
  const action =
    actionState.stepId === step?.id
      ? actionState.action
      : step
        ? firstAssemblyAction(step)
        : "done";
  const [selectedEndpoint, setSelectedEndpoint] = useState<Endpoint>();
  const [requestFocusEndpoint, setRequestFocusEndpoint] = useState<{
    endpoint: Endpoint;
    token: number;
  }>();
  const [dimension, setDimension] = useState<"3d" | "2d">("3d");
  const [view, setView] = useState<"step" | "all">("step");
  const diagramAnchor = useRef<HTMLDivElement>(null);
  const scrollAfterNavigation = useRef(false);
  const reviewed = (item: WiringStep) =>
    progress.completed[item.id] && (!item.verify || progress.verified[item.id]);
  const frontier = circuit.steps.findIndex((item) => !reviewed(item));
  const reviewedCount = circuit.steps.filter(reviewed).length;
  const wire = circuit.wires.find(
    (candidate) => candidate.id === step?.wires?.[0],
  );
  const placed = circuit.parts.find(
    (candidate) => candidate.id === step?.parts?.[0],
  );
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
      ? `Toma un cable ${wire.color}`
      : action === "a"
        ? `Conecta A en ${endpointInfo(circuit, wire.from).label}`
        : action === "b"
          ? `Conecta B en ${endpointInfo(circuit, wire.to).label}`
          : "¡Cable conectado!"
    : placed
      ? action === "take"
        ? `Toma ${placed.label}`
        : action === "place"
          ? `Coloca ${placed.label}`
          : "¡Pieza en su lugar!"
      : (step?.title ?? "¡Tu circuito está listo!");

  useEffect(
    () =>
      writeLocal(storageKey, {
        version: 2,
        signature,
        ...progress,
        position,
        journey: step ? { stepId: step.id, action } : undefined,
      }),
    [storageKey, signature, progress, position, step, action],
  );
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
    setSelectedEndpoint(undefined);
    if (next === "a" || next === "b")
      setRequestFocusEndpoint((current) => ({
        endpoint: next,
        token: (current?.token ?? 0) + 1,
      }));
  };
  const go = (next: number) => {
    if (frontier >= 0 && next > frontier) return;
    setRequestFocusEndpoint(undefined);
    scrollAfterNavigation.current = next !== position;
    const target = Math.max(0, Math.min(total, next));
    setActionState({
      stepId: circuit.steps[target]?.id,
      action: circuit.steps[target]
        ? firstAssemblyAction(circuit.steps[target])
        : "done",
    });
    setProgress((current) => ({ ...current, position: target }));
  };
  const advance = () => {
    if (!step) {
      onDone?.();
      return;
    }
    if (action === "take") {
      changeAction(wire ? "a" : "place");
      return;
    }
    if (action === "a") {
      changeAction("b");
      return;
    }
    if (action === "b" || action === "place") {
      changeAction("done");
      return;
    }
    scrollAfterNavigation.current = true;
    setRequestFocusEndpoint(undefined);
    const next = circuit.steps[position + 1];
    setActionState({
      stepId: next?.id,
      action: next ? firstAssemblyAction(next) : "done",
    });
    setProgress((current) => ({
      ...current,
      position: position + 1,
      completed: { ...current.completed, [step.id]: true },
      verified: { ...current.verified, [step.id]: true },
    }));
  };
  const primaryLabel = !step
    ? "Montaje listo, continuar"
    : action === "take"
      ? "Lo tengo"
      : action === "a"
        ? "Ya conecté A"
        : action === "b"
          ? "Ya conecté B"
          : action === "place"
            ? placed
              ? "Ya lo coloqué"
              : "Entendido"
            : wire
              ? "Conectado, siguiente"
              : "Listo, siguiente";
  const microSteps: { action: AssemblyAction; label: string }[] = wire
    ? [
        { action: "take", label: "Toma" },
        { action: "a", label: "Extremo A" },
        { action: "b", label: "Extremo B" },
        { action: "done", label: "Listo" },
      ]
    : [
        { action: "take", label: "Toma" },
        { action: "place", label: "Coloca" },
        { action: "done", label: "Listo" },
      ];
  const diagramProps = {
    circuit,
    activeEndpoint,
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
            onChange={setDimension}
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
            onChange={setView}
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
          className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
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
          </div>
          {step ? (
            <>
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
                      Un solo{" "}
                      {wire.connector
                        ? `cable ${wire.connector}`
                        : wire.kind === "cable"
                          ? "cable de sensor o hembra-macho"
                          : "cable macho-macho"}{" "}
                      {wire.color}.
                    </p>
                  </div>
                  <p className="text-sm leading-6 text-ink-soft">
                    Elige el cable. Te mostraremos cada extremo, uno a uno.
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
                      ? "Inserta el primer extremo del cable en el lugar marcado A."
                      : "Ahora inserta el otro extremo del mismo cable en el lugar marcado B."}
                  </p>
                  <p
                    className="text-xs leading-5 text-ink-soft"
                    aria-live="polite"
                  >
                    {selectedEndpoint === activeEndpoint
                      ? `Encontraste ${activeInfo.label} en el modelo. Cuando lo conectes en tu placa, continúa abajo.`
                      : "Puedes tocar la marca del modelo o esta tarjeta para acercarte."}
                  </p>
                </>
              )}
              {placed && action === "take" && (
                <p className="text-sm leading-6 text-ink">
                  Busca <strong>{placed.label}</strong>.{" "}
                  {partDef(placed).orientation
                    ? "Vamos a descubrir cómo orientarlo."
                    : "El modelo te mostrará su lugar."}
                </p>
              )}
              {placed && action === "place" && (
                <>
                  <p className="rounded-md bg-surface-alt p-3 text-sm font-semibold leading-6 text-ink">
                    {partDef(placed).orientation ??
                      (placed.holes
                        ? "Inserta las patas en los agujeros iluminados del modelo."
                        : "Deja el módulo junto a la protoboard con sus terminales a la vista.")}
                  </p>
                  {placed.holes && (
                    <div
                      className="grid grid-cols-2 gap-2"
                      aria-label="Patas de la pieza"
                    >
                      {Object.entries(placed.holes).map(([pinId, hole]) => {
                        const pin = partDef(placed).pins.find(
                          (candidate) => candidate.id === pinId,
                        );
                        return (
                          <div
                            key={pinId}
                            className="rounded-md border border-border bg-surface-alt p-3"
                          >
                            <p className="text-xs font-bold text-ink-accent">
                              {pin?.label ?? pinId}
                            </p>
                            <p className="t-mono mt-1 text-base font-extrabold text-ink">
                              {endpointInfo(circuit, hole).label}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
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
                      ? `A: ${endpointInfo(circuit, wire.from).label} → B: ${endpointInfo(circuit, wire.to).label}. Un cable, una nueva conexión.`
                      : "¡Una pieza más en tu estación! Vamos con el siguiente descubrimiento."}
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
                Construiste {circuit.wires.length} conexiones, una a una. Ahora
                haz que cobren vida con el programa.
              </p>
            </>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              icon="arrowLeft"
              disabled={position <= 0 && action === firstAssemblyAction(step)}
              onClick={() => {
                const index = microSteps.findIndex(
                  (item) => item.action === action,
                );
                if (step && index > 0)
                  changeAction(microSteps[index - 1].action);
                else go(position - 1);
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
          {step && (
            <p className="text-xs leading-5 text-ink-soft">
              El modelo te guía; tú confirmas cada conexión de tu montaje.
            </p>
          )}
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
}: {
  end: string;
  label: string;
  sub: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Explorar extremo ${end}: ${label}`}
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
