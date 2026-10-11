import { useEffect, useMemo, useState } from "react";
import { Icon } from "../brand/Graphics";
import { WIRE_HEX } from "../circuit/model";
import { PICO_PINS } from "../circuit/pico";
import type { PinRow } from "../content/types";
import { useApp } from "../lib/context";
import { readLocal, writeLocal } from "../lib/theme";
import { Button } from "../ui/Button";
import { Disclosure } from "../ui/Layout";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";
import {
  normalizePinRows,
  restoreAssemblyAction,
  restoreAssemblyProgress,
  type AssemblyAction,
} from "./assembly";

/** Board pin labels remain literal; Arduino never inherits Pico coordinates. */
function target(
  to: string,
  board: "pico" | "arduino",
): { label: string; sub?: string } {
  if (board === "arduino") return { label: to };
  const match = PICO_PINS.find((pin) => pin.name === to && pin.kind !== "gnd");
  if (match)
    return {
      label: `${match.name} · pin ${match.physical}`,
      sub: `Con la Pico como en el modelo: ${match.free[0]} o ${match.free[1]}`,
    };
  if (to === "GND")
    return {
      label: "GND",
      sub: "Pin GND de la Pico o el riel azul ya unido a GND.",
    };
  return { label: to };
}

type Props = {
  part?: string;
  rows: PinRow[];
  notes?: string[];
  board: "pico" | "arduino";
  storageKey?: string;
};

export function PinGuide({ rows: source, storageKey, ...props }: Props) {
  const app = useApp();
  const rows = useMemo(() => normalizePinRows(source), [source]);
  const signature = useMemo(
    () =>
      JSON.stringify([app.board, props.board, props.part, rows, props.notes]),
    [app.board, props.board, props.part, rows, props.notes],
  );
  const key =
    storageKey ?? `raices.pins.${app.session?.id ?? "anon"}.${signature}`;
  return (
    <PinSession
      key={`${key}:${signature}`}
      {...props}
      rows={rows}
      storageKey={key}
      signature={signature}
    />
  );
}

