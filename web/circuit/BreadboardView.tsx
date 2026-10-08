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
import { boundsOf, endpointXY, moduleBox, modulePinXY, type XY } from "./geometry";
import {
  WIRE_HEX,
  resistorBandNames,
  resistorBands,
  type Circuit,
  type PartInstance,
  type Wire,
} from "./model";
import { partDef } from "./parts";
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
  print: "#9a8f73",
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
}

/* ── Capa estática: la protoboard ─────────────────────────────── */

const BoardLayer = memo(function BoardLayer() {
  const holes: ReactElement[] = [];
  for (let column = 1; column <= COLUMNS; column++) {
    const x = px(BOARD.x0 + column - 1);
    for (const letter of LETTERS) {
      // Los agujeros bajo la Pico no se dibujan: quedan tapados por la placa.
      if (column <= PICO_COLUMNS && "defg".includes(letter)) continue;
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
          fontSize={major ? 8.5 : 6.5}
          fontWeight={major ? 800 : 500}
          opacity={major ? 1 : 0.62}
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
          <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#020a12" floodOpacity="0.45" />
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
            <line
              x1={px(BOARD.x0 + 1.4)}
              x2={lastX - px(1.4)}
              y1={px(y)}
              y2={px(y)}
              stroke={color}
              strokeWidth={2}
              strokeLinecap="round"
            />
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
              fontSize={9}
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
      <rect x={left - 9} y={midY - 21} width={36} height={42} rx={4} fill={INK.metal} stroke="#7e8a92" />
      <rect x={left - 3} y={midY - 13} width={22} height={26} rx={2} fill="#8e9aa2" opacity={0.6} />
      <text x={left + 46} y={midY + 3} fontSize={8} fontWeight={800} fill={INK.silk} fontFamily="var(--font-display)">
        USB
      </text>
      {/* LED integrado y botón BOOTSEL */}
      <rect x={left + 34} y={top + 30} width={9} height={6} rx={1.5} fill="#bff2a8" />
      <text x={left + 46} y={top + 36} fontSize={6.5} fontWeight={700} fill={INK.silk} fontFamily="var(--font-mono)">
        LED
      </text>
      <rect x={left + 78} y={midY - 18} width={24} height={20} rx={3} fill="#f1ead8" stroke="#bdb193" />
      <circle cx={left + 90} cy={midY - 8} r={5} fill="#d8ccac" />
      <text x={left + 90} y={midY + 13} textAnchor="middle" fontSize={6} fontWeight={700} fill={INK.silk} fontFamily="var(--font-mono)">
        BOOTSEL
      </text>
      {/* RP2040 y módulo Wi-Fi */}
      <rect x={left + 190} y={midY - 21} width={42} height={42} rx={3} fill="#17212a" />
      <text x={left + 211} y={midY + 3} textAnchor="middle" fontSize={7} fontWeight={700} fill="#8fa0ad" fontFamily="var(--font-mono)">
        RP2040
      </text>
      <rect x={right - 150} y={midY - 26} width={74} height={52} rx={4} fill={INK.metal} stroke="#7e8a92" />
      <text x={right - 113} y={midY + 3} textAnchor="middle" fontSize={8} fontWeight={800} fill="#4d5a63" fontFamily="var(--font-display)">
        Wi-Fi
      </text>
      <path
        d={`M${right - 58} ${midY - 22}h34v11h-26v11h26v11h-26v11h26`}
        fill="none"
        stroke={INK.pad}
        strokeWidth={2.4}
        opacity={0.75}
      />
      <text x={left + 300} y={midY + 4} textAnchor="middle" fontSize={10} fontWeight={800} fill={INK.silk} opacity={0.9} fontFamily="var(--font-display)">
        Raspberry Pi Pico W
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
            <rect x={x - 11} y={y - 13 + (inward < 0 ? -22 : 0)} width={22} height={48} fill="transparent" />
            <rect x={x - 6.5} y={y - 6.5} width={13} height={13} rx={3.5} fill={INK.pad} stroke={tint ?? "#a8852c"} strokeWidth={tint ? 2.4 : 1} />
            <circle cx={x} cy={y} r={2.6} fill="#5d4a15" />
            {isUsed && (
              <rect x={x - 10} y={y + inward * 13 - 6.5 + (inward < 0 ? -9 : 0)} width={20} height={22} rx={4} fill="#f4ecd7" opacity={0.96} />
            )}
            <text
              x={x}
              y={y + inward * 16 + 2.5}
              textAnchor="middle"
              fontSize={pin.name.length > 4 ? 5.6 : 6.6}
              fontWeight={800}
              fill={isUsed ? "#0b2d45" : INK.silk}
              fontFamily="var(--font-mono)"
            >
              {SHORT_NAME[pin.name] ?? pin.name}
            </text>
            <text
              x={x}
              y={y + inward * 24 + 2.5}
              textAnchor="middle"
              fontSize={5.4}
              fontWeight={600}
              fill={isUsed ? "#1e5b7f" : "#a9dcc4"}
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

function Lead({ a, b }: { a: XY; b: XY }) {
  return (
    <line x1={px(a.x)} y1={px(a.y)} x2={px(b.x)} y2={px(b.y)} stroke={INK.lead} strokeWidth={3} strokeLinecap="round" />
  );
}

function Foot({ at }: { at: XY }) {
  return <circle cx={px(at.x)} cy={px(at.y)} r={3.4} fill="#8d979e" stroke="#5c666d" strokeWidth={0.8} />;
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
          <g transform={`translate(${px((a.x + b.x) / 2)} ${px((a.y + b.y) / 2)}) rotate(${angle})`}>
            <rect x={px(-body / 2)} y={-8} width={px(body)} height={16} rx={7} fill="#e3c98d" stroke="#b79a5b" strokeWidth={1} />
            {bands.map((color, index) => (
              <rect
                key={index}
                x={px(-body / 2) + px(body) * (0.16 + index * (index === 3 ? 0.21 : 0.17))}
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
      const color = { rojo: "#e5484d", amarillo: "#f0c13b", azul: "#4b9be8" }[part.props?.color ?? "rojo"];
      const flatLeft = cathode.x < anode.x;
      return (
        <g>
          <line x1={px(anode.x)} y1={px(anode.y)} x2={cx + (flatLeft ? 5 : -5)} y2={cy} stroke={INK.lead} strokeWidth={2.6} strokeLinecap="round" />
          <line x1={px(cathode.x)} y1={px(cathode.y)} x2={cx + (flatLeft ? -5 : 5)} y2={cy} stroke={INK.lead} strokeWidth={2.6} strokeLinecap="round" />
          {lit && <circle cx={cx} cy={cy} r={34} fill={color} opacity={0.35} style={{ filter: "blur(9px)" }} />}
          <circle cx={cx} cy={cy} r={15} fill={color} stroke="#00000030" strokeWidth={1.5} opacity={lit ? 1 : 0.9} />
          {/* Borde plano del lado del cátodo (pata corta) */}
          <rect x={flatLeft ? cx - 16 : cx + 11.5} y={cy - 10} width={4.5} height={20} fill="#00000038" rx={1} />
          <circle cx={cx - 4} cy={cy - 5} r={4.5} fill="#ffffff" opacity={lit ? 0.85 : 0.45} />
          <text x={px(anode.x)} y={px(anode.y) + 17} textAnchor="middle" fontSize={11} fontWeight={800} fill="#8e2b2b" fontFamily="var(--font-display)">
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
          <circle cx={cx} cy={cy} r={19} fill="#d9b25c" stroke="#9c7a2c" strokeWidth={1.5} />
          <path d={`M${cx - 11} ${cy - 9}h18v6h-14v6h14v6h-18`} fill="none" stroke="#7a2f1d" strokeWidth={2} strokeLinejoin="round" />
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
          <rect x={px((a.x + b.x) / 2) - 22} y={px(a.y) - 11} width={44} height={22} rx={10} fill="#c8a24a" stroke="#8c6d22" strokeWidth={1.4} />
          <circle cx={px((a.x + b.x) / 2) + 8} cy={px(a.y)} r={5} fill="#f3e2ac" />
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
          <circle cx={cx} cy={cy} r={px(2.36)} fill="#1c242c" stroke="#0d1319" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={px(2.36) - 9} fill="none" stroke="#35424d" strokeWidth={2} />
          <circle cx={cx} cy={cy} r={7} fill="#0a0f14" />
          <text x={px(plus.x) + 2} y={cy - 24} textAnchor="middle" fontSize={15} fontWeight={800} fill="#f4ecd7" fontFamily="var(--font-display)">
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
          <rect x={cx - px(2.35)} y={cy - px(2.35)} width={px(4.7)} height={px(4.7)} rx={8} fill="#232d36" stroke="#0f161c" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={px(1.55)} fill="#e0b84a" stroke="#a88525" strokeWidth={2} />
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
              <line x1={px(at(pin).x)} y1={px(at(pin).y)} x2={px(at(pin).x)} y2={cy - 20} stroke={INK.lead} strokeWidth={3} />
              <Foot at={at(pin)} />
            </g>
          ))}
          <rect x={cx - px(1.9)} y={cy - px(1.3)} width={px(3.8)} height={px(2.6)} rx={6} fill="#2d6f9e" stroke="#1c4a6c" strokeWidth={1.5} />
          <circle cx={cx} cy={cy} r={19} fill="#eef3f6" stroke="#9fb0bc" strokeWidth={1.5} />
          <line x1={cx} y1={cy} x2={cx + 11} y2={cy - 11} stroke="#0b2d45" strokeWidth={3.5} strokeLinecap="round" />
        </g>
      );
    }
    case "lm35": {
      const out = at("vout");
      const cx = px(out.x);
      const cy = px(out.y);
      return (
        <g>
          <path d={`M${cx - 30} ${cy + 9}a30 30 0 0 1 60 0z`} fill="#1c242c" stroke="#0d1319" strokeWidth={1.5} />
          <text x={cx} y={cy + 3} textAnchor="middle" fontSize={7.5} fontWeight={800} fill="#c9d3da" fontFamily="var(--font-mono)">
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
      const cx = px(data.x);
      const outward = data.y > 8.5 ? 1 : -1;
      const y = outward > 0 ? px(data.y) + px(0.35) : px(data.y) - px(3.1);
      return (
        <g>
          {["VCC", "DATA", "GND"].map((pin) => (
            <Foot key={pin} at={at(pin)} />
          ))}
          <rect x={cx - px(2.8)} y={y} width={px(5.6)} height={px(2.75)} rx={5} fill="#2f7fc4" stroke="#1c5388" strokeWidth={1.5} />
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
          <text x={cx} y={y + px(2.75) + 14} textAnchor="middle" fontSize={9} fontWeight={800} fill="#f4ecd7" fontFamily="var(--font-display)">
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
          <rect x={cx - px(8.85)} y={y - 7 + (outward > 0 ? 3 : -3)} width={px(17.7)} height={14} rx={3} fill="#2f7fc4" stroke="#1c5388" strokeWidth={1.4} />
          {["VCC", "TRIG", "ECHO", "GND"].map((pin) => (
            <Foot key={pin} at={at(pin)} />
          ))}
          {[-5.1, 5.1].map((offset) => (
            <g key={offset}>
              <rect x={cx + px(offset - 3.15)} y={canTop} width={px(6.3)} height={px(5.3)} rx={12} fill="#c9d1d7" stroke="#8793a0" strokeWidth={1.5} />
              <ellipse cx={cx + px(offset)} cy={canTop + px(2.65)} rx={px(2.5)} ry={px(2)} fill="#39444e" />
              <ellipse cx={cx + px(offset)} cy={canTop + px(2.65)} rx={px(1.5)} ry={px(1.2)} fill="none" stroke="#6b7884" strokeWidth={1.5} />
            </g>
          ))}
          <text x={cx} y={canTop + px(2.65) + 4} textAnchor="middle" fontSize={9} fontWeight={800} fill="#f4ecd7" fontFamily="var(--font-display)">
            HC-SR04
          </text>
        </g>
      );
    }
    default:
      return null;
  }
}

const MODULE_STYLE: Record<string, { fill: string; edge: string; ink: string }> = {
  soil: { fill: "#1f2a33", edge: "#0d151b", ink: "#f4ecd7" },
  ds18b20: { fill: "#8d99a3", edge: "#5f6b75", ink: "#0b2d45" },
  rain: { fill: "#2f7fc4", edge: "#1c5388", ink: "#f4ecd7" },
  water: { fill: "#c9463d", edge: "#8e2b2b", ink: "#f4ecd7" },
  pir: { fill: "#2e7d5b", edge: "#1f5e43", ink: "#f4ecd7" },
  generic: { fill: "#1e5b7f", edge: "#123d5c", ink: "#f4ecd7" },
};

function ModuleCard({ part, active }: { part: PartInstance; active: boolean }) {
  const box = moduleBox(part);
  const def = partDef(part);
  const style = MODULE_STYLE[part.type] ?? MODULE_STYLE.generic;
  const above = box.y < 0;
  return (
    <g>
      {active && (
        <rect x={px(box.x) - 6} y={px(box.y) - 6} width={px(box.w) + 12} height={px(box.h) + 12} rx={16} fill="none" stroke="#f4ecd7" strokeWidth={2.5} strokeDasharray="7 7" className="animate-dash" />
      )}
      <rect x={px(box.x)} y={px(box.y)} width={px(box.w)} height={px(box.h)} rx={11} fill={style.fill} stroke={style.edge} strokeWidth={2} />
      <text
        x={px(box.x + box.w / 2)}
        y={px(box.y) + (above ? 28 : px(box.h) - 16)}
        textAnchor="middle"
        fontSize={12}
        fontWeight={800}
        fill={style.ink}
        fontFamily="var(--font-display)"
      >
        {part.label}
      </text>
      {part.type === "pir" && <circle cx={px(box.x + box.w / 2)} cy={px(box.y + box.h / 2) + (above ? 4 : -4)} r={15} fill="#f1f4f6" stroke="#b9c3ca" strokeWidth={1.5} />}
      {def.pins.map((pin) => {
        const at = modulePinXY(part, pin.id);
        return (
          <g key={pin.id}>
            <rect x={px(at.x) - 15} y={px(at.y) + (above ? -21 : 5)} width={30} height={16} rx={5} fill="#f4ecd7" />
            <text x={px(at.x)} y={px(at.y) + (above ? -9.5 : 16.5)} textAnchor="middle" fontSize={9} fontWeight={800} fill="#0b2d45" fontFamily="var(--font-mono)">
              {pin.label}
            </text>
            <rect x={px(at.x) - 4} y={px(at.y) - 4} width={8} height={8} rx={2} fill={INK.pad} stroke="#8a6d22" strokeWidth={1} />
          </g>
        );
      })}
    </g>
  );
}

/* ── Cables ───────────────────────────────────────────────────── */

function wirePath(a: XY, b: XY, index: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  // Comba perpendicular: separa cables paralelos y deja ver los agujeros.
  const sag = Math.min(2.4, 0.5 + length * 0.11) * (index % 2 ? 1 : -1);
  const mx = (a.x + b.x) / 2 - (dy / length) * sag;
  const my = (a.y + b.y) / 2 + (dx / length) * sag;
  return `M${px(a.x)} ${px(a.y)}Q${px(mx)} ${px(my)} ${px(b.x)} ${px(b.y)}`;
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
      <path d={d} fill="none" stroke="#04121d" strokeWidth={width + 3} strokeLinecap="round" opacity={0.55} />
      <path d={d} fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" />
      <path d={d} fill="none" stroke="#ffffff" strokeWidth={1.4} strokeLinecap="round" opacity={0.32} />
      {state === "active" && (
        <path d={d} fill="none" stroke="#ffffff" strokeWidth={2.4} strokeLinecap="round" strokeDasharray="5 19" className="animate-dash" opacity={0.95} />
      )}
      {[a, b].map((end, key) => (
        <circle key={key} cx={px(end.x)} cy={px(end.y)} r={4.6} fill={color} stroke="#04121d" strokeWidth={1.4} />
      ))}
    </g>
  );
}

/* ── Rótulos del paso actual ──────────────────────────────────── */

function Callout({ at, text, sub, side }: { at: XY; text: string; sub?: string; side: -1 | 1 }) {
  const width = Math.max(40, Math.max(text.length * 9.4, (sub?.length ?? 0) * 6.4) + 18);
  const height = sub ? 36 : 24;
  const x = px(at.x);
  const y = px(at.y) + side * 46 - height / 2;
  return (
    <g className="pointer-events-none">
      <line x1={x} y1={px(at.y) + side * 12} x2={x} y2={y + (side > 0 ? 0 : height)} stroke="#f4ecd7" strokeWidth={1.8} />
      <circle cx={x} cy={px(at.y)} r={11} fill="none" stroke="#f4ecd7" strokeWidth={2.4} />
      <circle cx={x} cy={px(at.y)} r={11} fill="none" stroke="#f4ecd7" strokeWidth={2} className="animate-pulse-ring" style={{ transformOrigin: `${x}px ${px(at.y)}px` }} />
      <rect x={x - width / 2} y={y} width={width} height={height} rx={8} fill="#f4ecd7" stroke="#0b2d45" strokeWidth={1.5} />
      <text x={x} y={y + 16.5} textAnchor="middle" fontSize={14} fontWeight={800} fill="#0b2d45" fontFamily="var(--font-mono)">
        {text}
      </text>
      {sub && (
        <text x={x} y={y + 29} textAnchor="middle" fontSize={9.5} fontWeight={700} fill="#1e5b7f" fontFamily="var(--font-body)">
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

export function BreadboardView({
  circuit,
  stepIndex,
  complete = false,
  lit,
  className,
  description,
}: BreadboardViewProps) {
  const container = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(2.2);
  const [follow, setFollow] = useState(true);
  const [inspect, setInspect] = useState<Inspect | null>(null);
  const [hoverStrip, setHoverStrip] = useState<string | null>(null);

  const stepOf = useMemo(() => {
    const map = new Map<string, number>();
    circuit.steps.forEach((step, index) => {
      for (const id of [...(step.parts ?? []), ...(step.wires ?? [])]) map.set(id, index);
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
  const usedPins = useMemo(() => {
    const physical = new Set<number>();
    const touch = (endpoint: string) => {
      if (!isPoint(endpoint)) return;
      const pin = picoPinForStrip(stripOf(endpoint));
      if (pin) physical.add(pin.physical);
    };
    for (const wire of circuit.wires) {
      touch(wire.from);
      touch(wire.to);
    }
    return physical;
  }, [circuit]);

  /** Puntos que el paso actual pide mirar. */
  const focus = useMemo(() => {
    if (!step) return [] as { at: XY; id: string; note?: string }[];
    const points: { at: XY; id: string; note?: string }[] = [];
    for (const id of step.wires ?? []) {
      const wire = circuit.wires.find((candidate) => candidate.id === id);
      if (!wire) continue;
      for (const end of [wire.from, wire.to]) points.push({ at: endpointXY(circuit, end), id: end });
    }
    for (const id of step.parts ?? []) {
      const part = circuit.parts.find((candidate) => candidate.id === id);
      if (!part) continue;
      if (part.holes)
        for (const [pinId, hole] of Object.entries(part.holes)) {
          const pin = partDef(part).pins.find((candidate) => candidate.id === pinId);
          // Solo se rotula el terminal cuando importa cuál es (polaridad, VCC, señal).
          const named = pin && pin.role !== "passive" ? pin.label : pin?.aka?.[0];
          points.push({ at: pointXY(hole), id: hole, note: named });
        }
      else {
        const box = moduleBox(part);
        points.push({ at: { x: box.x, y: box.y }, id: "" }, { at: { x: box.x + box.w, y: box.y + box.h }, id: "" });
      }
    }
    for (const hole of step.focus ?? []) points.push({ at: pointXY(hole), id: hole });
    return points;
  }, [circuit, step]);

  const whole = useMemo<Box>(() => {
    const modules = circuit.parts.filter((part) => !part.holes && stateOf(part.id) !== "hidden");
    const from = circuit.view?.from ?? 1;
    const to = circuit.view?.to ?? COLUMNS;
    const points: XY[] = [
      { x: BOARD.x0 + from - 3.4, y: -1.9 },
      { x: BOARD.x0 + to + 1.6, y: 19 },
    ];
    for (const part of modules) {
      const box = moduleBox(part);
      points.push({ x: box.x - 0.6, y: box.y - 0.8 }, { x: box.x + box.w + 0.6, y: box.y + box.h + 0.8 });
    }
    for (const part of circuit.parts)
      if (part.holes && stateOf(part.id) !== "hidden")
        for (const hole of Object.values(part.holes)) {
          const at = pointXY(hole);
          points.push({ x: at.x + 9, y: at.y + (at.y > 8.5 ? 6.5 : -1) });
        }
    return boundsOf(points, 0.4);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit, current, complete]);

  const target = useMemo<Box>(() => {
    if (!follow || !focus.length) return fit(whole, aspect, 30);
    // Se encuadra a lo ancho; el alto siempre muestra la protoboard completa (y los módulos
    // del montaje), para no perder la orientación entre un paso y el siguiente.
    const box = boundsOf(
      [...focus.map((point) => point.at), { x: focus[0].at.x, y: whole.y }, { x: focus[0].at.x, y: whole.y + whole.h }],
      0,
    );
    const framed = fit({ x: box.x - 4, y: box.y, w: box.w + 8, h: box.h }, aspect, 0);
    // Sin salirse del montaje por los lados.
    const min = whole.x - 1;
    const max = whole.x + whole.w + 1;
    if (framed.w >= max - min) return fit(whole, aspect, 30);
    return { ...framed, x: Math.min(Math.max(framed.x, min), max - framed.w) };
  }, [follow, focus, whole, aspect]);

  const [view, setView] = useState<Box>(target);
  const viewRef = useRef(view);
  viewRef.current = view;
  const manual = useRef(false);
  useEffect(() => {
    manual.current = false;
    const from = viewRef.current;
    const started = performance.now();
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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
  }, [target.x, target.y, target.w, target.h]);

  useLayoutEffect(() => {
    const element = container.current;
    if (!element) return;
    const measure = () => {
      const { width, height } = element.getBoundingClientRect();
      if (width > 0 && height > 0) setAspect(width / height);
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
      return { x: cx - ((cx - box.x) * w) / box.w, y: cy - ((cy - box.y) * h) / box.h, w, h };
    });
  }, []);

  /* Arrastrar para mover, pellizcar para acercar. */
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const moved = useRef(false);
  const onPointerDown = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
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
      if (!moved.current) event.currentTarget.setPointerCapture(event.pointerId);
      moved.current = true;
      setFollow(false);
      setView((box) => ({ ...box, x: box.x - dx * scale, y: box.y - dy * scale }));
    } else if (pointers.current.size === 2) {
      const other = [...pointers.current.entries()].find(([id]) => id !== event.pointerId)![1];
      const before = Math.hypot(previous.x - other.x, previous.y - other.y);
      const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
      if (before > 0 && after > 0) zoom(before / after);
      moved.current = true;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
  };
  const onPointerUp = (event: ReactPointerEvent<SVGSVGElement>) => {
    pointers.current.delete(event.pointerId);
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
        ...(STATION_ROLE[pin.name] ? [`En la estación: ${STATION_ROLE[pin.name]}.`] : []),
      ],
      warning: pin.warning,
    });
  }, []);

  const inspectHole = (id: string) => {
    const strip = stripOf(id);
    const point = parsePoint(id);
    const pin = picoPinForStrip(strip);
    const here: string[] = [];
    for (const part of circuit.parts) {
      if (stateOf(part.id) === "hidden") continue;
      for (const [pinId, hole] of Object.entries(part.holes ?? {}))
        if (stripOf(hole) === strip)
          here.push(`${part.label} (${partDef(part).pins.find((p) => p.id === pinId)?.label ?? pinId})`);
    }
    for (const wire of circuit.wires) {
      if (stateOf(wire.id) === "hidden") continue;
      for (const end of [wire.from, wire.to])
        if (isPoint(end) && stripOf(end) === strip) here.push(`cable ${wire.color} (${wire.carries})`);
    }
    setInspect(
      point.kind === "rail"
        ? {
            title: `${RAIL_INFO[point.rail].label}`,
            lines: [
              "Todos los agujeros de esta línea están unidos entre sí.",
              RAIL_INFO[point.rail].sign === "+"
                ? "En el taller, los rieles rojos llevan 3,3 V."
                : "En el taller, los rieles azules son GND (0 V).",
              ...(here.length ? [`Aquí llegan: ${[...new Set(here)].join(", ")}.`] : []),
            ],
          }
        : {
            title: `Agujero ${id}`,
            lines: [
              `Está unido por dentro con ${holesOfStrip(strip)
                .filter((hole) => hole !== id)
                .join(", ")}.`,
              ...(pin ? [`Esta tira es el pin ${pin.name} (pin ${pin.physical}) de la Pico.`] : []),
              ...(here.length ? [`Aquí están: ${[...new Set(here)].join(", ")}.`] : ["Está libre."]),
            ],
            warning: pin?.warning,
          },
    );
  };

  const onClick = (event: ReactMouseEvent<SVGSVGElement>) => {
    if (moved.current) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const box = viewRef.current;
    const x = (box.x + ((event.clientX - rect.left) / rect.width) * box.w);
    const y = (box.y + ((event.clientY - rect.top) / rect.height) * box.h);
    const hole = nearestHole(x, y);
    if (hole) inspectHole(hole);
    else setInspect(null);
  };
  const onHover = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (pointers.current.size) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const box = viewRef.current;
    const hole = nearestHole(
      box.x + ((event.clientX - rect.left) / rect.width) * box.w,
      box.y + ((event.clientY - rect.top) / rect.height) * box.h,
    );
    setHoverStrip(hole ? stripOf(hole) : null);
  };

  const callouts = useMemo(() => {
    const seen = new Set<string>();
    return focus
      .filter((point) => point.id && !seen.has(point.id) && seen.add(point.id))
      .map((point, index, all) => {
        const isHole = isPoint(point.id);
        const pin = isHole ? picoPinForStrip(stripOf(point.id)) : undefined;
        const part = !isHole ? circuit.parts.find((candidate) => candidate.id === point.id.split(".")[0]) : undefined;
        const label = isHole
          ? shortPoint(point.id)
          : (partDef(part!).pins.find((candidate) => candidate.id === point.id.split(".")[1])?.label ?? "");
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
        return { ...point, label, sub: pin ? pin.name : point.note, side, skip: !isHole };
      })
      .filter((callout) => !callout.skip);
  }, [focus, circuit]);

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
        aria-label={description ?? `Diagrama de la protoboard: ${circuit.title}`}
        viewBox={`${px(view.x)} ${px(view.y)} ${px(view.w)} ${px(view.h)}`}
        className="h-full w-full cursor-grab active:cursor-grabbing"
        preserveAspectRatio="xMidYMid meet"
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
        <BoardLayer />
        {hoverStrip &&
          holesOfStrip(hoverStrip).map((hole) => {
            const at = pointXY(hole);
            return <circle key={hole} cx={px(at.x)} cy={px(at.y)} r={8.5} fill="#6fb3d9" opacity={0.42} className="pointer-events-none" />;
          })}
        <PicoLayer used={usedPins} onInspect={inspectPin} />
        {parts
          .filter((entry) => entry.part.holes)
          .map(({ part, state }) => (
            <g key={part.id} opacity={state === "done" ? 0.72 : 1} className="pointer-events-none">
              <PartShape part={part} lit={lit?.[part.id]} />
            </g>
          ))}
        <g className="pointer-events-none">
          {wires
            .filter((entry) => entry.state === "done")
            .map(({ wire, index }) => (
              <WireShape key={wire.id} wire={wire} index={index} state="done" a={endpointXY(circuit, wire.from)} b={endpointXY(circuit, wire.to)} />
            ))}
          {parts
            .filter((entry) => !entry.part.holes)
            .map(({ part, state }) => (
              <g key={part.id} opacity={state === "done" ? 0.8 : 1}>
                <ModuleCard part={part} active={state === "active"} />
              </g>
            ))}
          {wires
            .filter((entry) => entry.state === "active")
            .map(({ wire, index }) => (
              <WireShape key={wire.id} wire={wire} index={index} state="active" a={endpointXY(circuit, wire.from)} b={endpointXY(circuit, wire.to)} />
            ))}
          {callouts.map((callout) => (
            <Callout key={callout.id} at={callout.at} text={callout.label} sub={callout.sub} side={callout.side} />
          ))}
        </g>
      </svg>

      <div className="absolute right-2.5 top-2.5 flex flex-col gap-1.5">
        <IconButton icon="zoomIn" label="Acercar" size="sm" tone="dark" onClick={() => zoom(0.8)} />
        <IconButton icon="zoomOut" label="Alejar" size="sm" tone="dark" onClick={() => zoom(1.25)} />
        <IconButton
          icon="expand"
          label="Ver todo el montaje"
          size="sm"
          tone="dark"
          onClick={() => {
            setFollow(false);
            setView(fit(whole, aspect, 30));
          }}
        />
        {!complete && (
          <IconButton
            icon="target"
            label={follow ? "Siguiendo el paso actual" : "Volver al paso actual"}
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

      {inspect ? (
        <div className="absolute inset-x-2.5 bottom-2.5 flex animate-rise items-start gap-3 rounded-md bg-cream p-3 text-primary shadow-lifted sm:right-auto sm:max-w-sm">
          <div className="min-w-0 flex-1">
            <p className="font-display text-sm font-extrabold">{inspect.title}</p>
            {inspect.lines.map((line) => (
              <p key={line} className="mt-0.5 text-[13px] font-semibold leading-[18px] text-secondary">
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
            onClick={() => setInspect(null)}
            className="focus-ring -m-1 flex size-8 shrink-0 items-center justify-center rounded-sm text-secondary hover:bg-cream-shade"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : (
        <p className="pointer-events-none absolute bottom-2.5 left-2.5 hidden items-center gap-1.5 rounded-pill bg-primary-deep/85 px-3 py-1.5 text-xs font-bold text-accent-soft sm:flex">
          <Icon name="tap" size={14} />
          Toca un agujero o un pin para saber qué es. Arrastra para mover.
        </p>
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
    if (Math.abs(y - railY(rail)) <= 0.46 && RAIL_COLUMNS.includes(column)) return `${rail}:${column}`;
  return null;
}

/** Texto de las bandas para la ficha de una resistencia. */
export const bandsText = (ohms: number) => resistorBandNames(ohms);
