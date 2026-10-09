import { useState } from "react";
import { Icon } from "../brand/Graphics";
import { WIRE_HEX } from "../circuit/model";
import { PICO_PINS } from "../circuit/pico";
import type { PinRow } from "../content/types";
import { Callout } from "../ui/Feedback";
import { Checkbox } from "../ui/Form";
import { cx } from "../ui/cx";

/** Si el destino es un pin de la Pico, agrega su número físico y sus agujeros libres. */
function target(to: string, board: "pico" | "arduino"): { label: string; sub?: string } {
  if (board === "arduino") return { label: to };
  const match = PICO_PINS.find((pin) => pin.name === to && pin.kind !== "gnd");
  if (match) return { label: `${match.name} · pin ${match.physical}`, sub: `agujeros ${match.free[0]} o ${match.free[1]}` };
  if (to === "GND") return { label: "GND", sub: "riel azul, o un pin GND de la Pico" };
  return { label: to };
}

/**
 * Guía de pines: una fila por cable, en orden, para los montajes que no tienen plano de
 * protoboard (Zona Explora) y para Arduino Uno/Nano. Cada fila se marca al conectarla.
 */
export function PinGuide({
  part,
  rows,
  notes,
  board,
}: {
  part?: string;
  rows: PinRow[];
  notes?: string[];
  board: "pico" | "arduino";
}) {
  const [done, setDone] = useState<Record<number, boolean>>({});
  const count = Object.values(done).filter(Boolean).length;
  return (
    <div className="flex flex-col gap-3.5">
      {notes?.map((note) => (
        <Callout key={note} tone="info" compact>
          {note}
        </Callout>
      ))}
      <div className="rounded-lg border border-border bg-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border px-[18px] py-3">
          <p className="t-label text-ink">
            {part ? `${part}: ` : ""}
            {rows.length} conexiones, en este orden
          </p>
          <p className="tabular text-[13px] font-bold text-ink-soft">
            {count} de {rows.length}
          </p>
        </div>
        <ol>
          {rows.map((row, index) => {
            const to = target(row.to, board);
            return (
              <li
                key={`${row.from}-${row.to}-${index}`}
                className={cx(
                  "border-b border-border px-[18px] py-3 last:border-b-0",
                  done[index] && "bg-success-soft/50",
                )}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-alt font-display text-xs font-extrabold text-ink-accent">
                    {index + 1}
                  </span>
                  <span className="t-mono rounded-sm border border-border bg-surface-alt px-2.5 py-1.5 font-bold text-ink">
                    {row.from}
                  </span>
                  <span className="flex items-center gap-1.5 text-ink-soft">
                    {row.color && (
                      <span
                        title={`Cable ${row.color}`}
                        className="h-2.5 w-6 rounded-pill ring-1 ring-border-strong"
                        style={{ background: WIRE_HEX[row.color] }}
                      />
                    )}
                    <Icon name="arrowRight" size={16} />
                  </span>
                  <span className="rounded-sm border border-border bg-highlight px-2.5 py-1.5">
                    <span className="t-mono block font-extrabold text-ink">{to.label}</span>
                    {to.sub && (
                      <span className="block text-xs font-semibold leading-4 text-ink-soft">
                        {to.sub}
                      </span>
                    )}
                  </span>
                  <span className="ml-auto">
                    <Checkbox
                      checked={Boolean(done[index])}
                      onChange={(value) => setDone((all) => ({ ...all, [index]: value }))}
                    >
                      <span className="text-sm">Listo</span>
                    </Checkbox>
                  </span>
                </div>
                {(row.color || row.note) && (
                  <p className="mt-1.5 pl-10 text-[13px] font-semibold leading-[18px] text-ink-soft">
                    {row.color && `Cable ${row.color}. `}
                    {row.note}
                  </p>
                )}
                {row.warning && (
                  <p className="mt-1.5 flex items-start gap-1.5 pl-10 text-[13px] font-extrabold leading-[18px] text-danger-text">
                    <Icon name="alert" size={14} className="mt-0.5" />
                    {row.warning}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
