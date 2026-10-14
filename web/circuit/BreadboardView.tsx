import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
} from "react";
import { Icon } from "../brand/Graphics";
import { IconButton } from "../ui/Button";
import { cx } from "../ui/cx";
import {
  BOARD,
  COLUMNS,
  LETTERS,
  RAIL_COLUMNS,
  RAIL_INFO,
  RAIL_SPLIT_AFTER,
  holesOfStrip,
  isPoint,
  letterY,
  parsePoint,
  pointXY,
  railY,
  shortPoint,
  stripOf,
  type RailName,
} from "./breadboard";
import {
  boundsOf,
  endpointXY,
  moduleBounds,
  moduleBox,
  modulePinXY,
  type XY,
} from "./geometry";
import {
  WIRE_HEX,
  resistorBandNames,
  resistorBands,
  type Circuit,
  type PartInstance,
  type Wire,
} from "./model";
import { partDef } from "./parts";
import { ModuleShape } from "./ModuleShapes";
import { layoutCallouts, type CalloutBox } from "./calloutLayout";
import { controllerBox, controllerPins, controllerPin } from "./boards";
import type { Board } from "../lib/context";
import {
  PICO_COLUMNS,
  PICO_PINS,
  STATION_ROLE,
  picoPinForStrip,
  type PicoPin,
} from "./pico";

/** Píxeles del lienzo por cada paso de 2,54 mm. */
const U = 24;
const px = (value: number) => value * U;

const INK = {
  boardTop: "#f6efdd",
  boardBottom: "#eadfc4",
  boardEdge: "#cfc19c",
  groove: "#d9cca9",
  hole: "#27323b",
  holeRim: "#c9bb97",
  print: "#635a43",
  red: "#d64545",
  blue: "#3e8fd0",
  pcb: "#1b7a55",
  pcbDark: "#125a3e",
  pad: "#e0b84a",
  silk: "#e8f5ee",
  metal: "#b9c3ca",
  lead: "#aeb7bd",
};

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface Inspect {
  title: string;
  lines: string[];
  warning?: string;
}

export interface BreadboardViewProps {
  circuit: Circuit;
  /** Paso actual dentro de `circuit.steps`. Lo anterior se atenúa, lo posterior se oculta. */
  stepIndex: number;
  /** Muestra el montaje terminado, sin resaltar ningún paso. */
  complete?: boolean;
  /** Estados en vivo para el simulador: LED encendidos, etc. */
  lit?: Record<string, boolean>;
  className?: string;
  /** Texto alternativo del paso actual para lectores de pantalla. */
  description?: string;
  activeEndpoint?: "a" | "b";
  onEndpointActivate?: (endpoint: "a" | "b") => void;
  requestFocusEndpoint?: { endpoint: "a" | "b"; token: number };
  connectionState?: "take" | "a" | "b" | "placed";
  activePartPin?: { partId: string; pinId: string };
  requestFocusPartPin?: { partId: string; pinId: string; token: number };
}

/* ── Capa estática: la protoboard ─────────────────────────────── */

const BoardLayer = memo(function BoardLayer({
  pico = true,
}: {
  pico?: boolean;
}) {
  const holes: ReactElement[] = [];
  for (let column = 1; column <= COLUMNS; column++) {
    const x = px(BOARD.x0 + column - 1);
    for (const letter of LETTERS) {
      // Los agujeros bajo la Pico no se dibujan: quedan tapados por la placa.
      if (pico && column <= PICO_COLUMNS && "defg".includes(letter)) continue;
      holes.push(
        <rect
          key={`${letter}${column}`}
          x={x - 4.2}
          y={px(letterY(letter)) - 4.2}
          width={8.4}
          height={8.4}
          rx={2}
        />,
      );
    }
  }
  for (const rail of ["tp", "tn", "bp", "bn"] as RailName[])
    for (const column of RAIL_COLUMNS)
      holes.push(
        <rect
          key={`${rail}:${column}`}
          x={px(BOARD.x0 + column - 1) - 4.2}
          y={px(railY(rail)) - 4.2}
          width={8.4}
          height={8.4}
          rx={2}
        />,
      );
  const numbers: ReactElement[] = [];
  for (let column = 1; column <= COLUMNS; column++) {
    const major = column === 1 || column % 5 === 0;
    for (const y of [2, 15]) {
      numbers.push(
        <text
          key={`${column}-${y}`}
          x={px(BOARD.x0 + column - 1)}
          y={px(y) + 3}
          textAnchor="middle"
          fontSize={major ? 11 : 9}
          fontWeight={major ? 800 : 500}
          opacity={major ? 1 : 0.88}
        >
          {column}
        </text>,
      );
    }
  }
  const lastX = px(BOARD.x0 + COLUMNS - 1);
  return (
    <g>
      <defs>
        <linearGradient id="bb-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={INK.boardTop} />
          <stop offset="1" stopColor={INK.boardBottom} />
        </linearGradient>
        <filter id="bb-shadow" x="-5%" y="-10%" width="110%" height="130%">
          <feDropShadow
            dx="0"
            dy="6"
            stdDeviation="7"
            floodColor="#020a12"
            floodOpacity="0.45"
          />
        </filter>
      </defs>
      <rect
        x={px(0.3)}
        y={px(-1.25)}
        width={px(BOARD.width - 0.6)}
        height={px(BOARD.height + 2.5)}
        rx={10}
        fill="url(#bb-body)"
        stroke={INK.boardEdge}
        strokeWidth={1.5}
        filter="url(#bb-shadow)"
      />
      {/* Canal central */}
      <rect
        x={px(0.3) + 1}
        y={px(BOARD.channelTop + 0.72)}
        width={px(BOARD.width - 0.6) - 2}
        height={px(BOARD.channelBottom - BOARD.channelTop - 1.44)}
        fill={INK.groove}
      />
      {/* Líneas de color de los rieles: rojo = +, azul = − */}
      {(
        [
          ["tp", -0.52],
          ["tn", 1.52],
          ["bp", 15.48],
          ["bn", 17.52],
        ] as [RailName, number][]
      ).map(([rail, y]) => {
        const color = RAIL_INFO[rail].sign === "+" ? INK.red : INK.blue;
        return (
          <g key={rail}>
            {[
              [BOARD.x0 + 1.4, BOARD.x0 + RAIL_SPLIT_AFTER - 1],
              [BOARD.x0 + RAIL_SPLIT_AFTER + 1, BOARD.x0 + COLUMNS - 2.4],
            ].map(([from, to], index) => (
              <line
                key={index}
                x1={px(from)}
                x2={px(to)}
                y1={px(y)}
                y2={px(y)}
                stroke={color}
                strokeWidth={2}
                strokeLinecap="round"
              />
            ))}
            {[px(BOARD.x0 + 0.2), lastX - px(0.2)].map((x) => (
              <text
                key={x}
                x={x}
                y={px(railY(rail)) + 4.5}
                textAnchor="middle"
                fontSize={13}
                fontWeight={800}
                fill={color}
                fontFamily="var(--font-display)"
              >
                {RAIL_INFO[rail].sign}
              </text>
            ))}
          </g>
        );
      })}
      <g fill={INK.hole}>{holes}</g>
      <g fill={INK.print} fontFamily="var(--font-mono)">
        {numbers}
        {LETTERS.map((letter) =>
          [px(BOARD.x0 - 1), lastX + px(1)].map((x) => (
            <text
              key={`${letter}${x}`}
              x={x}
              y={px(letterY(letter)) + 3.2}
              textAnchor="middle"
              fontSize={11}
              fontWeight={700}
            >
              {letter}
            </text>
          )),
        )}
      </g>
    </g>
  );
});

/* ── Capa estática: la Pico W ─────────────────────────────────── */

const SHORT_NAME: Record<string, string> = { ADC_VREF: "VREF", "3V3_EN": "EN" };

