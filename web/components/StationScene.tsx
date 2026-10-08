import {
  Component,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { RotateCcw, Move, ZoomIn } from "lucide-react";

export interface StationSceneProps {
  variant?: "hero" | "wiring";
  sensor?: string;
  activeStep?: number;
  onSelect?: (label: string) => void;
  board?: "pico" | "uno";
  view?: "3d" | "2d";
}
type V3 = [number, number, number];
const clay = "#be7658",
  olive = "#687a42",
  gold = "#b99144",
  cream = "#f6f3e9";
const pins = [
  "GP0",
  "GP1",
  "GND",
  "GP2",
  "GP3",
  "GP4",
  "GP5",
  "GND",
  "GP6",
  "GP7",
  "GP8",
  "GP9",
  "GND",
  "GP10",
  "GP11",
  "GP12",
  "GP13",
  "GND",
  "GP14",
  "GP15",
  "GP16",
  "GP17",
  "GND",
  "GP18",
  "GP19",
  "GP20",
  "GP21",
  "GND",
  "GP22",
  "RUN",
  "GP26",
  "GP27",
  "AGND",
  "GP28",
  "ADC_VREF",
  "3V3",
  "3V3_EN",
  "GND",
  "VSYS",
  "VBUS",
];
const connections: Record<
  string,
  {
    name: string;
    signal: string;
    physical: number;
    arduino: string;
    supply?: string;
    extra?: string;
  }
> = {
  soil: {
    name: "Sonda capacitiva v1.2",
    signal: "GP26 / ADC0",
    physical: 31,
    arduino: "A0",
  },
  soil_temperature: {
    name: "DS18B20",
    signal: "GP16 · DATA",
    physical: 21,
    arduino: "D5",
    extra: "DATA → 2×10 kΩ en paralelo → 3V3",
  },
  ds18b20: {
    name: "DS18B20",
    signal: "GP16 · DATA",
    physical: 21,
    arduino: "D5",
    extra: "DATA → 2×10 kΩ en paralelo → 3V3",
  },
  air_temperature: {
    name: "DHT11",
    signal: "GP15 · DATA",
    physical: 20,
    arduino: "D4",
    extra: "DATA → 10 kΩ → 3V3 si no trae pull-up",
  },
  air_humidity: {
    name: "DHT11",
    signal: "GP15 · DATA",
    physical: 20,
    arduino: "D4",
    extra: "DATA → 10 kΩ → 3V3 si no trae pull-up",
  },
  dht11: {
    name: "DHT11",
    signal: "GP15 · DATA",
    physical: 20,
    arduino: "D4",
    extra: "DATA → 10 kΩ → 3V3 si no trae pull-up",
  },
  light: {
    name: "Fotoresistor 5549",
    signal: "GP27 / ADC1",
    physical: 32,
    arduino: "A1",
    extra: "3V3 → LDR → nodo → 10 kΩ → GND",
  },
  ldr: {
    name: "Fotoresistor 5549",
    signal: "GP27 / ADC1",
    physical: 32,
    arduino: "A1",
    extra: "3V3 → LDR → nodo → 10 kΩ → GND",
  },
  rain: {
    name: "FC-37 + LM393",
    signal: "GP14 · DO",
    physical: 19,
    arduino: "D6",
  },
  water_level: {
    name: "Water Level Sensor",
    signal: "GP28 / ADC2",
    physical: 34,
    arduino: "A2",
  },
  distance: {
    name: "HC-SR04",
    signal: "GP17 · TRIG",
    physical: 22,
    arduino: "D7",
    supply: "VBUS · 5 V",
    extra: "ECHO → 2 kΩ → nodo GP18/pin 24 → 3 kΩ → GND",
  },
  motion: {
    name: "HC-SR501",
    signal: "GP19 · OUT",
    physical: 25,
    arduino: "D9",
    supply: "VBUS · 5 V",
    extra: "OUT normalmente 3.3 V. Verifica tu modelo.",
  },
  led: {
    name: "LED + 220 Ω",
    signal: "GP2",
    physical: 4,
    arduino: "D2",
    extra: "GPIO → 220 Ω → ánodo; cátodo → GND",
  },
  lm35: {
    name: "LM35",
    signal: "GP26 / ADC0",
    physical: 31,
    arduino: "A0",
    supply: "VBUS · 5 V",
    extra: "Retira la sonda de suelo: comparten ADC.",
  },
  button: {
    name: "Pulsador",
    signal: "GP4 · PULL_UP",
    physical: 6,
    arduino: "D4",
    extra: "GPIO → contacto → GND; entrada PULL_UP",
  },
  buzzer: {
    name: "Piezo pasivo",
    signal: "GP3 · PWM",
    physical: 5,
    arduino: "D3",
    extra: "GPIO → 220 Ω → piezo pasivo; retorno GND",
  },
  potentiometer: {
    name: "Potenciómetro 10 kΩ",
    signal: "GP26 / ADC0",
    physical: 31,
    arduino: "A0",
    extra: "Extremos a 3V3/GND; cursor al ADC.",
  },
  shift_register: {
    name: "74HC595",
    signal: "GP5 · DS",
    physical: 7,
    arduino: "D5",
    extra: "GP6 → SHCP; GP7 → STCP. Ver guía de 16 pines.",
  },
  flame: {
    name: "Sensor óptico de llama",
    signal: "GP12 · DO",
    physical: 16,
    arduino: "D12",
  },
  infrared: {
    name: "Receptor IR",
    signal: "GP13 · OUT",
    physical: 17,
    arduino: "D11",
  },
  active_buzzer: {
    name: "Buzzer activo + ULN2003",
    signal: "GP3 · IN1",
    physical: 5,
    arduino: "D3",
    supply: "VBUS · 5 V",
    extra: "Buzzer(−) a OUT1; IN1 a GPIO; GND común.",
  },
  seven_segment: {
    name: "Display 7 segmentos",
    signal: "GP5 · segmento A",
    physical: 7,
    arduino: "D5",
    extra: "A–G a GP5–GP11. COM a GP12 por 1 kΩ; un LED por vez.",
  },
  four_digit: {
    name: "Display 4 dígitos",
    signal: "GP5 · segmento A",
    physical: 7,
    arduino: "D5",
    extra: "D1–D4 a GP12–15, 1 kΩ por común. Un LED por vez.",
  },
  matrix: {
    name: "Matriz 8×8 sin driver",
    signal: "GP0 · fila 1",
    physical: 1,
    arduino: "D2",
    extra: "Filas GP0–7 con resistencias; columnas GP8–15. Un píxel por vez.",
  },
  lcd: {
    name: "LCD 16×2 paralelo",
    signal: "GP5 · RS",
    physical: 7,
    arduino: "D5",
    supply: "VBUS · 5 V",
    extra: "RW a GND. RS GP5, E GP6, D4–D7 GP7–10. No módulo I2C.",
  },
  stepper: {
    name: "Motor + ULN2003",
    signal: "GP20 · IN1",
    physical: 26,
    arduino: "D4",
    supply: "VBUS · 5 V",
    extra: "Motor nunca directo a GPIO. Verifica consumo y presupuesto USB.",
  },
  servo: {
    name: "SG90 · señal PWM",
    signal: "GP20 · PWM",
    physical: 26,
    arduino: "D10",
    extra: "VCC del SG90 desconectado con el kit actual; señal a LED + 1 kΩ.",
  },
};
const select =
  (fn: StationSceneProps["onSelect"], label: string) =>
  (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    fn?.(label);
  };
function Label({
  position,
  title,
  detail,
  side = "left",
}: {
  position: V3;
  title: string;
  detail: string;
  side?: string;
}) {
  const small = useThree((state) => state.size.width < 480);
  return (
    <Html
      position={position}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div
        className="scene-label"
        style={{
          whiteSpace: "nowrap",
          padding: small ? "6px 8px" : "8px 11px",
          borderRadius: 9,
          background: "rgba(255,253,247,.94)",
          border: "1px solid #dedfd0",
          boxShadow: "0 6px 25px #223c1d0a",
          color: "#253827",
          fontFamily: "inherit",
          fontSize: small ? 9 : 11,
          transform:
            side === "right" && !small ? "translateX(12px)" : undefined,
        }}
      >
        <span
          style={{ display: "block", fontWeight: 650, letterSpacing: "-.02em" }}
        >
          {title}
        </span>
        <span
          style={{
            display: "block",
            color: "#6f7562",
            fontSize: small ? 7 : 9,
            marginTop: 3,
          }}
        >
          {detail}
        </span>
      </div>
    </Html>
  );
}

function Wire({
  points,
  color,
  active = true,
}: {
  points: V3[];
  color: string;
  active?: boolean;
}) {
  const geometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        42,
        active ? 0.014 : 0.009,
        7,
        false,
      ),
    [points, active],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        color={color}
        transparent={!active}
        opacity={active ? 1 : 0.23}
        roughness={0.6}
      />
    </mesh>
  );
}
function Stem({
  points,
  radius = 0.023,
  color = "#667448",
}: {
  points: V3[];
  radius?: number;
  color?: string;
}) {
  const geometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))),
        22,
        radius,
        6,
        false,
      ),
    [points, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial color={color} roughness={0.94} />
    </mesh>
  );
}
function Leaf({
  position,
  rotation,
  length,
  width,
  color,
}: {
  position: V3;
  rotation: V3;
  length: number;
  width: number;
  color: string;
}) {
  const geometry = useMemo(() => {
    const vertices: number[] = [],
      indices: number[] = [],
      rows = 18,
      cols = 8;
    for (let i = 0; i <= rows; i++)
      for (let j = 0; j <= cols; j++) {
        const t = i / rows,
          u = (j / cols) * 2 - 1;
        vertices.push(
          u * width * Math.pow(Math.sin(Math.PI * t), 0.76),
          length * t,
          Math.sin(Math.PI * t) * 0.13 -
            Math.abs(u) * 0.1 * Math.sin(Math.PI * t),
        );
      }
    for (let i = 0; i < rows; i++)
      for (let j = 0; j < cols; j++) {
        const a = i * (cols + 1) + j;
        indices.push(a, a + 1, a + cols + 1, a + 1, a + cols + 2, a + cols + 1);
      }
    const result = new THREE.BufferGeometry();
    result.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, [length, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry} castShadow>
        <meshStandardMaterial
          color={color}
          roughness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>
      <Stem
        points={[
          [0, 0, 0.003],
          [0, length * 0.45, 0.13],
          [0, length * 0.97, 0.009],
        ]}
        radius={0.006}
        color="#a1a66d"
      />
    </group>
  );
}

function Plant({
  onSelect,
  board = "pico",
}: {
  onSelect?: StationSceneProps["onSelect"];
  board?: "pico" | "uno";
}) {
  const potGeometry = useMemo(
    () =>
      new THREE.LatheGeometry(
        [
          new THREE.Vector2(0.45, 0.05),
          new THREE.Vector2(0.48, 0.07),
          new THREE.Vector2(0.69, 1.05),
          new THREE.Vector2(0.73, 1.07),
          new THREE.Vector2(0.73, 1.19),
          new THREE.Vector2(0.65, 1.19),
          new THREE.Vector2(0.64, 1.04),
          new THREE.Vector2(0.43, 0.08),
        ],
        64,
      ),
    [],
  );
  useEffect(() => () => potGeometry.dispose(), [potGeometry]);
  const leaves = [
    [0, 1.5, 0, 0.3, 0, -1.08, 1.0, 0.34],
    [0, 1.72, 0, -0.3, 2.8, -1.02, 0.97, 0.34],
    [0, 1.94, 0, 0.4, 1.8, -0.9, 1.03, 0.32],
    [0, 2.16, 0, 0.2, -0.4, -0.75, 0.92, 0.29],
    [0, 2.4, 0, -0.2, 2.2, -0.65, 0.72, 0.24],
    [-0.12, 1.46, 0.09, -0.1, 2.2, -1.12, 0.94, 0.33],
    [0.08, 1.65, -0.06, 0.5, -1.3, -1.04, 1.05, 0.34],
    [0.08, 1.88, -0.07, 0.2, 1.1, -0.95, 0.94, 0.29],
    [-0.06, 2.06, 0.03, -0.25, 3, -0.98, 0.84, 0.3],
    [0, 2.57, 0, 0.1, 0.8, -0.42, 0.73, 0.22],
    [-0.06, 1.32, 0.13, 0.4, 0.1, -1.12, 0.94, 0.34],
    [0.07, 1.82, 0.06, 0.5, 2.6, -1.02, 0.77, 0.3],
    [0, 2.32, 0, -0.5, -1.2, -0.89, 0.83, 0.27],
  ];
  return (
    <group
      position={[-0.92, 0, -0.2]}
      onClick={select(
        onSelect,
        "Planta viva · solo la sonda entra en la tierra",
      )}
    >
      <mesh geometry={potGeometry} castShadow receiveShadow>
        <meshStandardMaterial color={clay} roughness={0.96} />
      </mesh>
      <mesh
        position={[0, 1.12, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <circleGeometry args={[0.642, 64]} />
        <meshStandardMaterial color="#493e2c" roughness={1} />
      </mesh>
      <mesh position={[0, 1.185, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <torusGeometry args={[0.69, 0.043, 10, 64]} />
        <meshStandardMaterial color="#d18b68" roughness={0.96} />
      </mesh>
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.67, 0.68, 0.1, 56]} />
        <meshStandardMaterial color="#c98a67" roughness={1} />
      </mesh>
      {Array.from({ length: 28 }, (_, i) => (
        <mesh
          key={i}
          position={[
            Math.sin(i * 2.4) * (0.16 + (i % 5) * 0.08),
            1.126,
            Math.cos(i * 2.4) * (0.16 + (i % 5) * 0.08),
          ]}
          rotation={[i, i * 0.7, i * 0.4]}
        >
          <dodecahedronGeometry args={[0.019 + (i % 3) * 0.008, 0]} />
          <meshStandardMaterial
            color={i % 2 ? "#807359" : "#a79d7b"}
            roughness={1}
          />
        </mesh>
      ))}
      <Stem
        points={[
          [0, 1.1, 0],
          [-0.07, 1.68, 0.06],
          [0.02, 2.21, -0.025],
          [0, 2.77, 0],
        ]}
        radius={0.026}
      />
      <Stem
        points={[
          [0, 1.16, 0],
          [0.2, 1.55, -0.11],
          [0.28, 2.2, -0.13],
        ]}
        radius={0.014}
      />
      {leaves.map((l, i) => (
        <Leaf
          key={i}
          position={[l[0], l[1], l[2]]}
          rotation={[l[3], l[4], l[5]]}
          length={l[6]}
          width={l[7]}
          color={i % 3 === 0 ? "#7f8a50" : i % 3 === 1 ? "#546a3a" : "#697e48"}
        />
      ))}
      <group
        position={[0.41, 1.12, 0.18]}
        rotation={[0, -0.2, -0.15]}
        onClick={select(
          onSelect,
          board === "pico"
            ? "Sonda capacitiva · AOUT a GP26, pin físico 31"
            : "Sonda capacitiva · AOUT a A0, Arduino Uno/Nano",
        )}
      >
        <mesh position={[0, -0.19, 0]} castShadow>
          <boxGeometry args={[0.15, 0.58, 0.025]} />
          <meshStandardMaterial color="#292c28" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.16, 0]} castShadow>
          <boxGeometry args={[0.22, 0.22, 0.04]} />
          <meshStandardMaterial color="#363b2d" roughness={0.86} />
        </mesh>
        {[0, 1, 2, 3, 4].map((i) => (
          <mesh key={i} position={[0, -0.42 + i * 0.073, 0.014]}>
            <boxGeometry args={[0.11, 0.012, 0.002]} />
            <meshStandardMaterial color="#a79857" />
          </mesh>
        ))}
        <mesh position={[0, 0.17, 0.025]}>
          <boxGeometry args={[0.09, 0.055, 0.027]} />
          <meshStandardMaterial color="#1f2920" />
        </mesh>
      </group>
    </group>
  );
}

const boardOrigin: V3 = [1.13, 0.27, 0.75];
function pinPosition(physical: number): V3 {
  const i = physical <= 20 ? physical - 1 : 40 - physical;
  return [
    boardOrigin[0] + (physical <= 20 ? -0.29 : 0.29),
    0.36,
    boardOrigin[2] - 0.66 + i * 0.0695,
  ];
}
function arduinoPosition(label: string): V3 {
  const digital = /^D(\d+)$/.exec(label),
    analog = /^A(\d+)$/.exec(label);
  if (digital)
    return [
      boardOrigin[0] + 0.43,
      0.36,
      boardOrigin[2] - 0.64 + (13 - Number(digital[1])) * 0.084,
    ];
  if (analog)
    return [
      boardOrigin[0] - 0.43,
      0.36,
      boardOrigin[2] + 0.22 + Number(analog[1]) * 0.084,
    ];
  return [
    boardOrigin[0] - 0.43,
    0.36,
    boardOrigin[2] + (label === "3V3" ? -0.43 : label === "5V" ? -0.35 : -0.25),
  ];
}
function Breadboard({
  board,
  onSelect,
  activePin,
  activeArduino,
}: {
  board: "pico" | "uno";
  onSelect?: StationSceneProps["onSelect"];
  activePin: number;
  activeArduino: string;
}) {
  return (
    <group position={[1.13, 0.15, 0.75]}>
      <mesh
        castShadow
        receiveShadow
        onClick={select(
          onSelect,
          "Protoboard · cada fila de cinco agujeros comparte conexión",
        )}
      >
        <boxGeometry args={[1.57, 0.19, 2.4]} />
        <meshStandardMaterial color="#eeeadd" roughness={0.88} />
      </mesh>
      <mesh position={[0, 0.099, 0]}>
        <boxGeometry args={[0.09, 0.008, 2.25]} />
        <meshStandardMaterial color="#d7d3c6" />
      </mesh>
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * 0.69, 0.1, 0]}>
            <boxGeometry args={[0.012, 0.006, 2.19]} />
            <meshStandardMaterial color={side === 1 ? "#bb6d56" : "#718e97"} />
          </mesh>
          {Array.from({ length: 29 }, (_, row) =>
            Array.from({ length: 5 }, (_, col) => (
              <mesh
                key={`${row}-${col}`}
                position={[
                  side * (0.1 + col * 0.1),
                  0.105,
                  -0.99 + row * 0.0707,
                ]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <circleGeometry args={[0.017, 6]} />
                <meshStandardMaterial color="#969c90" roughness={1} />
              </mesh>
            )),
          )}
          {Array.from({ length: 29 }, (_, i) => (
            <mesh
              key={i}
              position={[side * 0.64, 0.105, -0.99 + i * 0.0707]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[0.013, 6]} />
              <meshStandardMaterial color="#999e90" />
            </mesh>
          ))}
        </group>
      ))}
      <group
        position={[0, 0.135, 0]}
        onClick={select(
          onSelect,
          board === "pico"
            ? "Raspberry Pi Pico W · RP2040, Wi-Fi 2.4 GHz, GPIO 3.3 V"
            : "Arduino Uno/Nano · GPIO 5 V, telemetría por USB",
        )}
      >
        <mesh castShadow>
          <boxGeometry
            args={[
              board === "pico" ? 0.55 : 0.89,
              0.047,
              board === "pico" ? 1.42 : 1.65,
            ]}
          />
          <meshStandardMaterial
            color={board === "pico" ? "#548366" : "#397b88"}
            roughness={0.68}
            metalness={0.1}
          />
        </mesh>
        <mesh position={[0, 0.05, -0.12]} castShadow>
          <boxGeometry args={[0.22, 0.061, 0.22]} />
          <meshStandardMaterial color="#252e2b" roughness={0.76} />
        </mesh>
        <mesh position={[0.012, 0.058, 0.37]} castShadow>
          <boxGeometry args={[0.38, 0.053, 0.3]} />
          <meshStandardMaterial
            color="#b6bbae"
            roughness={0.4}
            metalness={0.7}
          />
        </mesh>
        <mesh position={[0, 0.067, -0.67]} castShadow>
          <boxGeometry args={[0.22, 0.08, 0.2]} />
          <meshStandardMaterial
            color="#adb7b1"
            metalness={0.9}
            roughness={0.33}
          />
        </mesh>
        <mesh position={[-0.14, 0.06, -0.41]}>
          <boxGeometry args={[0.081, 0.051, 0.068]} />
          <meshStandardMaterial color="#ede6c9" />
        </mesh>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <mesh
            key={i}
            position={[i % 2 ? -0.18 : 0.18, 0.041, -0.39 + i * 0.11]}
          >
            <boxGeometry args={[0.027, 0.017, 0.041]} />
            <meshStandardMaterial color={i % 3 ? "#dfd8bc" : "#242b25"} />
          </mesh>
        ))}
        {board === "pico" &&
          pins.map((name, i) => {
            const physical = i + 1,
              row = i < 20 ? i : 39 - i;
            return (
              <mesh
                key={i}
                position={[
                  i < 20 ? -0.287 : 0.287,
                  0.024,
                  -0.66 + row * 0.0695,
                ]}
                onClick={select(
                  onSelect,
                  `${name} · pin físico ${physical}${name.startsWith("GP") ? " · lógica 3.3 V" : ""}`,
                )}
              >
                <boxGeometry args={[0.06, 0.037, 0.036]} />
                <meshStandardMaterial
                  color={physical === activePin ? "#e5ad45" : "#d2b976"}
                  roughness={0.32}
                  metalness={0.66}
                  emissive={physical === activePin ? "#765711" : "#000"}
                  emissiveIntensity={0.15}
                />
              </mesh>
            );
          })}
        {board === "uno" && (
          <>
            {[-1, 1].map((s) => (
              <mesh key={s} position={[s * 0.43, 0.024, 0]}>
                <boxGeometry args={[0.085, 0.08, 1.47]} />
                <meshStandardMaterial color="#252e2b" />
              </mesh>
            ))}
            {Array.from({ length: 14 }, (_, n) => (
              <mesh
                key={`D${n}`}
                position={[0.43, 0.071, -0.64 + (13 - n) * 0.084]}
                onClick={select(
                  onSelect,
                  `D${n} · Arduino Uno/Nano AVR · lógica 5 V`,
                )}
              >
                <boxGeometry args={[0.05, 0.006, 0.037]} />
                <meshStandardMaterial
                  color={activeArduino === `D${n}` ? "#e0b357" : "#a6aa91"}
                />
              </mesh>
            ))}
            {Array.from({ length: 6 }, (_, n) => (
              <mesh
                key={`A${n}`}
                position={[-0.43, 0.071, 0.22 + n * 0.084]}
                onClick={select(
                  onSelect,
                  `A${n} · Arduino Uno/Nano · entrada analógica`,
                )}
              >
                <boxGeometry args={[0.05, 0.006, 0.037]} />
                <meshStandardMaterial
                  color={activeArduino === `A${n}` ? "#e0b357" : "#a6aa91"}
                />
              </mesh>
            ))}
            {["3V3", "5V", "GND"].map((label, n) => (
              <mesh
                key={label}
                position={[-0.43, 0.071, -0.43 + n * 0.09]}
                onClick={select(
                  onSelect,
                  `${label} · alimentación Arduino; GND común`,
                )}
              >
                <boxGeometry args={[0.05, 0.006, 0.037]} />
                <meshStandardMaterial color="#b6b08a" />
              </mesh>
            ))}
          </>
        )}
      </group>
    </group>
  );
}

