import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "../brand/Graphics";
import { BreadboardView } from "../circuit/BreadboardView";
import { WIRE_HEX, type Circuit, type WiringStep } from "../circuit/model";
import { analyze } from "../circuit/netlist";
import { partDef } from "../circuit/parts";
import { useApp } from "../lib/context";
import { readLocal, writeLocal } from "../lib/theme";
import { ConnectButton } from "../shell/ConnectButton";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Card";
import { Callout } from "../ui/Feedback";
import { Checkbox } from "../ui/Form";
import { Disclosure } from "../ui/Layout";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";
import { circuitProgressSignature, endpointInfo, normalizeCircuitSteps, restoreAssemblyProgress } from "./assembly";
const CircuitExperience = lazy(() => import("../experience/CircuitExperience"));

function EndpointChip({ label, sub, end }: { label: string; sub: string; end?: string }) {
  return (
    <div className="flex min-w-0 flex-1 gap-2.5 rounded-md border border-border bg-surface-alt p-3">
      {end && <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-cream">{end}</span>}
      <div className="min-w-0">
        <p className="t-mono break-words text-[17px] font-extrabold leading-6 text-ink">{label}</p>
        <p className="mt-1 text-xs font-semibold leading-[18px] text-ink-soft">{sub}</p>
      </div>
    </div>
  );
}

type Props = { circuit: Circuit; storageKey: string; onDone?: () => void };

/** Remount state when the group, board, activity or actual wiring changes. */
export function WiringGuide({ circuit: source, storageKey, onDone }: Props) {
  const app = useApp();
  const circuit = useMemo(() => normalizeCircuitSteps(source), [source]);
  const signature = useMemo(() => circuitProgressSignature(app.board, circuit), [app.board, circuit]);
  return <WiringSession key={`${storageKey}:${signature}`} circuit={circuit} storageKey={storageKey} signature={signature} onDone={onDone} />;
}

function WiringSession({ circuit, storageKey, signature, onDone }: Props & { signature: string }) {
  const total = circuit.steps.length;
  const [progress, setProgress] = useState(() => restoreAssemblyProgress(readLocal<unknown>(storageKey, null), signature, circuit.steps));
  const [prepared, setPrepared] = useState(false);
  const [unpowered, setUnpowered] = useState(false);
  const [finalReviewed, setFinalReviewed] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [dimension, setDimension] = useState<"3d" | "2d">("2d");
  const [view, setView] = useState<"step" | "all">("step");
  const diagramAnchor = useRef<HTMLDivElement>(null);
  const scrollAfterNavigation = useRef(false);
  const position = prepared ? progress.position : -1;
  const step = position >= 0 && position < total ? circuit.steps[position] : undefined;
  const check = useMemo(() => analyze(circuit, { splitRails: true, vbus: 5.25 }), [circuit]);
  const reviewed = (item: WiringStep) => progress.completed[item.id] && (!item.verify || progress.verified[item.id]);
  const frontier = circuit.steps.findIndex((item) => !reviewed(item));
  const reviewedCount = circuit.steps.filter(reviewed).length;
  const wire = circuit.wires.find((candidate) => candidate.id === step?.wires?.[0]);
  const placed = circuit.parts.find((candidate) => candidate.id === step?.parts?.[0]);
  const stageLabel = position < 0 ? "Antes de cablear" : position >= total ? "Revisión final" : `Paso ${position + 1} de ${total}`;
  useEffect(() => writeLocal(storageKey, { version: 2, signature, ...progress }), [storageKey, signature, progress]);
  useEffect(() => setNudge(false), [position]);
  useEffect(() => {
    if (!scrollAfterNavigation.current) return;
    scrollAfterNavigation.current = false;
    if (window.matchMedia("(min-width: 1280px)").matches) return;
    diagramAnchor.current?.scrollIntoView({
      block: "start",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth",
    });
  }, [position]);

  const go = (next: number) => {
    if (!prepared || (frontier >= 0 && next > frontier)) { setNudge(true); return; }
    if (next < total) setFinalReviewed(false);
    scrollAfterNavigation.current = next !== position;
    setProgress((current) => ({ ...current, position: Math.max(0, Math.min(total, next)) }));
  };
  const advance = () => {
    if (!prepared) {
      if (!unpowered) { setNudge(true); return; }
      scrollAfterNavigation.current = true;
      setPrepared(true);
      setProgress((current) => ({ ...current, position: Math.max(0, current.position) }));
      return;
    }
    if (step?.verify && !progress.verified[step.id]) { setNudge(true); return; }
    if (position >= total) {
      if (frontier >= 0) { go(frontier); return; }
      if (!finalReviewed) { setNudge(true); return; }
      onDone?.();
      return;
    }
    scrollAfterNavigation.current = true;
    setProgress((current) => ({ ...current, position: position + 1, completed: { ...current.completed, [step!.id]: true } }));
  };

  return (
    <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div ref={diagramAnchor} className="scroll-mt-[140px] flex min-w-0 flex-col gap-3">
        <div className="rounded-md border border-border bg-surface p-3 xl:hidden" aria-live="polite">
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-ink">
            <span className="text-ink-accent">{stageLabel} · </span>{step?.title ?? (position < 0 ? "Primero, sin energía" : "Revisa antes de dar energía")}
          </h3>
          {wire && <p className="t-mono mt-1 break-words text-xs font-semibold leading-5 text-ink-soft">1 cable {wire.color} · A: {endpointInfo(circuit, wire.from).label} → B: {endpointInfo(circuit, wire.to).label}</p>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Segmented size="sm" label="Vista del circuito" value={dimension} onChange={setDimension} options={[
            { value: "2d", label: "Plano 2D", icon: "layers" },
            { value: "3d", label: "3D interactivo", icon: "cube" },
          ]} />
          <span className="text-xs font-semibold text-ink-soft">{circuit.wires.length} {circuit.wires.length === 1 ? "cable" : "cables"} · {circuit.parts.length} {circuit.parts.length === 1 ? "pieza" : "piezas"}</span>
        </div>
        <div className={dimension === "3d" ? "min-w-0" : "h-[320px] sm:h-[420px] xl:h-[500px]"}>
          {dimension === "3d" ? (
            <Suspense fallback={<div className="grid h-[320px] place-items-center rounded-lg bg-surface-alt text-ink-soft">Preparando tu circuito 3D…</div>}>
              <CircuitExperience circuit={circuit} activeStep={position} mode={view === "all" || position >= total ? "all" : "step"} />
            </Suspense>
          ) : <BreadboardView circuit={circuit} stepIndex={position} complete={view === "all" || position >= total} description={step ? `${step.title}. ${step.detail}` : undefined} />}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs leading-5 text-ink-soft">{wire ? "A y B son los extremos del mismo cable." : "Sigue las letras y los números del plano."}</p>
          <Segmented size="sm" label="Qué mostrar en el diagrama" value={view} onChange={setView} options={[
            { value: "step", label: "Este paso", icon: "steps" },
            { value: "all", label: "Todo", icon: "layers" },
          ]} />
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-3">
        <section aria-label="Instrucción de montaje" className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface p-4 sm:p-[18px]">
          <div>
            <p className="t-overline text-ink-accent" aria-live="polite">{stageLabel}</p>
            <SegmentedProgress className="mt-2.5" total={total} done={reviewedCount} current={position} onDark={false} label="Avance del cableado" />
          </div>
          {position < 0 && <Intro checked={unpowered} onChange={setUnpowered} nudge={nudge} resume={progress.position > 0 ? progress.position + 1 : undefined} />}
          {step && <>
            <h3 className="t-heading hidden text-ink xl:block">{step.title}</h3>
            {wire && <>
              <p className="flex items-center gap-2 text-sm font-bold text-ink">
                <span className="h-3 w-7 shrink-0 rounded-pill ring-1 ring-border-strong" style={{ background: WIRE_HEX[wire.color] }} />
                1 {wire.kind === "cable" ? "hilo o cable de sensor" : "cable macho-macho"} {wire.color}
              </p>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1" aria-label="Extremos del cable">
                <EndpointChip end="A" {...endpointInfo(circuit, wire.from)} />
                <EndpointChip end="B" {...endpointInfo(circuit, wire.to)} />
              </div>
              <p className="text-sm leading-[22px] text-ink">Inserta un extremo en A y el otro en B. Comprueba ambos antes de seguir.</p>
            </>}
            {placed?.holes && <div className="grid grid-cols-2 gap-2" aria-label="Patas de la pieza">
              {Object.entries(placed.holes).map(([pinId, hole]) => {
                const pin = partDef(placed).pins.find((candidate) => candidate.id === pinId);
                return <EndpointChip key={pinId} label={endpointInfo(circuit, hole).label} sub={[pin?.label ?? pinId, pin?.aka?.[0], endpointInfo(circuit, hole).sub].filter(Boolean).join(" · ")} />;
              })}
            </div>}
            {!wire && <p className="text-[15px] leading-[23px] text-ink">{step.detail}</p>}
            {step.shared && <p className="text-xs font-semibold leading-5 text-ink-soft">Si esta conexión ya está hecha, revisa sus dos extremos y consérvala.</p>}
            {step.warning && <Callout tone="danger" compact title="Antes de seguir">{step.warning}</Callout>}
            {step.tip && /retira|retirar|desconecta|dañar|5 V|4 patas|polaridad|pregunta/i.test(step.tip) && <Callout tone="warning" compact>{step.tip}</Callout>}
            {(wire || step.why || step.tip) && <Disclosure key={step.id} tone="alt" icon="lightbulb" title="Ver detalle y ayuda">
              {wire && <p>{step.detail}</p>}
              {step.tip && <p className="mt-2">{step.tip}</p>}
              {step.why && <p className="mt-2">{step.why}</p>}
              {wire && <p className="mt-2 text-xs font-semibold text-ink-soft">Esta conexión lleva {wire.carries}.</p>}
            </Disclosure>}
            {step.verify && <div className={cx("rounded-md px-3", nudge && !progress.verified[step.id] ? "bg-warning-soft ring-2 ring-warning" : "bg-surface-alt")}>
              <Checkbox checked={Boolean(progress.verified[step.id])} onChange={(value) => setProgress((current) => ({ ...current, verified: { ...current.verified, [step.id]: value } }))}>{step.verify}</Checkbox>
              {nudge && !progress.verified[step.id] && <p role="alert" className="pb-2.5 text-sm font-bold text-warning-ink">Compruébalo en tu protoboard y marca la casilla para seguir.</p>}
            </div>}
          </>}
          {position >= total && <>
            <h3 className="t-heading hidden text-ink xl:block">Revisa antes de dar energía</h3>
            <p className="text-sm leading-[22px] text-ink">Comprueba cada extremo, la orientación de las piezas y que ninguna pata metálica toque otra.</p>
            <Callout tone={check.issues.length ? "warning" : "info"} compact title="Revisión del plano">{check.issues.length ? "El plano tiene observaciones: revísalas con tu docente antes de conectar energía." : "El plano de referencia pasó la revisión eléctrica. El navegador no puede comprobar tu montaje físico."}</Callout>
            <Checkbox checked={finalReviewed} onChange={setFinalReviewed}>Revisé mi montaje físico con el plano y está listo para conectar USB.</Checkbox>
            {nudge && !finalReviewed && <p role="alert" className="text-sm font-bold text-warning-ink">Revisa el montaje y marca la casilla para terminar.</p>}
          </>}
          <div className="mt-1 flex gap-2">
            <Button variant="outline" icon="arrowLeft" disabled={position <= 0} onClick={() => go(position - 1)} aria-label="Paso anterior">Atrás</Button>
            <Button className="flex-1" iconRight={position >= total ? "check" : "arrowRight"} onClick={advance} disabled={position >= total && !onDone}>
              {position < 0 ? progress.position > 0 ? "Continuar montaje" : "Empezar a cablear" : position >= total ? "Cableado listo" : position === total - 1 ? "Listo, revisar" : "Listo, siguiente"}
            </Button>
          </div>
        </section>
        <Disclosure title={`Ver los ${total} pasos`} icon="steps">
          <ol className="scrollbar-thin flex max-h-[260px] flex-col overflow-y-auto">
            {circuit.steps.map((item, index) => <li key={item.id}>
              <button type="button" onClick={() => go(index)} aria-disabled={!prepared || (frontier >= 0 && index > frontier)} aria-current={index === position ? "step" : undefined}
                className={cx("focus-ring flex min-h-11 w-full items-center gap-2 rounded-sm px-2 py-2 text-left text-[13px] leading-[18px]", index === position ? "bg-highlight font-bold text-ink" : "font-semibold text-ink-soft hover:bg-surface-alt hover:text-ink")}>
                <span className={cx("flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold", reviewed(item) ? "bg-success text-white" : "bg-surface-alt text-ink-soft")}>
                  {reviewed(item) ? <Icon name="check" size={13} strokeWidth={3} /> : index + 1}
                </span>
                <span className="min-w-0 flex-1">{item.title}</span>
              </button>
            </li>)}
          </ol>
        </Disclosure>
      </div>
    </div>
  );
}

function Intro({ checked, onChange, nudge, resume }: { checked: boolean; onChange: (value: boolean) => void; nudge: boolean; resume?: number }) {
  const app = useApp();
  return <>
    <h3 className="t-heading hidden text-ink xl:block">Primero, sin energía</h3>
    <Callout tone="warning" title="Retira físicamente el USB" compact>
      Retira también las fuentes externas. Desconectar en la web solo cierra los datos: no apaga la placa.
      {app.connected && <div className="mt-2.5"><ConnectButton /></div>}
    </Callout>
    <Checkbox checked={checked} onChange={onChange}>Retiré físicamente el USB y las fuentes externas, o estoy revisando solo el plano sin una placa.</Checkbox>
    {nudge && !checked && <p role="alert" className="text-sm font-bold text-warning-ink">Confirma esta preparación antes de empezar a cablear.</p>}
    {resume && <p className="text-sm font-semibold text-ink-accent">Tu avance está guardado. Continuarás en el paso {resume}.</p>}
    <p className="text-sm leading-[22px] text-ink">Coloca la Pico sobre el canal central: pines en c1–c20 y h1–h20, con el USB hacia el número 1, a tu izquierda. «a4» significa letra a, número 4.</p>
    <Disclosure title="Cómo colocar la Pico W" tone="alt">
      La Pico ocupa los números 1 al 20 a ambos lados del canal central: una fila de pines en c y la otra en h. El USB queda hacia afuera, a la izquierda. El navegador no detecta si la placa tiene energía.
    </Disclosure>
  </>;
}