const PicoLayer = memo(function PicoLayer({
  used,
  onInspect,
}: {
  /** Números físicos de los pines que usa este montaje. */
  used: Set<number>;
  onInspect: (pin: PicoPin) => void;
}) {
  const left = px(BOARD.x0 - 0.62);
  const right = px(BOARD.x0 + PICO_COLUMNS - 1 + 0.62);
  const top = px(letterY("h") - 0.58);
  const bottom = px(letterY("c") + 0.58);
  const midY = (top + bottom) / 2;
  return (
    <g>
      <rect
        x={left}
        y={top}
        width={right - left}
        height={bottom - top}
        rx={7}
        fill={INK.pcb}
        stroke={INK.pcbDark}
        strokeWidth={1.5}
      />
      {/* Conector micro-USB, hacia afuera de la protoboard */}
      <rect
        x={left - 9}
        y={midY - 21}
        width={36}
        height={42}
        rx={4}
        fill={INK.metal}
        stroke="#7e8a92"
      />
      <rect
        x={left - 3}
        y={midY - 13}
        width={22}
        height={26}
        rx={2}
        fill="#8e9aa2"
        opacity={0.6}
      />
      <text
        x={left + 46}
        y={midY + 3}
        fontSize={8}
        fontWeight={800}
        fill={INK.silk}
        fontFamily="var(--font-display)"
      >
        USB
      </text>
      {/* LED integrado y botón BOOTSEL */}
      <rect
        x={left + 34}
        y={top + 30}
        width={9}
        height={6}
        rx={1.5}
        fill="#bff2a8"
      />
      <text
        x={left + 46}
        y={top + 36}
        fontSize={6.5}
        fontWeight={700}
        fill={INK.silk}
        fontFamily="var(--font-mono)"
      >
        LED
      </text>
      <rect
        x={left + 78}
        y={midY - 18}
        width={24}
        height={20}
        rx={3}
        fill="#f1ead8"
        stroke="#bdb193"
      />
      <circle cx={left + 90} cy={midY - 8} r={5} fill="#d8ccac" />
      <text
        x={left + 90}
        y={midY + 13}
        textAnchor="middle"
        fontSize={6}
        fontWeight={700}
        fill={INK.silk}
        fontFamily="var(--font-mono)"
      >
        BOOTSEL
      </text>
      {/* RP2040 y módulo Wi-Fi */}
      <rect
        x={left + 190}
        y={midY - 21}
        width={42}
        height={42}
        rx={3}
        fill="#17212a"
      />
      <text
        x={left + 211}
        y={midY + 3}
        textAnchor="middle"
        fontSize={7}
        fontWeight={700}
        fill="#8fa0ad"
        fontFamily="var(--font-mono)"
      >
        RP2
      </text>
      <rect
        x={right - 150}
        y={midY - 26}
        width={74}
        height={52}
        rx={4}
        fill={INK.metal}
        stroke="#7e8a92"
      />
      <text
        x={right - 113}
        y={midY + 3}
        textAnchor="middle"
        fontSize={8}
        fontWeight={800}
        fill="#4d5a63"
        fontFamily="var(--font-display)"
      >
        Wi-Fi
      </text>
      <path
        d={`M${right - 58} ${midY - 22}h34v11h-26v11h26v11h-26v11h26`}
        fill="none"
        stroke={INK.pad}
        strokeWidth={2.4}
        opacity={0.75}
      />
      <text
        x={left + 300}
        y={midY + 4}
        textAnchor="middle"
        fontSize={10}
        fontWeight={800}
        fill={INK.silk}
        opacity={0.9}
        fontFamily="var(--font-display)"
      >
        Raspberry Pi Pico
      </text>
      {PICO_PINS.map((pin) => {
        const x = px(BOARD.x0 + pin.column - 1);
        const y = px(letterY(pin.side === "bottom" ? "c" : "h"));
        const inward = pin.side === "bottom" ? -1 : 1;
        const isUsed = used.has(pin.physical);
        const tint =
          pin.name === "VBUS"
            ? "#e8833a"
            : pin.name === "3V3"
              ? INK.red
              : pin.kind === "gnd"
                ? "#1d2730"
                : null;
        return (
          <g
            key={pin.physical}
            className="cursor-pointer"
            onClick={(event) => {
              event.stopPropagation();
              onInspect(pin);
            }}
          >
            <title>{`${pin.name} · pin ${pin.physical}`}</title>
            <rect
              x={x - 11}
              y={y - 13 + (inward < 0 ? -22 : 0)}
              width={22}
              height={48}
              fill="transparent"
            />
            <rect
              x={x - 6.5}
              y={y - 6.5}
              width={13}
              height={13}
              rx={3.5}
              fill={INK.pad}
              stroke={tint ?? "#a8852c"}
              strokeWidth={tint ? 2.4 : 1}
            />
            <circle cx={x} cy={y} r={2.6} fill="#5d4a15" />
            {/* Rótulo vertical: nombre impreso y, para los pines en uso, su número físico. */}
            {isUsed && (
              <rect
                x={x - 9}
                y={inward > 0 ? y + 10 : y - 10 - 50}
                width={18}
                height={50}
                rx={5}
                fill="#f4ecd7"
              />
            )}
            <text
              transform={`translate(${x + 3.6} ${y + inward * 14}) rotate(-90)`}
              textAnchor={inward > 0 ? "end" : "start"}
              fontSize={10.5}
              fontWeight={800}
              fill={isUsed ? "#0b2d45" : INK.silk}
              opacity={isUsed ? 1 : 0.92}
              fontFamily="var(--font-mono)"
            >
              {SHORT_NAME[pin.name] ?? pin.name}
            </text>
            <text
              x={x}
              y={y + inward * 56 + 3}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={isUsed ? "#f4ecd7" : "#9fd6bd"}
              opacity={isUsed ? 1 : 0.85}
              fontFamily="var(--font-mono)"
            >
              {pin.physical}
            </text>
          </g>
        );
      })}
    </g>
  );
});

/* ── Piezas ───────────────────────────────────────────────────── */

function ControllerLayer({
  board,
  onInspect,
}: {
  board: Board;
  onInspect: (pin: string) => void;
}) {
  const box = controllerBox(board);
  return (
    <g
      aria-label={
        board === "uno"
          ? "Arduino Uno: conectores reales"
          : "Arduino Nano: conectores reales"
      }
    >
      <rect
        x={px(box.x)}
        y={px(box.y)}
        width={px(box.w)}
        height={px(box.h)}
        rx={16}
        fill="#087a64"
        stroke="#71edbd"
        strokeWidth={3}
      />
      <rect
        x={px(box.x - 1.1)}
        y={px(box.y + box.h / 2 - 1.7)}
        width={px(3.8)}
        height={px(3.4)}
        rx={7}
        fill="#b7c5c4"
        stroke="#667f79"
        strokeWidth={3}
      />
      <rect
        x={px(box.x + box.w * 0.45)}
        y={px(box.y + box.h * 0.4)}
        width={px(board === "uno" ? 7 : 3.2)}
        height={px(board === "uno" ? 3 : 2.5)}
        rx={5}
        fill="#1a2926"
      />
      <text
        x={px(box.x + box.w / 2)}
        y={px(box.y + box.h / 2 + 3)}
        textAnchor="middle"
        fill="#edffef"
        fontSize={board === "uno" ? 27 : 17}
        fontWeight={800}
      >
        {board === "uno" ? "Arduino Uno" : "Arduino Nano"}
      </text>
      <text
        x={px(box.x + 3.3)}
        y={px(box.y + box.h / 2)}
        fill="#edffef"
        fontSize={13}
        fontWeight={700}
      >
        USB
      </text>
      {controllerPins(board).map((pin) => (
        <g
          key={pin.name}
          onClick={(event) => {
            event.stopPropagation();
            onInspect(pin.name);
          }}
          className="cursor-pointer"
        >
          <title>{`Pin ${pin.label} de Arduino`}</title>
          <rect
            x={px(pin.x) - 11}
            y={px(pin.y) - 12}
            width={22}
            height={24}
            rx={4}
            fill="#182e29"
            stroke="#c8e09e"
            strokeWidth={2}
          />
          <rect
            x={px(pin.x) - 3.5}
            y={px(pin.y) - 3.5}
            width={7}
            height={7}
            fill={board === "uno" ? "#030d0a" : "#d7bb66"}
          />
          <text
            x={px(pin.x)}
            y={px(pin.y) + (pin.y < box.y + box.h / 2 ? 30 : -20)}
            textAnchor="middle"
            fontSize={13}
            fontWeight={800}
            fill="#f0ffe2"
          >
            {pin.label}
          </text>
        </g>
      ))}
    </g>
  );
}