function PinSession({
  part,
  rows,
  notes,
  board,
  storageKey,
  signature,
}: Props & { storageKey: string; signature: string }) {
  const steps = useMemo(
    () =>
      rows.map((row, index) => ({
        id: String(index),
        wires: row.to === "Sin conectar" ? undefined : [String(index)],
        verify: "Conexión confirmada",
      })),
    [rows],
  );
  const [progress, setProgress] = useState(() =>
    restoreAssemblyProgress(
      readLocal<unknown>(storageKey, null),
      signature,
      steps,
    ),
  );
  const position = Math.max(0, progress.position);
  const row = rows[position];
  const [actionState, setActionState] = useState(() => ({
    stepId: steps[position]?.id,
    action: steps[position]
      ? restoreAssemblyAction(
          readLocal<unknown>(storageKey, null),
          signature,
          steps[position],
        )
      : ("done" as AssemblyAction),
  }));
  const isolated = row?.to === "Sin conectar";
  const action =
    actionState.stepId === steps[position]?.id
      ? actionState.action
      : isolated
        ? "place"
        : "take";
  const count = steps.filter(
    ({ id }) => progress.completed[id] && progress.verified[id],
  ).length;
  const detailNotes =
    notes?.filter(
      (note) =>
        !/nunca|peligro|seguridad|dañ|desconect|sin aliment|retira|fuente externa|no (?:aliment|conect)/i.test(
          note,
        ),
    ) ?? [];
  const to = row && target(row.to, board);
  const actions: { action: AssemblyAction; label: string }[] = isolated
    ? [
        { action: "place", label: "Observa" },
        { action: "done", label: "Listo" },
      ]
    : [
        { action: "take", label: "Toma" },
        { action: "a", label: "Extremo A" },
        { action: "b", label: "Extremo B" },
        { action: "done", label: "Listo" },
      ];
  useEffect(
    () =>
      writeLocal(storageKey, {
        version: 2,
        signature,
        ...progress,
        position,
        journey: row ? { stepId: String(position), action } : undefined,
      }),
    [storageKey, signature, progress, position, row, action],
  );
  const changeAction = (next: AssemblyAction) =>
    setActionState({ stepId: String(position), action: next });
  const next = () => {
    if (!row) return;
    const index = actions.findIndex((item) => item.action === action);
    if (index < actions.length - 1) {
      changeAction(actions[index + 1].action);
      return;
    }
    const nextRow = rows[position + 1];
    setActionState({
      stepId: String(position + 1),
      action: nextRow?.to === "Sin conectar" ? "place" : "take",
    });
    setProgress((current) => ({
      ...current,
      position: position + 1,
      completed: { ...current.completed, [String(position)]: true },
      verified: { ...current.verified, [String(position)]: true },
    }));
  };
  const heading = !row
    ? "¡Todas las conexiones listas!"
    : isolated
      ? `Observa ${row.from}`
      : action === "take"
        ? row.color
          ? `Toma un cable ${row.color}`
          : "Toma la pieza indicada"
        : action === "a"
          ? `Conecta A: ${row.from}`
          : action === "b"
            ? `Conecta B: ${to?.label}`
            : "¡Conexión completada!";

  return (
    <section
      className="mx-auto flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-5"
      aria-label="Montaje por pines"
    >
      <div>
        <p className="t-overline text-ink-accent">
          {row
            ? `Conexión ${position + 1} de ${rows.length}`
            : "Montaje completo"}{" "}
          · {part ?? (board === "arduino" ? "Arduino" : "Pico")}
        </p>
        <SegmentedProgress
          className="mt-3"
          total={rows.length}
          done={count}
          current={position}
          label="Avance de las conexiones"
        />
      </div>
      {row && (
        <ol className="flex gap-2" aria-label="Acciones de esta conexión">
          {actions.map((item, index) => (
            <li
              key={item.action}
              aria-current={action === item.action ? "step" : undefined}
              className={cx(
                "flex flex-1 flex-col items-center gap-1 text-xs font-bold",
                action === item.action ? "text-ink-accent" : "text-ink-soft",
              )}
            >
              <span
                className={cx(
                  "grid size-7 place-items-center rounded-full",
                  action === item.action
                    ? "bg-accent text-primary ring-4 ring-accent-soft"
                    : "bg-surface-alt",
                )}
              >
                {index + 1}
              </span>
              <span>{item.label}</span>
            </li>
          ))}
        </ol>
      )}
      <h3 className="t-heading text-ink" aria-live="polite">
        {heading}
      </h3>
      {row && to ? (
        <>
          {isolated ? (
            <p className="rounded-md bg-surface-alt p-4 text-sm leading-6 text-ink">
              Este terminal queda libre. En este paso usamos los otros pines del
              componente.
            </p>
          ) : action === "take" ? (
            <>
              {row.color && (
                <span
                  className="h-3.5 w-24 rounded-pill ring-1 ring-border-strong"
                  style={{ background: WIRE_HEX[row.color] }}
                />
              )}
              <p className="text-sm leading-6 text-ink">
                {row.color
                  ? "Usaremos un solo cable en esta conexión. Primero uno de sus extremos y después el otro."
                  : `Seguiremos esta unión, una pata por vez: ${row.from} → ${row.to}.`}
              </p>
            </>
          ) : action === "a" || action === "b" ? (
            <>
              <PinEndpoint
                end={action.toUpperCase()}
                label={action === "a" ? row.from : to.label}
                sub={action === "b" ? to.sub : undefined}
              />
              <p className="text-sm leading-6 text-ink">
                {action === "a"
                  ? "Encuentra la marca de este terminal y conecta el primer extremo aquí."
                  : "Ahora conecta el otro extremo en este terminal de tu placa o componente."}
              </p>
            </>
          ) : (
            <div className="flex gap-2 rounded-md bg-success-soft p-3 text-success-ink">
              <Icon name="check" size={20} className="shrink-0" />
              <p className="text-sm font-semibold leading-6">
                {row.from} → {to.label}. ¡Una conexión más en tu estación!
              </p>
            </div>
          )}
          {row.note &&
            !/peligro|dañ|desconect|seguridad|retira|nunca/i.test(row.note) &&
            action !== "take" && (
              <p className="text-xs leading-5 text-ink-soft">{row.note}</p>
            )}
        </>
      ) : (
        <p className="text-sm leading-6 text-ink">
          Cada conexión está en su lugar. Continúa con el programa para
          descubrir qué hace tu circuito.
        </p>
      )}
      {detailNotes.length > 0 && (
        <Disclosure title="Descubrir más sobre el componente" icon="lightbulb">
          <ul className="space-y-2 text-sm">
            {detailNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Disclosure>
      )}
      <div className="flex gap-2">
        <Button
          variant="outline"
          icon="arrowLeft"
          disabled={position <= 0 && action === actions[0].action}
          onClick={() => {
            const index = actions.findIndex((item) => item.action === action);
            if (row && index > 0) changeAction(actions[index - 1].action);
            else {
              const previous = Math.max(0, position - 1);
              setActionState({
                stepId: String(previous),
                action:
                  rows[previous]?.to === "Sin conectar" ? "place" : "take",
              });
              setProgress((current) => ({ ...current, position: previous }));
            }
          }}
        >
          Atrás
        </Button>
        {row && (
          <Button
            className="flex-1"
            iconRight={action === "done" ? "check" : "arrowRight"}
            onClick={next}
          >
            {action === "take"
              ? "Lo tengo"
              : action === "a"
                ? "Ya conecté A"
                : action === "b"
                  ? "Ya conecté B"
                  : action === "place"
                    ? "Entendido"
                    : "Conectado, siguiente"}
          </Button>
        )}
      </div>
      {row && (
        <p className="text-xs leading-5 text-ink-soft">
          Tú confirmas cada conexión mientras sigues el modelo.
        </p>
      )}
    </section>
  );
}

function PinEndpoint({
  end,
  label,
  sub,
}: {
  end: string;
  label: string;
  sub?: string;
}) {
  return (
    <div className="flex min-w-0 gap-3 rounded-lg border-2 border-accent bg-accent-soft p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-lg font-extrabold text-cream">
        {end}
      </span>
      <div className="min-w-0">
        <p className="t-mono break-words text-base font-bold leading-6 text-ink">
          {label}
        </p>
        {sub && <p className="mt-1 text-xs leading-5 text-ink-soft">{sub}</p>}
      </div>
    </div>
  );
}
