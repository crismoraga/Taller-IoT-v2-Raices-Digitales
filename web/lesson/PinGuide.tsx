import { useEffect, useMemo, useState } from "react";
import { Icon } from "../brand/Graphics";
import { WIRE_HEX } from "../circuit/model";
import { PICO_PINS } from "../circuit/pico";
import type { PinRow } from "../content/types";
import { useApp } from "../lib/context";
import { readLocal, writeLocal } from "../lib/theme";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Feedback";
import { Checkbox } from "../ui/Form";
import { Disclosure } from "../ui/Layout";
import { SegmentedProgress } from "../ui/Progress";
import { normalizePinRows, restoreAssemblyProgress } from "./assembly";

/** Arduino pin labels are never translated into the Pico breadboard's coordinates. */
function target(to: string, board: "pico" | "arduino"): { label: string; sub?: string } {
  if (board === "arduino") return { label: to };
  const match = PICO_PINS.find((pin) => pin.name === to && pin.kind !== "gnd");
  if (match) return { label: `${match.name} · pin ${match.physical}`, sub: `Con la Pico como en el plano: ${match.free[0]} o ${match.free[1]}` };
  if (to === "GND") return { label: "GND", sub: "Pin GND de la Pico; usa el riel azul solo si ya lo conectaste a GND." };
  return { label: to };
}

type Props = { part?: string; rows: PinRow[]; notes?: string[]; board: "pico" | "arduino"; storageKey?: string };

/** One connection at a time, including explicit pairs originally grouped in one row. */
export function PinGuide({ rows: source, storageKey, ...props }: Props) {
  const app = useApp();
  const rows = useMemo(() => normalizePinRows(source), [source]);
  const signature = useMemo(() => JSON.stringify([app.board, props.board, props.part, rows, props.notes]), [app.board, props.board, props.part, rows, props.notes]);
  const key = storageKey ?? `raices.pins.${app.session?.id ?? "anon"}.${signature}`;
  return <PinSession key={`${key}:${signature}`} {...props} rows={rows} storageKey={key} signature={signature} />;
}