function Lead({ a, b }: { a: XY; b: XY }) {
  return (
    <line
      x1={px(a.x)}
      y1={px(a.y)}
      x2={px(b.x)}
      y2={px(b.y)}
      stroke={INK.lead}
      strokeWidth={3}
      strokeLinecap="round"
    />
  );
}

function Foot({ at }: { at: XY }) {
  return (
    <circle
      cx={px(at.x)}
      cy={px(at.y)}
      r={3.4}
      fill="#8d979e"
      stroke="#5c666d"
      strokeWidth={0.8}
    />
  );
}

function PartShape({ part, lit }: { part: PartInstance; lit?: boolean }) {
  const holes = part.holes ?? {};
  const at = (pin: string) => pointXY(holes[pin]);
  switch (part.type) {
    case "resistor": {
      const a = at("a");
      const b = at("b");
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
      const body = Math.min(2.5, length - 0.9);
      const bands = resistorBands(part.props?.ohms ?? 0);
      return (
        <g>
          <Lead a={a} b={b} />
          <g
            transform={`translate(${px((a.x + b.x) / 2)} ${px((a.y + b.y) / 2)}) rotate(${angle})`}
          >
            <rect
              x={px(-body / 2)}
              y={-8}
              width={px(body)}
              height={16}
              rx={7}
              fill="#e3c98d"
              stroke="#b79a5b"
              strokeWidth={1}
            />
            {bands.map((color, index) => (
              <rect
                key={index}
                x={
                  px(-body / 2) +
                  px(body) * (0.16 + index * (index === 3 ? 0.21 : 0.17))
                }
                y={-8}
                width={4.4}
                height={16}
                fill={color}
              />
            ))}
          </g>
          <Foot at={a} />
          <Foot at={b} />
        </g>
      );
    }
    case "led": {
      const anode = at("anodo");
      const cathode = at("catodo");
      const cx = px((anode.x + cathode.x) / 2);
      const cy = px((anode.y + cathode.y) / 2) - px(0.95);
      const color = { rojo: "#e5484d", amarillo: "#f0c13b", azul: "#4b9be8" }[
        part.props?.color ?? "rojo"
      ];
      const flatLeft = cathode.x < anode.x;
      return (
        <g>
          <line
            x1={px(anode.x)}
            y1={px(anode.y)}
            x2={cx + (flatLeft ? 5 : -5)}
            y2={cy}
            stroke={INK.lead}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          <line
            x1={px(cathode.x)}
            y1={px(cathode.y)}
            x2={cx + (flatLeft ? -5 : 5)}
            y2={cy}
            stroke={INK.lead}
            strokeWidth={2.6}
            strokeLinecap="round"
          />
          {lit && (
            <circle
              cx={cx}
              cy={cy}
              r={34}
              fill={color}
              opacity={0.35}
              style={{ filter: "blur(9px)" }}
            />
          )}
          <circle
            cx={cx}
            cy={cy}
            r={15}
            fill={color}
            stroke="#00000030"
            strokeWidth={1.5}
            opacity={lit ? 1 : 0.9}
          />
          {/* Borde plano del lado del cátodo (pata corta) */}
          <rect
            x={flatLeft ? cx - 16 : cx + 11.5}
            y={cy - 10}
            width={4.5}
            height={20}
            fill="#00000038"
            rx={1}
          />
          <circle
            cx={cx - 4}
            cy={cy - 5}
            r={4.5}
            fill="#ffffff"
            opacity={lit ? 0.85 : 0.45}
          />
          <text
            x={px(anode.x)}
            y={px(anode.y) + 17}
            textAnchor="middle"
            fontSize={11}
            fontWeight={800}
            fill="#8e2b2b"
            fontFamily="var(--font-display)"
          >
            +
          </text>
          <Foot at={anode} />
          <Foot at={cathode} />
        </g>
      );
    }
    case "ldr": {
      const a = at("a");
      const b = at("b");
      const cx = px((a.x + b.x) / 2);
      const cy = px((a.y + b.y) / 2);
      return (
        <g>
          <Lead a={a} b={b} />
          <circle
            cx={cx}
            cy={cy}
            r={19}
            fill="#d9b25c"
            stroke="#9c7a2c"
            strokeWidth={1.5}
          />
          <path
            d={`M${cx - 11} ${cy - 9}h18v6h-14v6h14v6h-18`}
            fill="none"
            stroke="#7a2f1d"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Foot at={a} />
          <Foot at={b} />
        </g>
      );
    }
    case "tilt": {
      const a = at("a");
      const b = at("b");
      return (
        <g>
          <Lead a={a} b={b} />
          <rect
            x={px((a.x + b.x) / 2) - 22}
            y={px(a.y) - 11}
            width={44}
            height={22}
            rx={10}
            fill="#c8a24a"
            stroke="#8c6d22"
            strokeWidth={1.4}
          />
          <circle
            cx={px((a.x + b.x) / 2) + 8}
            cy={px(a.y)}
            r={5}
            fill="#f3e2ac"
          />
          <Foot at={a} />
          <Foot at={b} />
        </g>
      );
    }
    case "buzzer": {
      const plus = at("mas");
      const minus = at("menos");
      const cx = px((plus.x + minus.x) / 2);
      const cy = px((plus.y + minus.y) / 2);
      return (
        <g>
          <circle
            cx={cx}
            cy={cy}
            r={px(2.36)}
            fill="#1c242c"
            stroke="#0d1319"
            strokeWidth={2}
          />
          <circle
            cx={cx}
            cy={cy}
            r={px(2.36) - 9}
            fill="none"
            stroke="#35424d"
            strokeWidth={2}
          />
          <circle cx={cx} cy={cy} r={7} fill="#0a0f14" />
          <text
            x={px(plus.x) + 2}
            y={cy - 24}
            textAnchor="middle"
            fontSize={15}
            fontWeight={800}
            fill="#f4ecd7"
            fontFamily="var(--font-display)"
          >
            +
          </text>
        </g>
      );
    }
    case "button": {
      const corners = ["a1", "a2", "b1", "b2"].map(at);
      const cx = px(corners.reduce((sum, point) => sum + point.x, 0) / 4);
      const cy = px(corners.reduce((sum, point) => sum + point.y, 0) / 4);
      return (
        <g>
          {corners.map((corner, index) => (
            <Foot key={index} at={corner} />
          ))}
          <rect
            x={cx - px(2.35)}
            y={cy - px(2.35)}
            width={px(4.7)}
            height={px(4.7)}
            rx={8}
            fill="#232d36"
            stroke="#0f161c"
            strokeWidth={1.5}
          />
          <circle
            cx={cx}
            cy={cy}
            r={px(1.55)}
            fill="#e0b84a"
            stroke="#a88525"
            strokeWidth={2}
          />
          <circle cx={cx - 8} cy={cy - 9} r={8} fill="#fff" opacity={0.22} />
        </g>
      );
    }
    case "potentiometer": {
      const cursor = at("cursor");
      const cx = px(cursor.x);
      const cy = px(cursor.y) + px(1.6);
      return (
        <g>
          {["ext1", "cursor", "ext2"].map((pin) => (
            <g key={pin}>
              <line
                x1={px(at(pin).x)}
                y1={px(at(pin).y)}
                x2={px(at(pin).x)}
                y2={cy - 20}
                stroke={INK.lead}
                strokeWidth={3}
              />
              <Foot at={at(pin)} />
            </g>
          ))}
          <rect
            x={cx - px(1.9)}
            y={cy - px(1.3)}
            width={px(3.8)}
            height={px(2.6)}
            rx={6}
            fill="#2d6f9e"
            stroke="#1c4a6c"
            strokeWidth={1.5}
          />
          <circle
            cx={cx}
            cy={cy}
            r={19}
            fill="#eef3f6"
            stroke="#9fb0bc"
            strokeWidth={1.5}
          />
          <line
            x1={cx}
            y1={cy}
            x2={cx + 11}
            y2={cy - 11}
            stroke="#0b2d45"
            strokeWidth={3.5}
            strokeLinecap="round"
          />
        </g>
      );
    }
    case "lm35": {
      const out = at("vout");
      const cx = px(out.x);
      const cy = px(out.y);
      return (
        <g>
          <path
            d={`M${cx - 30} ${cy + 9}a30 30 0 0 1 60 0z`}
            fill="#1c242c"
            stroke="#0d1319"
            strokeWidth={1.5}
          />
          <text
            x={cx}
            y={cy + 3}
            textAnchor="middle"
            fontSize={7.5}
            fontWeight={800}
            fill="#c9d3da"
            fontFamily="var(--font-mono)"
          >
            LM35
          </text>
          {["vs", "vout", "gnd"].map((pin) => (
            <Foot key={pin} at={at(pin)} />
          ))}
        </g>
      );
    }
    case "dht11": {
      const data = at("DATA");
      const cx = px((at("VCC").x + data.x + at("GND").x) / 3);
      const outward = data.y > 8.5 ? 1 : -1;
      const y = outward > 0 ? px(data.y) + px(0.35) : px(data.y) - px(3.1);
      return (
        <g>
          {["VCC", "DATA", "GND"].map((pin) => (
            <Foot key={pin} at={at(pin)} />
          ))}
          <rect
            x={cx - px(2.8)}
            y={y}
            width={px(5.6)}
            height={px(2.75)}
            rx={5}
            fill="#2f7fc4"
            stroke="#1c5388"
            strokeWidth={1.5}
          />
          {Array.from({ length: 15 }, (_, index) => (
            <rect
              key={index}
              x={cx - px(2.3) + (index % 5) * 23}
              y={y + 11 + Math.floor(index / 5) * 15}
              width={15}
              height={8}
              rx={2}
              fill="#16416c"
            />
          ))}
          <text
            x={cx}
            y={y + px(2.75) + 14}
            textAnchor="middle"
            fontSize={9}
            fontWeight={800}
            fill="#f4ecd7"
            fontFamily="var(--font-display)"
          >
            DHT11
          </text>
        </g>
      );
    }
    case "hcsr04": {
      const vcc = at("VCC");
      const gnd = at("GND");
      const cx = px((vcc.x + gnd.x) / 2);
      const outward = vcc.y > 8.5 ? 1 : -1;
      const y = px(vcc.y);
      const canTop = outward > 0 ? y + px(0.45) : y - px(0.45) - px(5.3);
      return (
        <g>
          <rect
            x={cx - px(8.85)}
            y={y - 7 + (outward > 0 ? 3 : -3)}
            width={px(17.7)}
            height={14}
            rx={3}
            fill="#2f7fc4"
            stroke="#1c5388"
            strokeWidth={1.4}
          />
          {["VCC", "TRIG", "ECHO", "GND"].map((pin) => (
            <Foot key={pin} at={at(pin)} />
          ))}
          {[-5.1, 5.1].map((offset) => (
            <g key={offset}>
              <rect
                x={cx + px(offset - 3.15)}
                y={canTop}
                width={px(6.3)}
                height={px(5.3)}
                rx={12}
                fill="#c9d1d7"
                stroke="#8793a0"
                strokeWidth={1.5}
              />
              <ellipse
                cx={cx + px(offset)}
                cy={canTop + px(2.65)}
                rx={px(2.5)}
                ry={px(2)}
                fill="#39444e"
              />
              <ellipse
                cx={cx + px(offset)}
                cy={canTop + px(2.65)}
                rx={px(1.5)}
                ry={px(1.2)}
                fill="none"
                stroke="#6b7884"
                strokeWidth={1.5}
              />
            </g>
          ))}
          <text
            x={cx}
            y={canTop + px(2.65) + 4}
            textAnchor="middle"
            fontSize={9}
            fontWeight={800}
            fill="#f4ecd7"
            fontFamily="var(--font-display)"
          >
            HC-SR04
          </text>
        </g>
      );
    }
    default:
      return null;
  }
}