function SensorModel({
  sensor,
  onSelect,
}: {
  sensor: string;
  onSelect?: StationSceneProps["onSelect"];
}) {
  const conf = connections[sensor] || connections.soil;
  const dht = ["air_temperature", "air_humidity", "dht11"].includes(sensor);
  return (
    <group
      position={[2.12, 0.34, -0.51]}
      onClick={select(
        onSelect,
        `${conf.name} · ${conf.signal}, pin físico ${conf.physical}`,
      )}
    >
      {sensor === "lcd" ? (
        <>
          <mesh castShadow>
            <boxGeometry args={[1.28, 0.09, 0.57]} />
            <meshStandardMaterial color="#49775b" />
          </mesh>
          <mesh position={[0, 0.063, 0]}>
            <boxGeometry args={[1.05, 0.034, 0.38]} />
            <meshStandardMaterial color="#afbc86" />
          </mesh>
          {Array.from({ length: 32 }, (_, i) => (
            <mesh
              key={i}
              position={[
                -0.452 + (i % 16) * 0.0603,
                0.084,
                i < 16 ? -0.095 : 0.095,
              ]}
            >
              <boxGeometry args={[0.041, 0.004, 0.105]} />
              <meshStandardMaterial color="#98a67c" />
            </mesh>
          ))}
        </>
      ) : sensor === "seven_segment" || sensor === "four_digit" ? (
        <>
          <mesh position={[0, 0.04, 0]} castShadow>
            <boxGeometry
              args={[sensor === "four_digit" ? 0.99 : 0.34, 0.12, 0.49]}
            />
            <meshStandardMaterial color="#303e34" />
          </mesh>
          {Array.from({ length: sensor === "four_digit" ? 4 : 1 }, (_, d) => (
            <group
              key={d}
              position={[
                sensor === "four_digit" ? -0.35 + d * 0.235 : 0,
                0.106,
                0,
              ]}
            >
              {Array.from({ length: 7 }, (_, i) => (
                <mesh
                  key={i}
                  position={
                    i < 3
                      ? [0, 0, -0.145 + i * 0.145]
                      : [i % 2 ? -0.068 : 0.068, 0, i < 5 ? -0.07 : 0.07]
                  }
                >
                  <boxGeometry
                    args={i < 3 ? [0.12, 0.004, 0.022] : [0.022, 0.004, 0.11]}
                  />
                  <meshStandardMaterial color="#aaaca0" />
                </mesh>
              ))}
            </group>
          ))}
        </>
      ) : sensor === "matrix" ? (
        <>
          <mesh position={[0, 0.09, 0]} castShadow>
            <boxGeometry args={[0.73, 0.15, 0.73]} />
            <meshStandardMaterial color="#273a2c" />
          </mesh>
          {Array.from({ length: 64 }, (_, i) => (
            <mesh
              key={i}
              position={[
                -0.295 + (i % 8) * 0.084,
                0.17,
                -0.295 + Math.floor(i / 8) * 0.084,
              ]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <circleGeometry args={[0.027, 12]} />
              <meshStandardMaterial color="#d3d9c2" roughness={0.8} />
            </mesh>
          ))}
        </>
      ) : sensor === "stepper" ? (
        <>
          <mesh position={[0, 0.15, -0.1]} castShadow>
            <cylinderGeometry args={[0.3, 0.3, 0.27, 32]} />
            <meshStandardMaterial
              color="#97a8aa"
              metalness={0.62}
              roughness={0.45}
            />
          </mesh>
          <mesh position={[0, 0.35, -0.1]}>
            <cylinderGeometry args={[0.045, 0.045, 0.16, 16]} />
            <meshStandardMaterial
              color="#c6cdbb"
              metalness={0.8}
              roughness={0.25}
            />
          </mesh>
          <mesh position={[0.29, 0.01, 0.3]}>
            <boxGeometry args={[0.51, 0.045, 0.28]} />
            <meshStandardMaterial color="#476c80" />
          </mesh>
          <mesh position={[0.29, 0.043, 0.3]}>
            <boxGeometry args={[0.3, 0.048, 0.12]} />
            <meshStandardMaterial color="#29342e" />
          </mesh>
        </>
      ) : sensor === "servo" ? (
        <>
          <mesh position={[0, 0.18, 0]} castShadow>
            <boxGeometry args={[0.38, 0.39, 0.21]} />
            <meshStandardMaterial color="#4c6f90" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.4, 0]} castShadow>
            <cylinderGeometry args={[0.07, 0.07, 0.06, 18]} />
            <meshStandardMaterial color="#e9ebdc" />
          </mesh>
          <mesh position={[0.04, 0.44, 0]}>
            <boxGeometry args={[0.43, 0.036, 0.065]} />
            <meshStandardMaterial color="#eff0dd" />
          </mesh>
          <mesh position={[-0.32, 0.13, 0.25]}>
            <sphereGeometry args={[0.074, 12, 10]} />
            <meshStandardMaterial color="#c9a145" />
          </mesh>
        </>
      ) : sensor === "shift_register" ? (
        <>
          <mesh position={[0, 0.09, 0]} castShadow>
            <boxGeometry args={[0.22, 0.13, 0.71]} />
            <meshStandardMaterial color="#2b372d" />
          </mesh>
          {Array.from({ length: 16 }, (_, i) => (
            <mesh
              key={i}
              position={[i < 8 ? -0.14 : 0.14, 0.032, -0.29 + (i % 8) * 0.083]}
            >
              <boxGeometry args={[0.075, 0.038, 0.025]} />
              <meshStandardMaterial color="#bdc0ad" metalness={0.8} />
            </mesh>
          ))}
        </>
      ) : sensor === "button" ? (
        <>
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[0.31, 0.13, 0.31]} />
            <meshStandardMaterial color="#536357" />
          </mesh>
          <mesh position={[0, 0.14, 0]}>
            <cylinderGeometry args={[0.09, 0.09, 0.08, 16]} />
            <meshStandardMaterial color="#202e22" />
          </mesh>
        </>
      ) : sensor === "potentiometer" ? (
        <>
          <mesh position={[0, 0.11, 0]} castShadow>
            <cylinderGeometry args={[0.2, 0.2, 0.13, 24]} />
            <meshStandardMaterial color="#528486" />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <cylinderGeometry args={[0.061, 0.061, 0.2, 12]} />
            <meshStandardMaterial color="#bbbeab" metalness={0.7} />
          </mesh>
        </>
      ) : ["lm35", "infrared"].includes(sensor) ? (
        <mesh position={[0, 0.14, 0]} castShadow>
          <boxGeometry args={[0.18, 0.3, 0.1]} />
          <meshStandardMaterial color="#29362a" />
        </mesh>
      ) : dht ? (
        <>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[0.36, 0.45, 0.2]} />
            <meshStandardMaterial color="#6d9fb0" roughness={0.75} />
          </mesh>
          {Array.from({ length: 6 }, (_, i) => (
            <mesh key={i} position={[0, 0.03 + i * 0.067, 0.106]}>
              <boxGeometry args={[0.28, 0.022, 0.013]} />
              <meshStandardMaterial color="#3f6572" />
            </mesh>
          ))}
        </>
      ) : sensor === "distance" ? (
        <>
          <mesh castShadow>
            <boxGeometry args={[0.9, 0.12, 0.43]} />
            <meshStandardMaterial color="#427b8d" />
          </mesh>
          {[-1, 1].map((s) => (
            <group
              key={s}
              position={[s * 0.25, 0.2, 0]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <mesh castShadow>
                <cylinderGeometry args={[0.17, 0.17, 0.18, 32]} />
                <meshStandardMaterial
                  color="#b7c2bd"
                  metalness={0.75}
                  roughness={0.4}
                />
              </mesh>
              <mesh position={[0, 0.094, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[0.136, 32]} />
                <meshStandardMaterial
                  color="#495756"
                  metalness={0.4}
                  roughness={0.8}
                />
              </mesh>
            </group>
          ))}
        </>
      ) : sensor === "motion" ? (
        <>
          <mesh castShadow>
            <boxGeometry args={[0.65, 0.075, 0.52]} />
            <meshStandardMaterial color="#548363" />
          </mesh>
          <mesh position={[0, 0.2, 0]} castShadow>
            <sphereGeometry
              args={[0.23, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial color="#f3f2e8" roughness={0.8} flatShading />
          </mesh>
        </>
      ) : ["soil_temperature", "ds18b20"].includes(sensor) ? (
        <mesh position={[0, 0.16, 0]} rotation={[0, 0, -0.4]} castShadow>
          <cylinderGeometry args={[0.06, 0.06, 0.61, 20]} />
          <meshStandardMaterial
            color="#a8b7b1"
            metalness={0.85}
            roughness={0.25}
          />
        </mesh>
      ) : sensor === "led" ? (
        <>
          <mesh position={[0, 0.15, 0]} castShadow>
            <sphereGeometry
              args={[0.13, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
            />
            <meshStandardMaterial color="#d1a63d" roughness={0.4} />
          </mesh>
          <mesh>
            <cylinderGeometry args={[0.13, 0.13, 0.16, 20]} />
            <meshStandardMaterial color="#d1a63d" />
          </mesh>
        </>
      ) : sensor === "light" || sensor === "ldr" ? (
        <group rotation={[Math.PI / 3, 0, 0]}>
          <mesh castShadow>
            <cylinderGeometry args={[0.16, 0.16, 0.06, 24]} />
            <meshStandardMaterial color="#d4c290" />
          </mesh>
          {[0, 1, 2, 3].map((i) => (
            <mesh key={i} position={[0, 0.033, -0.105 + i * 0.065]}>
              <boxGeometry args={[0.24, 0.008, 0.024]} />
              <meshStandardMaterial color="#a56d47" />
            </mesh>
          ))}
        </group>
      ) : sensor === "buzzer" || sensor === "active_buzzer" ? (
        <mesh position={[0, 0.13, 0]} castShadow>
          <cylinderGeometry args={[0.18, 0.18, 0.24, 24]} />
          <meshStandardMaterial color="#333d33" />
        </mesh>
      ) : (
        <>
          <mesh position={[0, 0.03, 0]} castShadow>
            <boxGeometry
              args={
                sensor === "rain"
                  ? [0.56, 0.06, 0.71]
                  : sensor === "water_level"
                    ? [0.32, 0.07, 0.72]
                    : [0.29, 0.09, 0.71]
              }
            />
            <meshStandardMaterial
              color={
                sensor === "rain"
                  ? "#3b4340"
                  : sensor === "water_level"
                    ? "#ad5c4a"
                    : "#323b2e"
              }
              roughness={0.8}
            />
          </mesh>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i} position={[0, 0.082, -0.25 + i * 0.073]}>
              <boxGeometry args={[0.22, 0.006, 0.012]} />
              <meshStandardMaterial color="#c1a665" metalness={0.4} />
            </mesh>
          ))}
        </>
      )}
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[-0.08 + i * 0.08, 0.014, 0.4]}>
          <boxGeometry args={[0.022, 0.028, 0.14]} />
          <meshStandardMaterial color="#c0a96c" metalness={0.6} />
        </mesh>
      ))}
    </group>
  );
}

