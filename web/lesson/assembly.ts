import {
  RAIL_INFO,
  isPoint,
  parsePoint,
  shortPoint,
  stripOf,
} from "../circuit/breadboard";
import type { Circuit, WiringStep } from "../circuit/model";
import { controllerPin } from "../circuit/boards";
import { partDef } from "../circuit/parts";
import { picoPinForStrip } from "../circuit/pico";
import type { PinRow } from "../content/types";

/** Coordinates are labels, never inferred from a different board's pinout. */
export function endpointInfo(
  circuit: Circuit,
  endpoint: string,
): { label: string; sub: string } {
  if (isPoint(endpoint)) {
    const point = parsePoint(endpoint);
    if (point.kind === "rail")
      return {
        label: `${RAIL_INFO[point.rail].sign} · ${point.column}`,
        sub: `Riel ${RAIL_INFO[point.rail].color} de ${point.rail.startsWith("t") ? "arriba" : "abajo"}`,
      };
    const pin =
      !circuit.board || circuit.board === "pico"
        ? picoPinForStrip(stripOf(endpoint))
        : undefined;
    return {
      label: shortPoint(endpoint),
      sub: `Letra ${point.letter}, número ${point.column}${pin ? ` · ${pin.name} (pin ${pin.physical})` : ""}`,
    };
  }
  const [partId, pinId] = endpoint.split(".");
  if (partId === "controller") {
    const pin = controllerPin(circuit.board, pinId);
    return {
      label: pin.label,
      sub: `Pin ${pin.label} de Arduino ${circuit.board === "uno" ? "Uno" : "Nano"}`,
    };
  }
  const part = circuit.parts.find((candidate) => candidate.id === partId);
  const pin =
    part && partDef(part).pins.find((candidate) => candidate.id === pinId);
  return { label: pin?.label ?? pinId, sub: part?.label ?? partId };
}

/** Both renderers receive this exact sequence: place a component OR connect a wire. */
export function normalizeCircuitSteps(circuit: Circuit): Circuit {
  const parts = new Map(circuit.parts.map((part) => [part.id, part]));
  const wires = new Map(circuit.wires.map((wire) => [wire.id, wire]));
  const steps = circuit.steps.flatMap((step): WiringStep[] => {
    const actions = [
      ...(step.parts ?? []).map((id) => ({ kind: "place" as const, id })),
      ...(step.wires ?? []).map((id) => ({ kind: "wire" as const, id })),
    ];
    if (actions.length <= 1) return [step];
    return actions.map((action, index) => {
      const part = action.kind === "place" ? parts.get(action.id) : undefined;
      const wire = action.kind === "wire" ? wires.get(action.id) : undefined;
      const last = index === actions.length - 1;
      return {
        ...step,
        id: `${step.id}:${action.kind === "place" ? "part" : "wire"}:${action.id}`,
        kind: action.kind,
        parts: action.kind === "place" ? [action.id] : undefined,
        wires: action.kind === "wire" ? [action.id] : undefined,
        title: part
          ? `${part.holes ? "Coloca" : "Toma"} ${part.label}`
          : wire
            ? `Conecta un cable ${wire.color}`
            : step.title,
        detail: part
          ? part.holes
            ? `Coloca ${part.label} en los agujeros indicados. ${partDef(part).orientation ?? ""}`.trim()
            : `Deja ${part.label} junto a la protoboard e identifica las marcas de sus terminales. Todavía no conectes sus cables.`
          : wire
            ? `Conecta los extremos A y B indicados abajo. ${actions.filter((item) => item.kind === "wire").length === 1 ? step.detail : "Usa solamente un cable en este paso."}`
            : step.detail,
        why: [step.why, step.detail].filter(Boolean).join(" ") || undefined,
        verify: last ? step.verify : undefined,
      };
    });
  });
  return { ...circuit, steps };
}

export interface AssemblyProgress {
  position: number;
  completed: Record<string, boolean>;
  verified: Record<string, boolean>;
}

export type AssemblyAction = "take" | "a" | "b" | "place" | "done";

/** A ready kit starts directly with the first component or cable. */
export function firstAssemblyAction(
  step?: Pick<WiringStep, "wires" | "parts">,
): AssemblyAction {
  return step?.wires?.length || step?.parts?.length ? "take" : "place";
}

/** Restore only the current connection's gesture, never another step's approval. */
export function restoreAssemblyAction(
  value: unknown,
  signature: string,
  step: Pick<WiringStep, "id" | "wires" | "parts">,
): AssemblyAction {
  const initial = firstAssemblyAction(step);
  if (!value || typeof value !== "object" || Array.isArray(value))
    return initial;
  const saved = value as Record<string, unknown>;
  if (
    saved.version !== 2 ||
    saved.signature !== signature ||
    !saved.journey ||
    typeof saved.journey !== "object" ||
    Array.isArray(saved.journey)
  )
    return initial;
  const journey = saved.journey as Record<string, unknown>;
  if (journey.stepId !== step.id) return initial;
  const actions: AssemblyAction[] = step.wires?.length
    ? ["take", "a", "b", "done"]
    : step.parts?.length
      ? ["take", "place", "done"]
      : ["place", "done"];
  return typeof journey.action === "string" &&
    actions.includes(journey.action as AssemblyAction)
    ? (journey.action as AssemblyAction)
    : initial;
}