function ModuleCard({ part, active }: { part: PartInstance; active: boolean }) {
  const box = moduleBox(part);
  const outline = moduleBounds(part);
  const def = partDef(part);
  const above = box.y < 0;
  const ownLeads = part.type === "soil" || part.type === "ds18b20";
  return (
    <g>
      {active && (
        <rect
          x={px(outline.x) - 6}
          y={px(outline.y) - 6}
          width={px(outline.w) + 12}
          height={px(outline.h) + 12}
          rx={16}
          fill="none"
          stroke="#f4ecd7"
          strokeWidth={2.5}
          strokeDasharray="7 7"
          className="animate-dash"
        />
      )}
      <ModuleShape part={part} unit={U} />
      {def.pins.map((pin) => {
        const at = modulePinXY(part, pin.id);
        return (
          <g key={pin.id}>
            <rect
              x={px(at.x) - 11}
              y={px(at.y) + (above ? -21 : 5)}
              width={22}
              height={16}
              rx={5}
              fill="#f4ecd7"
            />
            <text
              x={px(at.x)}
              y={px(at.y) + (above ? -9.5 : 16.5)}
              textAnchor="middle"
              fontSize={9}
              fontWeight={800}
              fill="#0b2d45"
              fontFamily="var(--font-mono)"
            >
              {pin.label}
            </text>
            {ownLeads ? (
              <line
                x1={px(at.x)}
                x2={px(at.x)}
                y1={px(at.y) + (above ? -3 : 3)}
                y2={px(at.y)}
                stroke={
                  pin.role === "vcc"
                    ? "#d35645"
                    : pin.role === "gnd"
                      ? "#26392b"
                      : "#d8b23b"
                }
                strokeWidth={5}
                strokeLinecap="round"
              />
            ) : (
              <rect
                x={px(at.x) - 4}
                y={px(at.y) - 4}
                width={8}
                height={8}
                rx={2}
                fill={INK.pad}
                stroke="#8a6d22"
                strokeWidth={1}
              />
            )}
          </g>
        );
      })}
    </g>
  );
}

/* ── Cables ───────────────────────────────────────────────────── */

/** Polilínea con esquinas redondeadas. */
function rounded(points: XY[], radius = 0.55): string {
  let d = `M${px(points[0].x)} ${px(points[0].y)}`;
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1];
    const corner = points[index];
    const next = points[index + 1];
    const before =
      Math.hypot(corner.x - previous.x, corner.y - previous.y) || 1;
    const after = Math.hypot(next.x - corner.x, next.y - corner.y) || 1;
    const r = Math.min(radius, before / 2, after / 2);
    const inX = corner.x - ((corner.x - previous.x) / before) * r;
    const inY = corner.y - ((corner.y - previous.y) / before) * r;
    const outX = corner.x + ((next.x - corner.x) / after) * r;
    const outY = corner.y + ((next.y - corner.y) / after) * r;
    d += `L${px(inX)} ${px(inY)}Q${px(corner.x)} ${px(corner.y)} ${px(outX)} ${px(outY)}`;
  }
  const last = points[points.length - 1];
  return `${d}L${px(last.x)} ${px(last.y)}`;
}

/**
 * Recorrido de un cable. Los cortos hacen una comba suave. Los largos viajan ordenados por
 * un «carril» sin agujeros (entre el riel y las letras), como un mazo de cables bien peinado.
 * Los que vienen de un módulo externo bajan en curva hasta su agujero.
 */
function wirePath(a: XY, b: XY, index: number): string {
  const off = (point: XY) => point.y < -1.4 || point.y > 18.4;
  if (off(a) || off(b)) {
    const [from, to] = off(a) ? [a, b] : [b, a];
    const midY = from.y + (to.y - from.y) * 0.55;
    return `M${px(from.x)} ${px(from.y)}C${px(from.x)} ${px(midY)} ${px(to.x)} ${px(midY - (to.y - from.y) * 0.1)} ${px(to.x)} ${px(to.y)}`;
  }
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  if (length < 7.5 || Math.abs(dx) < 2) {
    // Comba perpendicular: separa cables paralelos y deja ver los agujeros.
    const sag = Math.min(1.6, 0.4 + length * 0.1) * (index % 2 ? 1 : -1);
    const mx = (a.x + b.x) / 2 - (dy / length) * sag;
    const my = (a.y + b.y) / 2 + (dx / length) * sag;
    return `M${px(a.x)} ${px(a.y)}Q${px(mx)} ${px(my)} ${px(b.x)} ${px(b.y)}`;
  }
  // El carril lo decide el extremo más cercano a la Pico: arriba (2) o abajo (15).
  const near = a.x <= b.x ? a : b;
  const lane = (near.y < 8.5 ? 2.05 : 14.95) + ((index % 3) - 1) * 0.24;
  return rounded([a, { x: a.x, y: lane }, { x: b.x, y: lane }, b]);
}