function PinSession({ part, rows, notes, board, storageKey, signature }: Props & { storageKey: string; signature: string }) {
  const steps = useMemo(() => rows.map((_, index) => ({ id: String(index), verify: "Revisé ambos extremos" })), [rows]);
  const [progress, setProgress] = useState(() => restoreAssemblyProgress(readLocal<unknown>(storageKey, null), signature, steps));
  const [prepared, setPrepared] = useState(false);
  const [unpowered, setUnpowered] = useState(false);
  const [nudge, setNudge] = useState(false);
  const position = prepared ? progress.position : -1;
  const row = rows[position];
  const count = steps.filter(({ id }) => progress.completed[id] && progress.verified[id]).length;
  const safetyNotes = notes?.filter((note) => /nunca|no conect|no aliment|5\s*V|resistencia|desconect|fuente|polaridad|máximo|maximo|dañ|sin aliment|permit|ficha|fabricante/i.test(note)) ?? [];
  const otherNotes = notes?.filter((note) => !safetyNotes.includes(note)) ?? [];
  const isolated = row?.to === "Sin conectar";
  const to = row && target(row.to, board);
  useEffect(() => writeLocal(storageKey, { version: 2, signature, ...progress }), [storageKey, signature, progress]);
  useEffect(() => setNudge(false), [position]);
  const next = () => {
    if (!prepared) {
      if (!unpowered) { setNudge(true); return; }
      setPrepared(true);
      setProgress((current) => ({ ...current, position: Math.max(0, current.position) }));
    } else {
      if (!progress.verified[String(position)]) { setNudge(true); return; }
      setProgress((current) => ({ ...current, position: Math.min(rows.length, position + 1), completed: { ...current.completed, [String(position)]: true } }));
    }
  };
  return <section className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5" aria-label="Montaje por pines">
    <div>
      <p className="t-overline text-ink-accent" aria-live="polite">{position < 0 ? "Antes de conectar" : row ? `Conexión ${position + 1} de ${rows.length}` : "Conexiones revisadas"}</p>
      <h3 className="t-heading mt-1 text-ink">{part ?? (board === "arduino" ? "Montaje Arduino" : "Montaje por pines")}</h3>
      <p className="mt-2 text-xs font-semibold text-ink-soft">{rows.length} conexiones · una por paso</p>
      <SegmentedProgress className="mt-3" total={rows.length} done={count} current={position} label="Avance de las conexiones" />
    </div>
    {position < 0 ? <>
      <Callout tone="warning" compact title="Primero, sin energía">Retira físicamente el USB y las fuentes externas. Desconectar en la web no apaga la placa.</Callout>
      <Checkbox checked={unpowered} onChange={setUnpowered}>Retiré físicamente el USB y las fuentes externas, o reviso solo la guía sin una placa.</Checkbox>
      <p className="text-sm leading-[22px] text-ink-soft">Verás una conexión a la vez. Lee las marcas de cada pin en tu placa y en el componente.</p>
      {progress.position > 0 && <p className="text-sm font-semibold text-ink-accent">Tu avance está guardado.</p>}
    </> : row && to ? <>
      {isolated ? <Callout tone="warning" title={`Deja ${row.from} sin conectar`} compact>Este paso no lleva cable. Mantén ese terminal separado y sin alimentación.</Callout> : <>
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          {row.color && <span className="h-3 w-7 rounded-pill ring-1 ring-border-strong" style={{ background: WIRE_HEX[row.color] }} />}
          {row.color ? `1 cable ${row.color}: conecta estos dos extremos` : /Resistencia de .+: pata/.test(`${row.from} ${row.to}`) ? "Coloca esta pata de la resistencia en el terminal indicado" : "Haz solamente esta conexión"}
        </p>
        <div className="grid items-stretch gap-2 sm:grid-cols-[1fr_auto_1fr]" aria-label="Extremos de esta conexión">
          <PinEndpoint end="A" label={row.from} />
          <Icon name="arrowRight" size={18} className="hidden self-center text-ink-soft sm:block" />
          <PinEndpoint end="B" label={to.label} sub={to.sub} />
        </div>
      </>}
      {row.note && <p className="text-sm leading-[22px] text-ink">{row.note}</p>}
      {row.warning && <Callout tone="danger" compact title="Antes de seguir">{row.warning}</Callout>}
      <Checkbox checked={Boolean(progress.verified[String(position)])} onChange={(value) => setProgress((current) => ({ ...current, verified: { ...current.verified, [String(position)]: value } }))}>
        {isolated ? "Comprobé que este terminal está sin conectar." : "Revisé los dos extremos de esta conexión."}
      </Checkbox>
    </> : <Callout tone="success" compact title="Revisión paso a paso completada">Comprueba el montaje completo antes de conectar USB. Estas marcas son tu revisión manual: el navegador no detecta los cables físicos.</Callout>}
    {safetyNotes.length > 0 && (position < 0
      ? <Callout tone="warning" compact title="Para este componente"><ul className="space-y-1.5">{safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul></Callout>
      : <Disclosure title="Cuidados de este componente" tone="alt"><ul className="space-y-1.5">{safetyNotes.map((note) => <li key={note}>{note}</li>)}</ul></Disclosure>)}
    {otherNotes.length > 0 && <Disclosure title="Detalles del componente" tone="alt"><ul className="space-y-2">{otherNotes.map((note) => <li key={note}>{note}</li>)}</ul></Disclosure>}
    {nudge && <p role="alert" className="text-sm font-bold text-warning-ink">{position < 0 ? "Confirma que retiraste la alimentación para empezar." : "Comprueba esta conexión y marca la casilla para seguir."}</p>}
    <div className="flex gap-2">
      <Button variant="outline" icon="arrowLeft" disabled={position <= 0} onClick={() => setProgress((current) => ({ ...current, position: Math.max(0, current.position - 1) }))}>Atrás</Button>
      {position < rows.length && <Button className="flex-1" iconRight="arrowRight" onClick={next}>{position < 0 ? progress.position > 0 ? "Continuar montaje" : "Empezar a conectar" : position === rows.length - 1 ? "Terminar revisión" : "Listo, siguiente"}</Button>}
    </div>
  </section>;
}

function PinEndpoint({ end, label, sub }: { end: string; label: string; sub?: string }) {
  return <div className="flex min-w-0 gap-2.5 rounded-md border border-border bg-surface-alt p-3">
    <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-extrabold text-cream">{end}</span>
    <div className="min-w-0"><p className="t-mono break-words text-sm font-bold leading-[22px] text-ink">{label}</p>{sub && <p className="mt-1 text-xs leading-[18px] text-ink-soft">{sub}</p>}</div>
  </div>;
}