/** Reject malformed/stale storage, and never restore a position past an unchecked step. */
export function restoreAssemblyProgress(
  value: unknown,
  signature: string,
  steps: Pick<WiringStep, "id" | "verify">[],
): AssemblyProgress {
  const empty = { position: -1, completed: {}, verified: {} };
  if (!value || typeof value !== "object" || Array.isArray(value)) return empty;
  const saved = value as Record<string, unknown>;
  if (
    saved.version !== 2 ||
    saved.signature !== signature ||
    typeof saved.position !== "number" ||
    !Number.isInteger(saved.position) ||
    saved.position < -1 ||
    saved.position > steps.length
  )
    return empty;
  const flags = (input: unknown) =>
    Object.fromEntries(
      steps
        .filter(
          ({ id }) =>
            !!input &&
            typeof input === "object" &&
            !Array.isArray(input) &&
            Object.hasOwn(input, id) &&
            (input as Record<string, unknown>)[id] === true,
        )
        .map(({ id }) => [id, true]),
    );
  const completed = flags(saved.completed);
  const verified = flags(saved.verified);
  const firstPending = steps.findIndex(
    (step) => !completed[step.id] || (step.verify && !verified[step.id]),
  );
  const limit = firstPending < 0 ? steps.length : firstPending;
  // A partial write or edited storage must not pre-approve future connections.
  // A checked current step is legitimate: it may have been saved before Next.
  for (let index = limit; index < steps.length; index++) {
    delete completed[steps[index].id];
    if (index > limit) delete verified[steps[index].id];
  }
  const position = Math.min(limit, saved.position);
  return { position, completed, verified };
}

export function circuitProgressSignature(
  board: string,
  circuit: Circuit,
): string {
  return JSON.stringify([
    board,
    circuit.id,
    circuit.steps,
    circuit.parts,
    circuit.wires,
  ]);
}

/** Only expand explicit pin pairs; ambiguous module connectors retain their exact labels. */
export function normalizePinRows(rows: PinRow[]): PinRow[] {
  const paired = rows.flatMap((row) => {
    const from = row.from.split(/\s+\/\s+/);
    const to = row.to.split(/\s+\/\s+/);
    if (from.length > 1 && from.length === to.length)
      return from.map((label, i) => ({ ...row, from: label, to: to[i] }));
    if (
      /^(VSS 1 y RW 5|VCC 16 y MR 10|GND 8 y OE 13|VDD 2 y extremo del potenciómetro)$/.test(
        row.from,
      )
    ) {
      return row.from.split(" y ").map((label) => ({ ...row, from: label }));
    }
    if (row.from === "Potenciómetro: extremos" && row.to === "VBUS, 5 V y GND")
      return [
        { ...row, from: "Potenciómetro: extremo 1", to: "VBUS, 5 V" },
        { ...row, from: "Potenciómetro: extremo 2", to: "GND" },
      ];
    if (row.to === "A1 y extremo de 10 kΩ")
      return [
        { ...row, to: "A1" },
        {
          ...row,
          from: "Extremo 1 de la resistencia de 10 kΩ",
          to: "A1",
          color: undefined,
        },
      ];
    if (row.to === "3V3 mediante dos resistencias de 10 kΩ en paralelo")
      return [1, 2].flatMap((number): PinRow[] => [
        {
          ...row,
          from: `Resistencia ${number} de 10 kΩ: pata 1`,
          to: row.from,
          color: undefined,
        },
        {
          ...row,
          from: `Resistencia ${number} de 10 kΩ: pata 2`,
          to: "3V3",
          color: undefined,
        },
      ]);
    return [row];
  });
  return paired.flatMap((row) => {
    const series = /^(\d+(?:[.,]\d+)?\s*k?Ω)\s*→\s*(.+)$/.exec(row.to);
    const via = /^(.+) mediante (\d+(?:[.,]\d+)?\s*k?Ω)$/.exec(row.to);
    const sourceVia =
      /^(.+) mediante (?:su resistencia de )?(\d+(?:[.,]\d+)?\s*k?Ω)$/.exec(
        row.from,
      );
    if (sourceVia)
      return normalizePinRows([
        {
          ...row,
          from: row.to,
          to: `${sourceVia[2]} → ${sourceVia[1] === "LED" ? "ánodo LED" : sourceVia[1] === "piezo" ? "positivo del piezo" : sourceVia[1]}`,
        },
      ]);
    if (!series && !via) return [row];
    const ohms = series?.[1] ?? via![2];
    const destination = series?.[2] ?? via![1];
    const ledPath = /^(?:ánodo LED|LED) → (?:cátodo a )?GND$/.test(destination);
    return [
      {
        ...row,
        to: `Resistencia de ${ohms}: pata 1`,
        note: [
          row.note,
          "Conserva la resistencia en serie; no la reemplaces por un cable.",
        ]
          .filter(Boolean)
          .join(" "),
      },
      {
        ...row,
        from: `Resistencia de ${ohms}: pata 2`,
        to: ledPath ? "Ánodo del LED (pata larga)" : destination,
        color: undefined,
      },
      ...(ledPath
        ? [
            {
              from: "Cátodo del LED (pata corta)",
              to: "GND",
              color: "negro" as const,
            },
          ]
        : []),
    ];
  });
}