function Resistor({
  position,
  value = "220 Ω",
  rotation = [Math.PI / 2, 0, 0],
}: {
  position: V3;
  value?: string;
  rotation?: V3;
}) {
  return (
    <group position={position} rotation={rotation}>
      <mesh castShadow>
        <cylinderGeometry args={[0.034, 0.034, 0.18, 12]} />
        <meshStandardMaterial color="#d7c7a2" roughness={0.8} />
      </mesh>
      {[-0.058, -0.027, 0.027, 0.06].map((y, i) => (
        <mesh key={i} position={[0, y, 0]}>
          <cylinderGeometry args={[0.035, 0.035, 0.013, 12]} />
          <meshStandardMaterial
            color={
              i === 3
                ? gold
                : value === "1 kΩ"
                  ? ["#896843", "#222b20", "#b75543"][i]
                  : value === "10 kΩ"
                    ? ["#896843", "#222b20", "#ce873e"][i]
                    : ["#b75543", "#b75543", "#896843"][i]
            }
          />
        </mesh>
      ))}
      <mesh>
        <cylinderGeometry args={[0.006, 0.006, 0.35, 6]} />
        <meshStandardMaterial color="#b2bbae" metalness={0.7} />
      </mesh>
    </group>
  );
}

function ResetCamera({ reset, variant }: { reset: number; variant: string }) {
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(4.4, 3.7, 5.6);
    camera.lookAt(0.1, 1.2, 0.25);
  }, [camera, reset, variant]);
  return null;
}
function World({
  variant,
  sensor,
  activeStep,
  onSelect,
  board,
  reset,
}: Required<
  Pick<StationSceneProps, "variant" | "sensor" | "activeStep" | "board">
> &
  Pick<StationSceneProps, "onSelect"> & { reset: number }) {
  const conf = connections[sensor] || connections.soil;
  const hero = variant === "hero";
  const background = hero ? "#edf1e7" : cream;
  const destination: V3 = hero ? [-0.43, 1.31, 0.0] : [2.05, 0.39, -0.11];
  const signal =
    board === "pico"
      ? pinPosition(conf.physical)
      : arduinoPosition(conf.arduino);
  const supply =
    board === "pico"
      ? pinPosition(conf.supply ? 40 : 36)
      : arduinoPosition(
          conf.supply ||
            [
              "air_temperature",
              "air_humidity",
              "dht11",
              "shift_register",
            ].includes(sensor)
            ? "5V"
            : "3V3",
        );
  const ground = board === "pico" ? pinPosition(38) : arduinoPosition("GND");
  const path = (start: V3, end: V3, delta: number): V3[] => [
    start,
    [start[0] + 0.12, start[1] + 0.3 + delta, start[2] - 0.18],
    [(start[0] + end[0]) / 2, 0.56 + delta, (start[2] + end[2]) / 2],
    end,
  ];
  const multiChannels: Record<string, [number, string][]> = {
    shift_register: [
      [7, "D5"],
      [9, "D6"],
      [10, "D7"],
    ],
    lcd: [
      [7, "D5"],
      [9, "D6"],
      [10, "D7"],
      [11, "D8"],
      [12, "D9"],
      [14, "D10"],
    ],
    seven_segment: [
      [7, "D5"],
      [9, "D6"],
      [10, "D7"],
      [11, "D8"],
      [12, "D9"],
      [14, "D10"],
      [15, "D11"],
      [16, "A0"],
    ],
    four_digit: [
      [7, "D5"],
      [9, "D6"],
      [10, "D7"],
      [11, "D8"],
      [12, "D9"],
      [14, "D10"],
      [15, "D11"],
      [16, "A0"],
      [17, "A1"],
      [19, "A2"],
      [20, "A3"],
    ],
    matrix: [1, 2, 4, 5, 6, 7, 9, 10, 11, 12, 14, 15, 16, 17, 19, 20].map(
      (p, i) => [p, i < 12 ? `D${i + 2}` : `A${i - 12}`],
    ),
    stepper: [
      [26, "D4"],
      [27, "D5"],
      [29, "D6"],
      [1, "D7"],
    ],
  };
  const multi = !hero ? multiChannels[sensor] : undefined;
  return (
    <>
      <color attach="background" args={[background]} />
      <fog attach="fog" args={[background, 14, 28]} />
      <ambientLight intensity={1.65} />
      <directionalLight
        position={[-3, 8, 5]}
        intensity={3.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[4, 4, -2]} intensity={1.1} color="#f6ecd1" />
      <mesh
        position={[0, -0.05, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color={background} roughness={1} />
      </mesh>
      <Plant onSelect={onSelect} board={board} />
      <Breadboard
        board={board}
        onSelect={onSelect}
        activePin={conf.physical}
        activeArduino={conf.arduino}
      />
      {!hero && <SensorModel sensor={sensor} onSelect={onSelect} />}
      {multi ? (
        <>
          {multi.map(([physical, arduino], i) => (
            <Wire
              key={physical}
              points={path(
                board === "pico"
                  ? pinPosition(physical)
                  : arduinoPosition(arduino),
                [
                  sensor === "lcd" ? 1.65 + i * 0.12 : 1.92 + i * 0.04,
                  0.39,
                  -0.11 - (i % 2) * 0.07,
                ],
                (i - multi.length / 2) * 0.014,
              )}
              color={i % 3 === 0 ? "#9caa7c" : gold}
              active={i % 3 === activeStep % 3}
            />
          ))}
          {["shift_register", "lcd", "stepper"].includes(sensor) && (
            <>
              <Wire
                points={path(supply, [2.27, 0.39, -0.25], 0.1)}
                color="#bd7559"
                active={activeStep === 0}
              />
              <Wire
                points={path(ground, [2.31, 0.39, -0.25], -0.08)}
                color="#617066"
                active={activeStep === 0}
              />
            </>
          )}
          {["seven_segment", "four_digit"].includes(sensor) &&
            Array.from({ length: sensor === "four_digit" ? 4 : 1 }, (_, i) => (
              <Resistor
                key={i}
                position={[2.43 + i * 0.1, 0.3, 0.16]}
                value="1 kΩ"
              />
            ))}
          {sensor === "matrix" &&
            Array.from({ length: 8 }, (_, i) => (
              <Resistor
                key={i}
                position={[2.33 + i * 0.083, 0.28, 0.15]}
                value={i < 5 ? "1 kΩ" : "10 kΩ"}
              />
            ))}
        </>
      ) : !hero && ["led", "buzzer", "button", "servo"].includes(sensor) ? (
        <>
          {sensor !== "button" && (
            <Resistor
              position={[1.94, 0.39, -0.1]}
              value={sensor === "servo" ? "1 kΩ" : "220 Ω"}
            />
          )}
          <Wire
            points={path(
              signal,
              [1.94, 0.39, sensor === "button" ? -0.29 : 0.07],
              0.02,
            )}
            color={gold}
            active={activeStep === 0}
          />
          <Wire
            points={[
              [1.94, 0.39, -0.27],
              [2.02, 0.47, -0.36],
              [2.06, 0.39, -0.46],
            ]}
            color="#bd7559"
            active={activeStep === 1}
          />
          <Wire
            points={path(ground, [2.18, 0.39, -0.46], -0.08)}
            color="#617066"
            active={activeStep >= 2}
          />
        </>
      ) : (
        <>
          <Wire
            points={path(
              supply,
              [destination[0] - 0.075, destination[1], destination[2]],
              0.09,
            )}
            color="#bd7559"
            active={hero || activeStep === 0}
          />
          <Wire
            points={path(
              ground,
              [destination[0] + 0.075, destination[1], destination[2]],
              -0.08,
            )}
            color="#617066"
            active={hero || activeStep === 1}
          />
          <Wire
            points={path(signal, destination, 0.02)}
            color={gold}
            active={hero || activeStep >= 2}
          />
        </>
      )}
      {sensor === "distance" && !hero && board === "pico" && (
        <>
          {Array.from({ length: 5 }, (_, i) => (
            <Resistor
              key={i}
              position={[2.64, 0.26, -0.67 + i * 0.36]}
              value="1 kΩ"
            />
          ))}
          <Wire
            points={[
              [2.37, 0.39, -0.11],
              [2.62, 0.45, -0.92],
              [2.64, 0.26, -0.85],
            ]}
            color="#708a78"
            active={activeStep >= 2}
          />
          <Wire
            points={path(pinPosition(24), [2.64, 0.26, -0.13], 0.19)}
            color="#708a78"
            active={activeStep >= 2}
          />
          <Wire
            points={path(ground, [2.64, 0.26, 0.95], -0.04)}
            color="#617066"
            active={activeStep >= 2}
          />
        </>
      )}
      {sensor === "distance" && !hero && board === "uno" && (
        <Wire
          points={path(arduinoPosition("D8"), [2.25, 0.39, -0.11], 0.19)}
          color="#708a78"
          active={activeStep >= 2}
        />
      )}
      {[
        "soil_temperature",
        "ds18b20",
        "air_temperature",
        "air_humidity",
        "dht11",
      ].includes(sensor) &&
        !hero && (
          <>
            <Resistor position={[2.36, 0.31, -0.05]} value="10 kΩ" />
            {["soil_temperature", "ds18b20"].includes(sensor) && (
              <Resistor position={[2.49, 0.31, -0.05]} value="10 kΩ" />
            )}
            <Wire
              points={[
                [1.98, 0.39, -0.11],
                [2.25, 0.41, 0.16],
                [2.36, 0.31, 0.13],
                [2.49, 0.31, 0.13],
              ]}
              color="#bd7559"
              active={activeStep >= 2}
            />
            <Wire
              points={[
                [2.05, 0.39, -0.11],
                [2.18, 0.44, -0.28],
                [2.36, 0.31, -0.23],
                [2.49, 0.31, -0.23],
              ]}
              color={gold}
              active={activeStep >= 2}
            />
          </>
        )}
      {hero ? (
        <>
          <Label
            position={[0.25, 2.3, -0.05]}
            title="La vida, en el centro"
            detail="Un ecosistema que puedes conocer"
          />
          <Label
            position={[-0.56, 0.83, 0.88]}
            title="Humedad del suelo"
            detail="Sonda capacitiva → GP26 · ADC0"
          />
          <Label
            position={[1.43, 0.54, 1.58]}
            title={board === "pico" ? "Raspberry Pi Pico W" : "Arduino por USB"}
            detail={
              board === "pico"
                ? "Sensores · código · Wi-Fi"
                : "Sensores · código · puente USB"
            }
          />
        </>
      ) : (
        <>
          <Label
            position={[2.32, 0.84, -0.3]}
            title={conf.name}
            detail={
              board === "pico"
                ? `${conf.signal} · pin ${conf.physical}`
                : `${conf.arduino} · Uno/Nano`
            }
          />
          <Label
            position={[0.74, 0.57, 1.56]}
            title={
              board === "pico"
                ? "Pico W · GPIO de 3.3 V"
                : "Uno/Nano · GPIO de 5 V"
            }
            detail="Selecciona un pin para identificarlo"
          />
        </>
      )}
      <ResetCamera reset={reset} variant={variant} />
      <OrbitControls
        key={reset}
        makeDefault
        target={[0.1, 1.2, 0.25]}
        minDistance={3.3}
        maxDistance={12}
        minPolarAngle={0.25}
        maxPolarAngle={Math.PI / 2.03}
        enableDamping
        dampingFactor={0.08}
      />
    </>
  );
}

export function WiringDiagram({
  sensor = "soil",
  activeStep = 0,
  onSelect,
  board = "pico",
}: StationSceneProps) {
  const conf = connections[sensor] || connections.soil;
  const advancedRows: Record<string, [string, string, string][]> = {
    shift_register: [
      ["16 VCC + 10 MR", "3V3 · pin 36", "5V"],
      ["8 GND + 13 OE", "GND · pin 38", "GND"],
      ["14 DS", "GP5 · pin 7", "D5"],
      ["11 SHCP", "GP6 · pin 9", "D6"],
      ["12 STCP", "GP7 · pin 10", "D7"],
      ["15 Q0", "220 Ω → ánodo LED", "220 Ω → ánodo LED"],
      ["LED cátodo", "GND", "GND"],
    ],
    lcd: [
      ["1 VSS", "GND", "GND"],
      ["2 VDD", "VBUS 5V · pin 40", "5V"],
      ["3 V0 contraste", "Cursor potenciómetro", "Cursor potenciómetro"],
      ["4 RS", "GP5 · pin 7", "D5"],
      ["5 RW", "GND · solo escritura", "GND · solo escritura"],
      ["6 E", "GP6 · pin 9", "D6"],
      ["11 D4", "GP7 · pin 10", "D7"],
      ["12 D5", "GP8 · pin 11", "D8"],
      ["13 D6", "GP9 · pin 12", "D9"],
      ["14 D7", "GP10 · pin 14", "D10"],
      ["15 A backlight", "5V → 220 Ω", "5V → 220 Ω"],
      ["16 K backlight", "GND", "GND"],
    ],
    seven_segment: [
      ["A", "GP5 · pin 7", "D5"],
      ["B", "GP6 · pin 9", "D6"],
      ["C", "GP7 · pin 10", "D7"],
      ["D", "GP8 · pin 11", "D8"],
      ["E", "GP9 · pin 12", "D9"],
      ["F", "GP10 · pin 14", "D10"],
      ["G", "GP11 · pin 15", "D11"],
      ["COM (ambas patas)", "1 kΩ → GP12 / pin 16", "1 kΩ → A0"],
    ],
    four_digit: [
      ["A", "GP5 · pin 7", "D5"],
      ["B", "GP6 · pin 9", "D6"],
      ["C", "GP7 · pin 10", "D7"],
      ["D", "GP8 · pin 11", "D8"],
      ["E", "GP9 · pin 12", "D9"],
      ["F", "GP10 · pin 14", "D10"],
      ["G", "GP11 · pin 15", "D11"],
      ["D1 común", "1 kΩ → GP12 / pin 16", "1 kΩ → A0"],
      ["D2 común", "1 kΩ → GP13 / pin 17", "1 kΩ → A1"],
      ["D3 común", "1 kΩ → GP14 / pin 19", "1 kΩ → A2"],
      ["D4 común", "1 kΩ → GP15 / pin 20", "1 kΩ → A3"],
    ],
    matrix: Array.from({ length: 16 }, (_, i) =>
      i < 8
        ? [
            `Fila R${i + 1}`,
            `${i < 5 ? "1" : "10"} kΩ → GP${i}`,
            `${i < 5 ? "1" : "10"} kΩ → D${i + 2}`,
          ]
        : [`Columna C${i - 7}`, `GP${i}`, i < 12 ? `D${i + 2}` : `A${i - 12}`],
    ),
    active_buzzer: [
      ["ULN2003 IN1 / pin 1", "GP3 · pin 5", "D3"],
      ["ULN2003 GND / pin 8", "GND", "GND"],
      ["ULN2003 COM / pin 9", "VBUS 5V · pin 40", "5V"],
      ["Buzzer (+)", "VBUS 5V (si apto5V)", "5V (si apto5V)"],
      ["Buzzer (−)", "OUT1 ULN / pin 16", "OUT1 ULN / pin 16"],
    ],
    stepper: [
      ["ULN IN1 / pin 1", "GP20 · pin 26", "D4"],
      ["ULN IN2 / pin 2", "GP21 · pin 27", "D5"],
      ["ULN IN3 / pin 3", "GP22 · pin 29", "D6"],
      ["ULN IN4 / pin 4", "GP0 · pin 1", "D7"],
      ["ULN GND / pin 8", "GND", "GND"],
      ["ULN COM / pin 9", "VBUS 5V validado", "5V validado"],
      ["Motor común +", "VBUS 5V validado", "5V validado"],
      ["Bobinas motor 1–4", "ULN OUT1–4 (16–13)", "ULN OUT1–4 (16–13)"],
    ],
  };
  const advanced = advancedRows[sensor];
  if (advanced)
    return (
      <div
        style={{
          height: "100%",
          minHeight: 320,
          background: cream,
          borderRadius: "inherit",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          viewBox="0 0 700 420"
          role="img"
          aria-label={`Plano completo de ${conf.name}`}
          style={{ width: "100%", maxHeight: "100%" }}
        >
          <text
            x="350"
            y="27"
            textAnchor="middle"
            fill="#334734"
            fontSize="17"
            fontWeight="650"
          >
            {conf.name} · plano de conexiones
          </text>
          <rect x="24" y="43" width="284" height="339" rx="15" fill="#e6ebdc" />
          <rect
            x="420"
            y="43"
            width="256"
            height="339"
            rx="15"
            fill="#fcfaf0"
            stroke="#d9ddcc"
          />
          <text
            x="166"
            y="64"
            textAnchor="middle"
            fill="#536744"
            fontSize="11"
            fontWeight="650"
          >
            {board === "pico" ? "PICO W · GPIO 3.3 V" : "UNO / NANO · GPIO 5 V"}
          </text>
          <text x="548" y="64" textAnchor="middle" fill="#536744" fontSize="11">
            TERMINAL DEL COMPONENTE
          </text>
          {advanced.map(([terminal, pico, uno], i) => {
            const y = 85 + i * (advanced.length > 12 ? 19 : 24),
              source = board === "pico" ? pico : uno,
              color = /GND/.test(source)
                ? "#65796c"
                : /3V3|5V/.test(source)
                  ? "#bb7358"
                  : gold;
            return (
              <g
                key={i}
                role="button"
                tabIndex={0}
                aria-label={`${source} hacia ${terminal}`}
                onClick={() => onSelect?.(`${source} → ${terminal}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect?.(`${source} → ${terminal}`);
                }}
                style={{ cursor: "pointer" }}
              >
                <text
                  x="289"
                  y={y + 4}
                  textAnchor="end"
                  fill="#45573e"
                  fontSize="11"
                >
                  {source}
                </text>
                <path
                  d={`M309 ${y} H419`}
                  stroke={color}
                  strokeWidth={i === activeStep ? 4 : 2}
                  opacity={i === activeStep ? 1 : 0.6}
                />
                <circle cx="309" cy={y} r="3" fill={color} />
                <circle cx="419" cy={y} r="3" fill={color} />
                <text x="433" y={y + 4} fill="#45573e" fontSize="11">
                  {terminal}
                </text>
              </g>
            );
          })}
          <text
            x="350"
            y="403"
            textAnchor="middle"
            fill="#758067"
            fontSize="10"
          >
            {["seven_segment", "four_digit", "matrix"].includes(sensor)
              ? "Pinout / polaridad según modelo real. Un LED activo por vez; no se omiten las resistencias."
              : sensor === "lcd"
                ? "Potenciómetro extremos a5V/GND. LCD D0–D3 sin conectar. RW permanentemente aGND."
                : sensor === "stepper"
                  ? "Valida presupuesto USB antes de energizar. Bobinas nunca conectadas directamente a GPIO."
                  : "Desconecta USB antes de modificar conexiones. Confirma la numeración del chip."}
          </text>
        </svg>
      </div>
    );
  const isLed = sensor === "led" || sensor === "buzzer" || sensor === "servo";
  if (isLed || sensor === "button")
    return (
      <div
        style={{
          height: "100%",
          minHeight: 320,
          background: cream,
          borderRadius: "inherit",
          display: "grid",
          placeItems: "center",
        }}
      >
        <svg
          viewBox="0 0 700 375"
          role="img"
          aria-label={`Circuito eléctrico ${conf.name}`}
          style={{ width: "100%", maxHeight: "100%" }}
        >
          <rect
            x="38"
            y="77"
            width="182"
            height="218"
            rx="20"
            fill="#ecebde"
            stroke="#d7daca"
          />
          <rect
            x="56"
            y="95"
            width="145"
            height="182"
            rx="12"
            fill={board === "pico" ? "#568064" : "#477e87"}
          />
          <rect x="109" y="91" width="38" height="28" rx="4" fill="#c3c8ba" />
          <text
            x="128"
            y="149"
            textAnchor="middle"
            fill="#f8f7e9"
            fontSize="16"
            fontWeight="700"
          >
            {board === "pico" ? "PICO W" : "UNO / NANO"}
          </text>
          <text
            x="128"
            y="182"
            textAnchor="middle"
            fill="#eff1dc"
            fontSize="12"
          >
            {board === "pico"
              ? `${conf.signal} · pin ${conf.physical}`
              : conf.arduino}
          </text>
          <text
            x="128"
            y="243"
            textAnchor="middle"
            fill="#eff1dc"
            fontSize="12"
          >
            GND
          </text>
          <text
            x="430"
            y="79"
            textAnchor="middle"
            fill="#334734"
            fontSize="19"
            fontWeight="650"
          >
            {conf.name}
          </text>
          <path
            d="M201 177 H288"
            fill="none"
            stroke={gold}
            strokeWidth={activeStep === 0 ? 5 : 2.5}
          />
          <circle cx="201" cy="177" r="5" fill={gold} />
          {isLed ? (
            <>
              <rect
                x="288"
                y="166"
                width="70"
                height="22"
                rx="4"
                fill="#d6c8a4"
                stroke="#a18b60"
              />
              <text
                x="323"
                y="151"
                textAnchor="middle"
                fill="#6c715a"
                fontSize="12"
              >
                {sensor === "servo" ? "1 kΩ" : "220 Ω"}
              </text>
              <path
                d="M358 177 H457"
                fill="none"
                stroke="#bc7759"
                strokeWidth={activeStep === 1 ? 5 : 2.5}
              />
              {sensor === "led" || sensor === "servo" ? (
                <>
                  <path
                    d="M457 162 L457 192 L482 177 Z M484 161 V193 M484 177 H503"
                    fill="#d4af4f"
                    stroke="#9b8244"
                    strokeWidth="2"
                  />
                  <path
                    d="M477 154 L494 139 M486 163 L503 148"
                    stroke="#b5a451"
                    strokeWidth="2"
                  />
                  <text
                    x="462"
                    y="222"
                    textAnchor="middle"
                    fill="#6c715a"
                    fontSize="12"
                  >
                    Ánodo +
                  </text>
                  <text
                    x="534"
                    y="222"
                    textAnchor="middle"
                    fill="#6c715a"
                    fontSize="12"
                  >
                    Cátodo −
                  </text>
                </>
              ) : (
                <>
                  <circle cx="479" cy="177" r="24" fill="#465944" />
                  <text
                    x="479"
                    y="181"
                    textAnchor="middle"
                    fill="#f5f3e9"
                    fontSize="11"
                  >
                    PIEZO
                  </text>
                </>
              )}
              <path
                d="M503 177 H574 V238 H201"
                fill="none"
                stroke="#65796c"
                strokeWidth={activeStep >= 2 ? 5 : 2.5}
              />
            </>
          ) : (
            <>
              <path
                d="M288 177 H398 M449 177 H574 V238 H201"
                fill="none"
                stroke="#65796c"
                strokeWidth={activeStep >= 1 ? 5 : 2.5}
              />
              <circle cx="398" cy="177" r="5" fill="#687d52" />
              <circle cx="449" cy="177" r="5" fill="#687d52" />
              <path
                d="M398 177 L443 158"
                fill="none"
                stroke="#b19144"
                strokeWidth="4"
              />
              <path
                d="M250 177 V121 H278"
                fill="none"
                stroke="#ad8061"
                strokeWidth="2"
                strokeDasharray="4 4"
              />
              <text x="283" y="125" fill="#6c715a" fontSize="11">
                Pull-up interno a {board === "pico" ? "3.3" : "5"} V
              </text>
              <text
                x="423"
                y="220"
                textAnchor="middle"
                fill="#6c715a"
                fontSize="12"
              >
                Contacto al pulsar → 0
              </text>
            </>
          )}
          <circle cx="201" cy="238" r="5" fill="#65796c" />
          <text
            x="350"
            y="325"
            textAnchor="middle"
            fill="#697760"
            fontSize="12"
          >
            {sensor === "buzzer"
              ? "Solo piezo pasivo de consumo seguro para GPIO. No motor ni buzzer activo desconocido."
              : sensor === "servo"
                ? "SG90 sin alimentación con el kit actual. El LED permite probar la señal PWM real."
                : "Desconecta USB antes de recablear. No unas alimentación y GND directamente."}
          </text>
          <g
            role="button"
            tabIndex={0}
            onClick={() => onSelect?.(conf.extra || conf.signal)}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelect?.(conf.extra || conf.signal);
            }}
            style={{ cursor: "pointer" }}
          >
            <rect
              x="244"
              y="263"
              width="383"
              height="29"
              rx="14"
              fill="#e9eddf"
            />
            <text
              x="435"
              y="282"
              textAnchor="middle"
              fill="#536a44"
              fontSize="11"
            >
              Seleccionar circuito ·{" "}
              {board === "pico" ? conf.signal : conf.arduino}
            </text>
          </g>
        </svg>
      </div>
    );
  const lines = isLed
    ? ["GPIO", "220 Ω", "GND"]
    : [
        conf.supply ? "5 V / VBUS" : "3V3",
        "GND",
        board === "pico" ? conf.signal : conf.arduino,
      ];
  const colors = ["#bd7559", "#65796c", gold];
  return (
    <div
      style={{
        height: "100%",
        minHeight: 320,
        background: cream,
        borderRadius: "inherit",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <svg
        viewBox="0 0 700 375"
        role="img"
        aria-label={`Diagrama de conexión de ${conf.name}`}
        style={{ width: "100%", maxHeight: "100%" }}
      >
        <defs>
          <pattern
            id="breadboardHoles"
            x="0"
            y="0"
            width="15"
            height="15"
            patternUnits="userSpaceOnUse"
          >
            <circle cx="7" cy="7" r="1.8" fill="#c2c7b8" />
          </pattern>
        </defs>
        <rect
          x="27"
          y="39"
          width="278"
          height="263"
          rx="20"
          fill="#ecebde"
          stroke="#d7daca"
        />
        <rect
          x="41"
          y="53"
          width="250"
          height="238"
          rx="12"
          fill="url(#breadboardHoles)"
        />
        <rect
          x="66"
          y="61"
          width="160"
          height="218"
          rx="12"
          fill={board === "pico" ? "#568064" : "#477e87"}
        />
        <rect x="118" y="58" width="52" height="27" rx="5" fill="#b9c5b8" />
        <rect x="112" y="133" width="65" height="55" rx="4" fill="#27392c" />
        <text
          x="146"
          y="116"
          textAnchor="middle"
          fill="#faf9ed"
          fontSize="14"
          fontWeight="700"
        >
          {board === "pico" ? "PICO W" : "UNO / NANO"}
        </text>
        <text x="146" y="213" textAnchor="middle" fill="#eff1dc" fontSize="11">
          USB
        </text>
        <text x="146" y="242" textAnchor="middle" fill="#eff1dc" fontSize="10">
          {board === "pico" ? "GPIO · 3.3 V" : "GPIO · 5 V"}
        </text>
        <rect
          x="447"
          y="71"
          width="221"
          height="202"
          rx="14"
          fill="#fcfaf0"
          stroke="#d9ddcc"
        />
        <text
          x="558"
          y="106"
          textAnchor="middle"
          fill="#334734"
          fontSize="15"
          fontWeight="650"
        >
          {sensor === "light" || sensor === "ldr"
            ? "LDR + divisor 10 kΩ"
            : conf.name}
        </text>
        {lines.map((line, i) => (
          <g
            key={i}
            role="button"
            tabIndex={0}
            style={{ cursor: "pointer" }}
            onClick={() =>
              onSelect?.(
                `${line} · ${i === 0 ? "alimentación" : i === 1 ? "masa común" : "señal del sensor"}`,
              )
            }
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") onSelect?.(line);
            }}
            aria-label={`Seleccionar conexión ${line}`}
          >
            <path
              d={`M 224 ${145 + i * 49} C 330 ${145 + i * 49}, 340 ${143 + i * 49}, 452 ${143 + i * 49}`}
              fill="none"
              stroke={colors[i]}
              strokeWidth={activeStep === i ? 5 : 2.5}
              opacity={activeStep === i ? 1 : 0.45}
            />
            <circle cx="224" cy={145 + i * 49} r="5" fill={colors[i]} />
            <circle cx="452" cy={143 + i * 49} r="5" fill={colors[i]} />
            <rect
              x="291"
              y={129 + i * 49}
              width="134"
              height="27"
              rx="13"
              fill={cream}
            />
            <text
              x="358"
              y={147 + i * 49}
              textAnchor="middle"
              fontSize="11"
              fill="#435443"
              fontWeight="600"
            >
              {line}
            </text>
            <text x="476" y={148 + i * 49} fill="#435443" fontSize="12">
              {
                [
                  "VCC / +",
                  "GND / −",
                  sensor === "rain"
                    ? "DO"
                    : sensor === "distance"
                      ? "TRIG"
                      : sensor === "light" || sensor === "ldr"
                        ? "Nodo LDR / 10 kΩ"
                        : "DATA / AOUT",
                ][i]
              }
            </text>
          </g>
        ))}
        {sensor === "distance" && board === "pico" && (
          <g>
            <path
              d="M557 272 V294 H437 M402 294 H348 V268 H224 M348 294 V307"
              fill="none"
              stroke="#708a78"
              strokeWidth={activeStep >= 2 ? 3.5 : 2}
            />
            <rect
              x="402"
              y="286"
              width="35"
              height="15"
              rx="3"
              fill="#ded2b1"
              stroke="#ac9873"
            />
            <text
              x="418"
              y="282"
              textAnchor="middle"
              fontSize="9"
              fill="#657158"
            >
              2×1 kΩ
            </text>
            <rect
              x="342"
              y="306"
              width="13"
              height="19"
              rx="3"
              fill="#ded2b1"
              stroke="#ac9873"
            />
            <text x="374" y="318" fontSize="9" fill="#657158">
              3×1 kΩ → GND
            </text>
            <text x="562" y="293" fontSize="10" fill="#657158">
              ECHO
            </text>
            <text x="238" y="281" fontSize="9" fill="#657158">
              GP18 · pin 24 (≈3 V)
            </text>
          </g>
        )}
        {sensor === "distance" && board === "uno" && (
          <g>
            <path
              d="M557 272 V291 H348 V268 H224"
              fill="none"
              stroke="#708a78"
              strokeWidth="3"
            />
            <text x="237" y="285" fontSize="9" fill="#657158">
              D8 ← ECHO directo · Uno/Nano de 5 V
            </text>
          </g>
        )}
        {[
          "soil_temperature",
          "ds18b20",
          "air_temperature",
          "air_humidity",
          "dht11",
        ].includes(sensor) && (
          <g>
            <text
              x="590"
              y="264"
              textAnchor="middle"
              fontSize="9"
              fill="#657158"
            >
              {["soil_temperature", "ds18b20"].includes(sensor)
                ? "DATA ↔ (10 kΩ || 10 kΩ) ↔ 3V3"
                : "DATA ↔ 10 kΩ ↔ 3V3 (si desnudo)"}
            </text>
          </g>
        )}
        <text x="350" y="330" textAnchor="middle" fill="#697760" fontSize="11">
          {conf.extra ||
            "Desconecta USB antes de cambiar conexiones. GND común."}
        </text>
        <text x="350" y="353" textAnchor="middle" fill="#87907c" fontSize="10">
          {board === "pico"
            ? `${conf.signal} = pin físico ${conf.physical} · 3V3 = pin 36 · GND = pin 38`
            : `Señal ${conf.arduino} · alimentación según actividad · GND común`}
        </text>
      </svg>
    </div>
  );
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
function canWebGL() {
  try {
    const c = document.createElement("canvas");
    const gl = c.getContext("webgl2");
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

export default function StationScene({
  variant = "hero",
  sensor = "soil",
  activeStep = 0,
  onSelect,
  board = "pico",
  view = "3d",
}: StationSceneProps) {
  const [reset, setReset] = useState(0),
    [webgl] = useState(canWebGL),
    [lost, setLost] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const fallback = (
    <WiringDiagram
      sensor={sensor}
      activeStep={activeStep}
      onSelect={onSelect}
      board={board}
    />
  );
  return (
    <div
      ref={container}
      className={`station-scene station-scene-${variant}`}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: variant === "hero" ? 360 : 310,
        overflow: "hidden",
        borderRadius: "inherit",
        background: variant === "hero" ? "#edf1e7" : cream,
      }}
    >
      {view === "2d" || !webgl || lost ? (
        fallback
      ) : (
        <SceneBoundary fallback={fallback}>
          <Suspense fallback={fallback}>
            <Canvas
              shadows
              dpr={[1, 1.6]}
              camera={{
                position: [5.5, 4.3, 6.5],
                fov: 34,
                near: 0.1,
                far: 100,
              }}
              gl={{
                antialias: true,
                alpha: false,
                powerPreference: "low-power",
              }}
              onCreated={({ gl }) => {
                gl.domElement.addEventListener("webglcontextlost", (e) => {
                  e.preventDefault();
                  setLost(true);
                });
              }}
              style={{ touchAction: "none" }}
            >
              <World
                variant={variant}
                sensor={sensor}
                activeStep={activeStep}
                onSelect={onSelect}
                board={board}
                reset={reset}
              />
            </Canvas>
          </Suspense>
        </SceneBoundary>
      )}
      {view === "3d" && webgl && !lost && (
        <>
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 18,
              display: "flex",
              alignItems: "center",
              gap: 13,
              fontSize: 10,
              color: "#748064",
              background: "#f7f5ecdd",
              borderRadius: 20,
              padding: "7px 11px",
              pointerEvents: "none",
            }}
          >
            <Move size={12} />
            <span>Arrastra para explorar</span>
            <ZoomIn size={12} />
            <span>Scroll para acercar</span>
          </div>
          <button
            type="button"
            aria-label="Restablecer vista 3D"
            title="Restablecer vista"
            onClick={() => setReset((x) => x + 1)}
            style={{
              position: "absolute",
              bottom: 16,
              right: 16,
              border: "1px solid #dce0cf",
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: "#fdfbef",
              color: "#586944",
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={14} />
          </button>
        </>
      )}
      {(!webgl || lost) && view !== "2d" && (
        <span
          style={{
            position: "absolute",
            top: 12,
            left: 15,
            fontSize: 10,
            color: "#657158",
          }}
        >
          Vista 2D · WebGL no disponible
        </span>
      )}
    </div>
  );
}