function WireShape({
  wire,
  a,
  b,
  index,
  state,
}: {
  wire: Wire;
  a: XY;
  b: XY;
  index: number;
  state: "active" | "done";
}) {
  const d = wirePath(a, b, index);
  const color = WIRE_HEX[wire.color];
  const width = wire.kind === "cable" ? 5 : 6.5;
  return (
    <g opacity={state === "done" ? 0.5 : 1}>
      <path
        d={d}
        fill="none"
        stroke="#04121d"
        strokeWidth={width + 3}
        strokeLinecap="round"
        opacity={0.55}
      />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap="round"
      />
      <path
        d={d}
        fill="none"
        stroke="#ffffff"
        strokeWidth={1.4}
        strokeLinecap="round"
        opacity={0.32}
      />
      {state === "active" && (
        <path
          d={d}
          fill="none"
          stroke="#ffffff"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="5 19"
          className="animate-dash"
          opacity={0.95}
        />
      )}
      {[a, b].map((end, key) => (
        <circle
          key={key}
          cx={px(end.x)}
          cy={px(end.y)}
          r={4.6}
          fill={color}
          stroke="#04121d"
          strokeWidth={1.4}
        />
      ))}
    </g>
  );
}

/* ── Rótulos del paso actual ──────────────────────────────────── */

function Callout({
  at,
  text,
  sub,
  box,
  scale,
}: {
  at: XY;
  text: string;
  sub?: string;
  box: CalloutBox;
  scale: number;
}) {
  const { x, y, width, height } = box;
  const anchorX = px(at.x);
  const anchorY = px(at.y);
  const labelX = Math.max(
    x + 8 * scale,
    Math.min(anchorX, x + width - 8 * scale),
  );
  const labelY = anchorY < y ? y : y + height;
  return (
    <g className="pointer-events-none">
      <line
        x1={anchorX}
        y1={anchorY}
        x2={labelX}
        y2={labelY}
        stroke="#0b2d45"
        strokeWidth={3.5 * scale}
      />
      <line
        x1={anchorX}
        y1={anchorY}
        x2={labelX}
        y2={labelY}
        stroke="#f4ecd7"
        strokeWidth={1.5 * scale}
      />
      <circle
        cx={anchorX}
        cy={anchorY}
        r={7 * scale}
        fill="none"
        stroke="#0b2d45"
        strokeWidth={4 * scale}
      />
      <circle
        cx={anchorX}
        cy={anchorY}
        r={7 * scale}
        fill="none"
        stroke="#f4ecd7"
        strokeWidth={2 * scale}
      />
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={7 * scale}
        fill="#fff9e9"
        stroke="#0b2d45"
        strokeWidth={1.5 * scale}
      />
      <text
        x={x + width / 2}
        y={y + 17 * scale}
        textAnchor="middle"
        fontSize={12 * scale}
        fontWeight={800}
        fill="#0b2d45"
        fontFamily="var(--font-mono)"
      >
        {text}
      </text>
      {sub && (
        <text
          x={x + width / 2}
          y={y + 32 * scale}
          textAnchor="middle"
          fontSize={10.5 * scale}
          fontWeight={700}
          fill="#1e5b7f"
          fontFamily="var(--font-body)"
        >
          {sub}
        </text>
      )}
    </g>
  );
}

/* ── Vista ────────────────────────────────────────────────────── */

const ease = (t: number) => 1 - Math.pow(1 - t, 3);

function fit(box: Box, aspect: number, minWidth: number): Box {
  let { x, y, w, h } = box;
  if (w < minWidth) {
    x -= (minWidth - w) / 2;
    w = minWidth;
  }
  if (w / h > aspect) {
    const height = w / aspect;
    y -= (height - h) / 2;
    h = height;
  } else {
    const width = h * aspect;
    x -= (width - w) / 2;
    w = width;
  }
  return { x, y, w, h };
}

/** Si sobra ancho, se muestra más protoboard hacia la derecha en vez de fondo vacío a la izquierda. */
function alignLeft(box: Box, content: Box): Box {
  if (box.w <= content.w) return box;
  const boardEnd = BOARD.width + 1.2;
  return {
    ...box,
    x: Math.max(content.x - 0.8, Math.min(content.x - 0.8, boardEnd - box.w)),
  };
}

export function BreadboardView({
  circuit,
  stepIndex,
  complete = false,
  lit,
  className,
  description,
  activeEndpoint,
  onEndpointActivate,
  requestFocusEndpoint,
  connectionState,
  activePartPin,
  requestFocusPartPin,
}: BreadboardViewProps) {
  const isPico = !circuit.board || circuit.board === "pico";
  const container = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(2.2);
  const [viewport, setViewport] = useState({ width: 660, height: 300 });
  const [follow, setFollow] = useState(true);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const partInspectorOpener = useRef<SVGGElement | null>(null);
  const [hoverStrip, setHoverStrip] = useState<string | null>(null);

  const stepOf = useMemo(() => {
    const map = new Map<string, number>();
    circuit.steps.forEach((step, index) => {
      for (const id of [...(step.parts ?? []), ...(step.wires ?? [])])
        map.set(id, index);
    });
    return map;
  }, [circuit]);
  const current = complete ? circuit.steps.length : stepIndex;
  const stateOf = (id: string): "hidden" | "done" | "active" => {
    const index = stepOf.get(id) ?? 0;
    if (complete) return "done";
    return index > current ? "hidden" : index === current ? "active" : "done";
  };

  const step = complete ? undefined : circuit.steps[stepIndex];
  const activeWire =
    step?.wires?.length === 1
      ? circuit.wires.find((wire) => wire.id === step.wires![0])
      : undefined;
  const usedPins = useMemo(() => {
    const physical = new Set<number>();
    const touch = (endpoint: string) => {
      if (!isPico || !isPoint(endpoint)) return;
      const pin = picoPinForStrip(stripOf(endpoint));
      if (pin) physical.add(pin.physical);
    };
    for (const wire of circuit.wires.filter(
      (wire) => complete || step?.wires?.includes(wire.id),
    )) {
      touch(wire.from);
      touch(wire.to);
    }
    return physical;
  }, [circuit, complete, step]);

  /** Puntos que el paso actual pide mirar. */
  const focus = useMemo(() => {
    if (!step)
      return [] as { at: XY; id: string; note?: string; badge?: string }[];
    const points: { at: XY; id: string; note?: string; badge?: string }[] = [];
    for (const id of step.wires ?? []) {
      const wire = circuit.wires.find((candidate) => candidate.id === id);
      if (!wire) continue;
      [wire.from, wire.to].forEach((end, index) =>
        points.push({
          at: endpointXY(circuit, end),
          id: end,
          badge: index === 0 ? "A" : "B",
        }),
      );
    }
    for (const id of step.parts ?? []) {
      const part = circuit.parts.find((candidate) => candidate.id === id);
      if (!part) continue;
      if (part.holes)
        for (const [pinId, hole] of Object.entries(part.holes)) {
          if (
            activePartPin?.partId === part.id &&
            activePartPin.pinId !== pinId
          )
            continue;
          const pin = partDef(part).pins.find(
            (candidate) => candidate.id === pinId,
          );
          // Solo se rotula el terminal cuando importa cuál es (polaridad, VCC, señal).
          const named =
            pin && pin.role !== "passive" ? pin.label : pin?.aka?.[0];
          points.push({ at: pointXY(hole), id: hole, note: named });
        }
      else {
        const box = moduleBounds(part);
        points.push(
          { at: { x: box.x, y: box.y }, id: "" },
          { at: { x: box.x + box.w, y: box.y + box.h }, id: "" },
        );
      }
    }
    // Shared overview coordinates must not introduce other connections into
    // an individual wire/part step. They only guide explanatory steps.
    if (!points.length)
      for (const hole of step.focus ?? [])
        points.push({ at: pointXY(hole), id: hole });
    return points;
  }, [circuit, step, activePartPin?.partId, activePartPin?.pinId]);

  const whole = useMemo<Box>(() => {
    const modules = circuit.parts.filter(
      (part) => !part.holes && stateOf(part.id) !== "hidden",
    );
    const from = circuit.view?.from ?? 1;
    const to = circuit.view?.to ?? COLUMNS;
    const points: XY[] = [
      { x: BOARD.x0 + from - 3.4, y: -1.9 },
      { x: BOARD.x0 + to + 1.6, y: 19 },
    ];
    for (const part of modules) {
      const box = moduleBounds(part);
      points.push(
        { x: box.x - 0.6, y: box.y - 0.8 },
        { x: box.x + box.w + 0.6, y: box.y + box.h + 0.8 },
      );
    }
    for (const part of circuit.parts)
      if (part.holes && stateOf(part.id) !== "hidden")
        for (const hole of Object.values(part.holes)) {
          const at = pointXY(hole);
          points.push({ x: at.x + 9, y: at.y + (at.y > 8.5 ? 6.5 : -1) });
        }
    if (!isPico) {
      const box = controllerBox(circuit.board);
      points.push(
        { x: box.x - 1.2, y: box.y - 0.8 },
        { x: box.x + box.w + 0.5, y: box.y + box.h + 0.8 },
      );
    }
    return boundsOf(points, 0.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit, current, complete]);

  const target = useMemo<Box>(() => {
    if (!focus.length) return alignLeft(fit(whole, aspect, 30), whole);
    // Frame the pending gesture, not all previously placed tall sensors. A
    // 98 mm soil probe must not turn a two-pin connection into a tiny overview.
    const box = boundsOf(
      focus.map((point) => point.at),
      0,
    );
    const framed = fit(
      { x: box.x - 4, y: box.y - 3.5, w: box.w + 8, h: box.h + 7 },
      aspect,
      14,
    );
    // Sin salirse del montaje por los lados.
    const min = whole.x - 1;
    const max = whole.x + whole.w + 1;
    if (framed.w >= max - min) return alignLeft(fit(whole, aspect, 30), whole);
    return { ...framed, x: Math.min(Math.max(framed.x, min), max - framed.w) };
  }, [focus, whole, aspect]);

  const [view, setView] = useState<Box>(target);
  const viewRef = useRef(view);
  viewRef.current = view;
  useEffect(() => {
    if (follow) return;
    // Preserve the user's zoom on rotation while keeping pointer coordinates
    // aligned with the SVG (no letterboxing after the viewport changes).
    setView((box) => {
      const h = box.w / aspect;
      return Math.abs(h - box.h) < 0.001
        ? box
        : { ...box, y: box.y + (box.h - h) / 2, h };
    });
  }, [aspect, follow]);
  useEffect(() => {
    if (!follow) return;
    const from = viewRef.current;
    const started = performance.now();
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    let frame = 0;
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - started) / 420);
      const k = ease(t);
      setView({
        x: from.x + (target.x - from.x) * k,
        y: from.y + (target.y - from.y) * k,
        w: from.w + (target.w - from.w) * k,
        h: from.h + (target.h - from.h) * k,
      });
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [follow, target.x, target.y, target.w, target.h]);

  useEffect(() => {
    setInspect(null);
    setFollow(true);
  }, [circuit.id, stepIndex, complete]);

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) {
        setAspect(width / height);
        setViewport({ width, height });
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const zoom = useCallback((factor: number, center?: XY) => {
    setFollow(false);
    setView((box) => {
      const w = Math.max(10, Math.min(110, box.w * factor));
      const h = (w / box.w) * box.h;
      const cx = center?.x ?? box.x + box.w / 2;
      const cy = center?.y ?? box.y + box.h / 2;
      return {
        x: cx - ((cx - box.x) * w) / box.w,
        y: cy - ((cy - box.y) * h) / box.h,
        w,
        h,
      };
    });
  }, []);

  /* Arrastrar para mover, pellizcar para acercar. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    moved.current = false;
  };
  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const previous = pointers.current.get(event.pointerId);
    if (!previous) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const scale = viewRef.current.w / rect.width;
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (pointers.current.size === 1) {
      if (!moved.current && Math.hypot(dx, dy) < 4) return;
      if (!moved.current)
        event.currentTarget.setPointerCapture(event.pointerId);
      moved.current = true;
      setFollow(false);
      setView((box) => ({
        ...box,
        x: box.x - dx * scale,
        y: box.y - dy * scale,
      }));
    } else if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(
        ([id]) => id !== event.pointerId,
      )![1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(
        event.clientX - other.x,
        event.clientY - other.y,
      );
      if (before > 0 && after > 0) zoom(before / after);
      moved.current = true;
    }
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
  };
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };

  useEffect(() => {
    const element = container.current;
    if (!element) return;
    // Rueda con Ctrl/⌘ para acercar: la rueda sola sigue desplazando la página.
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const rect = element.getBoundingClientRect();
      const box = viewRef.current;
      zoom(event.deltaY > 0 ? 1.12 : 0.89, {
        x: box.x + ((event.clientX - rect.left) / rect.width) * box.w,
        y: box.y + ((event.clientY - rect.top) / rect.height) * box.h,
      });
    };
    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoom]);

  const inspectPin = useCallback((pin: PicoPin) => {
    setInspect({
      title: `${pin.name} · pin físico ${pin.physical}`,
      lines: [
        pin.role,
        `Voltaje: ${pin.voltage}.`,
        `En la protoboard: agujeros ${pin.free[0]} y ${pin.free[1]}.`,
        ...(STATION_ROLE[pin.name]
          ? [`En la estación: ${STATION_ROLE[pin.name]}.`]
          : []),
      ],
      warning: undefined,
    });
  }, []);

  const inspectHole = (id: string) => {
    const strip = stripOf(id, true);
    const point = parsePoint(id);
    const pin = isPico ? picoPinForStrip(strip) : undefined;
    const here: string[] = [];
    for (const part of circuit.parts) {
      if (stateOf(part.id) === "hidden") continue;
      for (const [pinId, hole] of Object.entries(part.holes ?? {}))
        if (stripOf(hole, true) === strip)
          here.push(
            `${part.label} (${partDef(part).pins.find((p) => p.id === pinId)?.label ?? pinId})`,
          );
    }
    for (const wire of circuit.wires) {
      if (stateOf(wire.id) === "hidden") continue;
      for (const end of [wire.from, wire.to])
        if (isPoint(end) && stripOf(end, true) === strip)
          here.push(`cable ${wire.color} (${wire.carries})`);
    }
    setInspect(
      point.kind === "rail"
        ? {
            title: `${RAIL_INFO[point.rail].label}`,
            lines: [
              "Este plano considera rieles partidos entre 31 y 33: sólo los agujeros de esta mitad están unidos por dentro.",
              "Comprueba la continuidad de tu protoboard real; un puente une ambas mitades.",
              RAIL_INFO[point.rail].sign === "+"
                ? `En este montaje, los rieles rojos llevan ${circuit.wires.find((wire) => wire.id === "w_3v3_top")?.carries === "5V" ? "5" : "3,3"} V.`
                : "En el taller, los rieles azules son GND (0 V).",
              ...(here.length
                ? [`Aquí llegan: ${[...new Set(here)].join(", ")}.`]
                : []),
            ],
          }
        : {
            title: `Agujero ${id}`,
            lines: [
              `Está unido por dentro con ${holesOfStrip(strip)
                .filter((hole) => hole !== id)
                .join(", ")}.`,
              ...(pin
                ? [
                    `Esta tira es el pin ${pin.name} (pin ${pin.physical}) de la Pico.`,
                  ]
                : []),
              ...(here.length
                ? [`Aquí están: ${[...new Set(here)].join(", ")}.`]
                : ["Está libre."]),
            ],
            warning: undefined,
          },
    );
  };

  const onClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (moved.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const box = viewRef.current;
    const x = box.x + ((event.clientX - rect.left) / rect.width) * box.w;
    const y = box.y + ((event.clientY - rect.top) / rect.height) * box.h;
    const hole = nearestHole(x, y);
    if (activeWire) {
      const ends = [activeWire.from, activeWire.to];
      const index = ends.findIndex((end) => {
        const at = endpointXY(circuit, end);
        return Math.hypot(at.x - x, at.y - y) < 0.6;
      });
      if (index >= 0) {
        onEndpointActivate?.(index === 0 ? "a" : "b");
        return;
      }
    }
    if (hole) inspectHole(hole);
    else setInspect(null);
  };
  const inspectPart = (part: PartInstance, opener: SVGGElement) => {
    partInspectorOpener.current = opener;
    const definition = partDef(part);
    setInspect({
      title: part.label,
      lines: [
        definition.about,
        ...definition.pins.map(
          (pin) =>
            `${pin.label}${pin.aka?.length ? ` (${pin.aka.join(" / ")})` : ""}${part.holes?.[pin.id] ? ` → ${part.holes[pin.id]}` : ""}`,
        ),
      ],
    });
  };
  const closeInspect = () => {
    setInspect(null);
    partInspectorOpener.current?.focus();
  };
  const partInteraction = (part: PartInstance) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": `Inspeccionar ${part.label}`,
    "data-part": part.id,
    className: "group pointer-events-auto cursor-pointer outline-none",
    onClick: (event: ReactMouseEvent<SVGGElement>) => {
      event.stopPropagation();
      if (moved.current) return;
      // Body inspection must not replace the pending cable's physical hotspot.
      const rect = event.currentTarget.ownerSVGElement!.getBoundingClientRect();
      const box = viewRef.current;
      const x = box.x + ((event.clientX - rect.left) / rect.width) * box.w;
      const y = box.y + ((event.clientY - rect.top) / rect.height) * box.h;
      const end =
        activeWire &&
        [activeWire.from, activeWire.to].findIndex((endpoint) => {
          const point = endpointXY(circuit, endpoint);
          return Math.hypot(point.x - x, point.y - y) < 0.6;
        });
      if (typeof end === "number" && end >= 0)
        onEndpointActivate?.(end === 0 ? "a" : "b");
      else inspectPart(part, event.currentTarget);
    },
    onKeyDown: (event: React.KeyboardEvent<SVGGElement>) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      event.stopPropagation();
      inspectPart(part, event.currentTarget);
    },
  });
  const partFocusRing = (part: PartInstance) => {
    const box = part.holes
      ? boundsOf(Object.values(part.holes).map(pointXY), 3)
      : moduleBounds(part);
    return (
      <rect
        x={px(box.x) - 7}
        y={px(box.y) - 7}
        width={px(box.w) + 14}
        height={px(box.h) + 14}
        rx={12}
        fill="none"
        stroke="#dfff80"
        strokeWidth={3}
        className="pointer-events-none opacity-0 group-focus-visible:opacity-100"
      />
    );
  };
  const onHover = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointers.current.size) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const box = viewRef.current;
    const hole = nearestHole(
      box.x + ((event.clientX - rect.left) / rect.width) * box.w,
      box.y + ((event.clientY - rect.top) / rect.height) * box.h,
    );
    setHoverStrip(hole ? stripOf(hole, true) : null);
  };

  const callouts = useMemo(() => {
    const seen = new Set<string>();
    return focus
      .filter((point) => point.id && !seen.has(point.id) && seen.add(point.id))
      .map((point, index, all) => {
        const isHole = isPoint(point.id);
        const pin =
          isHole && isPico ? picoPinForStrip(stripOf(point.id)) : undefined;
        const part = !isHole
          ? circuit.parts.find(
              (candidate) => candidate.id === point.id.split(".")[0],
            )
          : undefined;
        const label = point.id.startsWith("controller.")
          ? controllerPin(circuit.board, point.id.split(".")[1]).label
          : isHole
            ? shortPoint(point.id)
            : (partDef(part!).pins.find(
                (candidate) => candidate.id === point.id.split(".")[1],
              )?.label ?? "");
        // Arriba para la mitad superior, abajo para la inferior; se alterna si chocan.
        let side: -1 | 1 = point.at.y > 8.5 ? 1 : -1;
        if (!isHole) side = point.at.y < 0 ? -1 : 1;
        const crowded = all.some(
          (other, otherIndex) =>
            otherIndex < index &&
            Math.abs(other.at.x - point.at.x) < 2.6 &&
            Math.abs(other.at.y - point.at.y) < 2.2,
        );
        if (crowded) side = (side * -1) as -1 | 1;
        return {
          ...point,
          label: point.badge ? `${point.badge} · ${label}` : label,
          sub: pin
            ? `${pin.name} · pin ${pin.physical}`
            : (point.note ??
              (point.id.startsWith("controller.")
                ? `Arduino ${circuit.board === "uno" ? "Uno" : "Nano"}`
                : (part?.label ??
                  (isHole && parsePoint(point.id).kind === "rail"
                    ? RAIL_INFO[
                        (
                          parsePoint(point.id) as {
                            kind: "rail";
                            rail: RailName;
                          }
                        ).rail
                      ].label
                    : undefined)))),
          side,
        };
      });
  }, [focus, circuit]);

  const labelScale = px(view.w) / viewport.width;
  const visibleCallouts = callouts.filter(
    (callout) =>
      (!activeEndpoint ||
        !callout.badge ||
        callout.badge.toLowerCase() === activeEndpoint) &&
      callout.at.x >= view.x &&
      callout.at.x <= view.x + view.w &&
      callout.at.y >= view.y &&
      callout.at.y <= view.y + view.h,
  );
  const labelBoxes = layoutCallouts(
    visibleCallouts.map((callout) => ({
      x: px(callout.at.x - view.x) / labelScale,
      y: px(callout.at.y - view.y) / labelScale,
      width: Math.max(
        60,
        callout.label.length * 7.6 + 20,
        (callout.sub?.length ?? 0) * 6.5 + 20,
      ),
      height: callout.sub ? 40 : 26,
      side: callout.side,
    })),
    viewport.width - 55,
    viewport.height - (activeWire ? 68 : 34),
  );

  const focusEndpoint = (endpoint: string) => {
    const point = endpointXY(circuit, endpoint);
    setFollow(false);
    const w = Math.min(18, aspect * 15);
    const h = w / aspect;
    setView({ x: point.x - w / 2, y: point.y - h / 2, w, h });
    setInspect(null);
  };

  useEffect(() => {
    if (!requestFocusEndpoint || !activeWire) return;
    focusEndpoint(
      requestFocusEndpoint.endpoint === "a" ? activeWire.from : activeWire.to,
    );
  }, [requestFocusEndpoint?.token, activeWire?.id, circuit.board]);

  useEffect(() => {
    if (!requestFocusPartPin) return;
    const part = circuit.parts.find(
      (candidate) => candidate.id === requestFocusPartPin.partId,
    );
    const hole = part?.holes?.[requestFocusPartPin.pinId];
    if (hole) focusEndpoint(hole);
  }, [requestFocusPartPin?.token, circuit.id, circuit.board]);

  const wires = circuit.wires
    .map((wire, index) => ({ wire, index, state: stateOf(wire.id) }))
    .filter((entry) => entry.state !== "hidden");
  const parts = circuit.parts
    .map((part) => ({ part, state: stateOf(part.id) }))
    .filter((entry) => entry.state !== "hidden");

  return (
    <div
      ref={container}
      className={cx(
        "relative isolate h-full min-h-[280px] w-full touch-none select-none overflow-hidden rounded-xl bg-night",
        className,
      )}
    >
      <svg
        role="img"
        data-board={circuit.board ?? "pico"}
        data-circuit={circuit.id}
        aria-label={
          description ?? `Diagrama de la protoboard: ${circuit.title}`
        }
        viewBox={`${px(view.x)} ${px(view.y)} ${px(view.w)} ${px(view.h)}`}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        preserveAspectRatio="xMidYMid meet"
        tabIndex={0}
        onKeyDown={(event) => {
          if (["+", "=", "-", "0", "Escape"].includes(event.key)) {
            event.preventDefault();
            event.stopPropagation();
          }
          if (event.key === "+" || event.key === "=") zoom(0.8);
          if (event.key === "-") zoom(1.25);
          if (event.key === "0") {
            setFollow(true);
            setView(target);
          }
          if (event.key === "Escape") closeInspect();
        }}
        onPointerDown={onPointerDown}
        onPointerMove={(event) => {
          onPointerMove(event);
          onHover(event);
        }}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHoverStrip(null)}
        onClick={onClick}
      >
        <BoardLayer pico={isPico} />
        {hoverStrip &&
          holesOfStrip(hoverStrip).map((hole) => {
            const at = pointXY(hole);
            return (
              <circle
                key={hole}
                cx={px(at.x)}
                cy={px(at.y)}
                r={8.5}
                fill="#6fb3d9"
                opacity={0.42}
                className="pointer-events-none"
              />
            );
          })}
        {isPico ? (
          <PicoLayer used={usedPins} onInspect={inspectPin} />
        ) : (
          <ControllerLayer
            board={circuit.board!}
            onInspect={(name) => {
              const end = `controller.${name}`;
              if (activeWire?.from === end || activeWire?.to === end)
                onEndpointActivate?.(activeWire.from === end ? "a" : "b");
              else
                setInspect({
                  title: `Pin ${controllerPin(circuit.board, name).label} de Arduino`,
                  lines: [
                    name.startsWith("A")
                      ? "Entrada analógica: convierte un voltaje en un número."
                      : name.startsWith("D")
                        ? "Pin digital: envía o recibe una señal."
                        : name.startsWith("GND")
                          ? "GND: el punto común del circuito."
                          : name === "3V3"
                            ? "Salida de 3,3 V para los sensores del taller."
                            : name === "5V"
                              ? "Salida de 5 V del USB."
                              : "Conector de la placa.",
                  ],
                });
            }}
          />
        )}
        {parts
          .filter((entry) => entry.part.holes)
          .map(({ part, state }) => (
            <g
              key={part.id}
              opacity={state === "done" ? 0.72 : 1}
              {...partInteraction(part)}
            >
              <PartShape part={part} lit={lit?.[part.id]} />
              {partFocusRing(part)}
            </g>
          ))}
        <g className="pointer-events-none">
          {wires
            .filter((entry) => entry.state === "done")
            .map(({ wire, index }) => (
              <WireShape
                key={wire.id}
                wire={wire}
                index={index}
                state="done"
                a={endpointXY(circuit, wire.from)}
                b={endpointXY(circuit, wire.to)}
              />
            ))}
          {parts
            .filter((entry) => !entry.part.holes)
            .map(({ part, state }) => (
              <g
                key={part.id}
                opacity={state === "done" ? 0.8 : 1}
                {...partInteraction(part)}
              >
                <ModuleCard part={part} active={state === "active"} />
                {partFocusRing(part)}
              </g>
            ))}
          {wires
            .filter(
              (entry) =>
                entry.state === "active" &&
                (!connectionState ||
                  connectionState === "placed" ||
                  connectionState === "b"),
            )
            .map(({ wire, index }) => (
              <g key={wire.id}>
                <g opacity={connectionState === "b" ? 0.24 : 1}>
                  <WireShape
                    wire={wire}
                    index={index}
                    state="active"
                    a={endpointXY(circuit, wire.from)}
                    b={endpointXY(circuit, wire.to)}
                  />
                </g>
                {connectionState === "b" && (
                  <circle
                    cx={px(endpointXY(circuit, wire.from).x)}
                    cy={px(endpointXY(circuit, wire.from).y)}
                    r={5}
                    fill={WIRE_HEX[wire.color]}
                    stroke="#f5ffe2"
                    strokeWidth={2}
                  />
                )}
              </g>
            ))}
          {visibleCallouts.map((callout, index) => (
            <Callout
              key={callout.id}
              at={callout.at}
              text={callout.label}
              sub={callout.sub}
              scale={labelScale}
              box={{
                x: px(view.x) + labelBoxes[index].x * labelScale,
                y: px(view.y) + labelBoxes[index].y * labelScale,
                width: labelBoxes[index].width * labelScale,
                height: labelBoxes[index].height * labelScale,
              }}
            />
          ))}
        </g>
        {activeWire &&
          [activeWire.from, activeWire.to].map((end, index) => {
            const at = endpointXY(circuit, end);
            const selected = activeEndpoint === (index === 0 ? "a" : "b");
            return (
              <g
                key={end}
                className="cursor-pointer"
                onClick={(event) => {
                  event.stopPropagation();
                  onEndpointActivate?.(index === 0 ? "a" : "b");
                }}
              >
                <title>{`Tocar extremo ${index === 0 ? "A" : "B"}: ${end}`}</title>
                <circle
                  cx={px(at.x)}
                  cy={px(at.y)}
                  r={selected ? 14 : 10}
                  fill={selected ? "#d9f474" : "#62e8b2"}
                  fillOpacity={0.35}
                  stroke={selected ? "#f0ffb6" : "#1d9667"}
                  strokeWidth={selected ? 4 : 2}
                />
              </g>
            );
          })}
      </svg>

      <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
        <IconButton
          icon="zoomIn"
          label="Acercar"
          size="sm"
          tone="dark"
          onClick={() => zoom(0.8)}
        />
        <IconButton
          icon="zoomOut"
          label="Alejar"
          size="sm"
          tone="dark"
          onClick={() => zoom(1.25)}
        />
        <IconButton
          icon="expand"
          label="Ver todo el montaje"
          size="sm"
          tone="dark"
          onClick={() => {
            setFollow(false);
            setView(alignLeft(fit(whole, aspect, 30), whole));
          }}
        />
        {!complete && (
          <IconButton
            icon="target"
            label={
              follow ? "Siguiendo el paso actual" : "Volver al paso actual"
            }
            size="sm"
            tone="dark"
            active={follow}
            onClick={() => {
              setFollow(true);
              setView(target);
            }}
          />
        )}
      </div>

      {activeWire && !inspect && (
        <div
          className="absolute inset-x-2.5 bottom-2.5 flex gap-2"
          aria-label="Acercar a un extremo del cable"
        >
          {[activeWire.from, activeWire.to].map((endpoint, index) => (
            <button
              key={`${index}-${endpoint}`}
              type="button"
              onClick={() => {
                focusEndpoint(endpoint);
                onEndpointActivate?.(index === 0 ? "a" : "b");
              }}
              className="focus-ring flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 rounded-md border border-cream/25 bg-primary-deep px-2 py-2 text-sm font-extrabold text-cream shadow-lifted"
              aria-label={`Acercar extremo ${index === 0 ? "A" : "B"}: ${endpoint}`}
              aria-pressed={activeEndpoint === (index === 0 ? "a" : "b")}
            >
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-cream text-xs text-primary">
                {index === 0 ? "A" : "B"}
              </span>
              <span className="truncate">
                {isPoint(endpoint)
                  ? shortPoint(endpoint)
                  : endpoint.split(".").at(-1)}
              </span>
              <Icon name="zoomIn" size={14} className="shrink-0" />
            </button>
          ))}
        </div>
      )}

      {inspect ? (
        <div
          role="region"
          aria-label={`Ficha de ${inspect.title}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              closeInspect();
            }
          }}
          className="absolute inset-x-2.5 bottom-2.5 flex animate-rise items-start gap-3 rounded-md bg-cream p-3 text-primary shadow-lifted sm:right-auto sm:max-w-sm"
        >
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-extrabold">
              {inspect.title}
            </p>
            {inspect.lines.map((line) => (
              <p
                key={line}
                className="mt-0.5 text-[13px] font-semibold leading-[18px] text-secondary"
              >
                {line}
              </p>
            ))}
            {inspect.warning && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[13px] font-extrabold leading-[18px] text-danger-ink">
                <Icon name="alert" size={14} className="mt-0.5" />
                {inspect.warning}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-label="Cerrar ficha"
            onClick={closeInspect}
            className="focus-ring -m-1 flex size-8 shrink-0 items-center justify-center rounded-sm text-secondary hover:bg-cream-shade"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : (
        !activeWire && (
          <p className="pointer-events-none absolute bottom-2.5 left-2.5 hidden items-center gap-1.5 rounded-pill bg-primary-deep/85 px-3 py-1.5 text-xs font-bold text-accent-soft sm:flex">
            <Icon name="tap" size={14} />
            Toca un agujero o un pin para saber qué es. Arrastra para mover.
          </p>
        )
      )}
    </div>
  );
}

/** Agujero más cercano a un punto del dibujo, si está a menos de medio paso. */
function nearestHole(x: number, y: number): string | null {
  const column = Math.round(x - BOARD.x0 + 1);
  if (column < 1 || column > COLUMNS) return null;
  if (Math.abs(x - (BOARD.x0 + column - 1)) > 0.46) return null;
  for (const letter of LETTERS)
    if (Math.abs(y - letterY(letter)) <= 0.46) {
      if (column <= PICO_COLUMNS && "cdefgh".includes(letter)) return null;
      return `${letter}${column}`;
    }
  for (const rail of ["tp", "tn", "bp", "bn"] as RailName[])
    if (Math.abs(y - railY(rail)) <= 0.46 && RAIL_COLUMNS.includes(column))
      return `${rail}:${column}`;
  return null;
}

/** Texto de las bandas para la ficha de una resistencia. */
export const bandsText = (ohms: number) => resistorBandNames(ohms);
