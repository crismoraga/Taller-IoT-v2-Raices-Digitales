import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  Leaf,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Sprout,
  Radio,
  Cpu,
  Droplets,
  Lightbulb,
  Sun,
  Check,
  MousePointer2,
  Zap,
} from "lucide-react";
import * as THREE from "three";
import { BOARD_NAMES, type Board } from "../lib/context";
import { MovingSignal, Tube, type V3 } from "./Primitives";
import {
  SafeCanvas,
  SceneHtml as Html,
  SceneCamera,
  useReducedMotion,
  useSceneActive,
  type CameraAction,
} from "./SceneSupport";
import "./experience.css";

type ElementId = "plant" | "sensor" | "pico" | "led" | "network";
const ELEMENTS: {
  id: ElementId;
  title: string;
  short: string;
  text: string;
  icon: typeof Leaf;
}[] = [
  {
    id: "plant",
    title: "Una planta, muchas señales",
    short: "Planta",
    text: "Prueba la luz y el agua. Después convertirás esas condiciones en datos con tu propia placa.",
    icon: Leaf,
  },
  {
    id: "sensor",
    title: "El sensor convierte humedad en una señal",
    short: "Sensor",
    text: "Mueve el control de humedad y mira cómo cambia la señal que recibe la placa.",
    icon: Droplets,
  },
  {
    id: "pico",
    title: "Aquí vive tu código",
    short: "Pico W",
    text: "Una Pico W o Arduino interpreta la señal. En el taller la programarás por USB desde esta página.",
    icon: Cpu,
  },
  {
    id: "led",
    title: "Del código a una luz real",
    short: "LED",
    text: "Enciéndelo con un toque. En tu circuito será una instrucción de tu programa la que lo controle.",
    icon: Lightbulb,
  },
  {
    id: "network",
    title: "La señal llega a tu dashboard",
    short: "Red",
    text: "Envía un dato de esta exploración y sigue su recorrido. Más adelante llegarán las lecturas de tu estación.",
    icon: Radio,
  },
];

const FOCUS: Record<ElementId, { target: V3; position: V3 }> = {
  plant: { target: [0, 2, 0], position: [4, 4.5, 5.5] },
  sensor: { target: [0.68, 1.7, 0.29], position: [3.9, 3.2, 4.1] },
  pico: { target: [-2, 0.4, 0.7], position: [1.2, 3.5, 4.2] },
  led: { target: [-1.05, 0.55, 1.15], position: [2.5, 3.8, 4.4] },
  network: { target: [2.1, 2.2, -0.5], position: [5.7, 4.2, 3.7] },
};

function sceneCursor(
  event: { nativeEvent: PointerEvent | MouseEvent },
  hover: boolean,
) {
  const target = event.nativeEvent.target;
  if (target instanceof HTMLElement)
    target.style.cursor = hover ? "pointer" : "grab";
}

function LeafBlade({
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
      indexes: number[] = [];
    const sections = 14;
    for (let i = 0; i <= sections; i++) {
      const t = i / sections;
      const spread = Math.pow(Math.sin(t * Math.PI), 0.7) * width;
      for (const edge of [-1, 0, 1])
        vertices.push(
          edge * spread,
          t * length,
          Math.sin(t * Math.PI) * length * 0.18 -
            Math.abs(edge) * spread * 0.15,
        );
    }
    for (let i = 0; i < sections; i++)
      for (let side = 0; side < 2; side++) {
        const a = i * 3 + side,
          b = a + 1,
          c = a + 3,
          d = a + 4;
        indexes.push(a, b, d, a, d, c);
      }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indexes);
    geo.computeVertexNormals();
    return geo;
  }, [length, width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const vein = useMemo<V3[]>(
    () =>
      Array.from({ length: 9 }, (_, index) => {
        const t = index / 8;
        return [0, t * length, Math.sin(t * Math.PI) * length * 0.18 + 0.008];
      }),
    [length],
  );
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color={color}
          side={THREE.DoubleSide}
          roughness={0.64}
        />
      </mesh>
      <Tube points={vein} radius={0.013} color="#b2d77b" />
    </group>
  );
}

function Plant({
  animate,
  roots,
  soil,
  light,
  selected,
  onSelect,
}: {
  animate: boolean;
  roots: boolean;
  soil: number;
  light: number;
  selected: boolean;
  onSelect: (id: ElementId) => void;
}) {
  const canopy = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  const vitality = Math.min(1, (soil / 100 + light / 100) / 1.2);
  useEffect(() => {
    if (canopy.current) {
      canopy.current.rotation.z = (1 - vitality) * 0.16;
      canopy.current.scale.setScalar(0.92 + vitality * 0.08);
    }
  }, [vitality]);
  useFrame((_, delta) => {
    if (!animate || !canopy.current) return;
    elapsed.current += Math.min(delta, 0.05);
    canopy.current.rotation.z =
      (1 - vitality) * 0.16 + Math.sin(elapsed.current * 0.65) * 0.022;
    canopy.current.rotation.x = Math.cos(elapsed.current * 0.43) * 0.013;
  });
  const stems = useMemo<V3[][]>(
    () => [
      [
        [0, 1.5, 0],
        [0.04, 2.1, 0.02],
        [-0.05, 2.9, 0.01],
        [0.04, 3.6, 0],
        [-0.06, 4.2, 0.02],
      ],
      [
        [0, 1.55, 0],
        [-0.22, 2.1, -0.05],
        [-0.4, 2.8, -0.12],
        [-0.44, 3.25, -0.15],
      ],
      [
        [0, 1.6, 0],
        [0.23, 2.25, 0.02],
        [0.49, 2.8, 0.1],
      ],
    ],
    [],
  );
  const rootPaths = useMemo<V3[][]>(
    () =>
      Array.from({ length: 12 }, (_, index) => {
        const angle = (index / 12) * Math.PI * 2;
        return [
          [0, 1.53, 0],
          [Math.cos(angle) * 0.24, 1.1, Math.sin(angle) * 0.24],
          [Math.cos(angle + 0.2) * 0.58, 0.65, Math.sin(angle + 0.2) * 0.58],
          [
            Math.cos(angle - 0.2) * 0.66,
            0.18 + (index % 3) * 0.07,
            Math.sin(angle - 0.2) * 0.66,
          ],
        ];
      }),
    [],
  );
  return (
    <group
      onPointerOver={(event) => sceneCursor(event, true)}
      onPointerOut={(event) => sceneCursor(event, false)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect("plant");
      }}
    >
      <mesh position={[0, 0.8, 0]}>
        <cylinderGeometry args={[1.1, 0.78, 1.55, 56, 1, true]} />
        <meshStandardMaterial
          color="#c68058"
          transparent={roots}
          opacity={roots ? 0.19 : 1}
          depthWrite={!roots}
          roughness={0.65}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.12, 0]}>
        <cylinderGeometry args={[0.82, 0.78, 0.13, 48]} />
        <meshStandardMaterial color="#a76448" roughness={0.8} />
      </mesh>
      <mesh position={[0, 1.56, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.06, 0.085, 12, 56]} />
        <meshStandardMaterial color="#e7a47a" roughness={0.62} />
      </mesh>
      <mesh position={[0, 1.51, 0]}>
        <cylinderGeometry args={[1.01, 1.01, 0.11, 48]} />
        <meshStandardMaterial
          color={soil > 50 ? "#292720" : "#675442"}
          transparent={roots}
          opacity={roots ? 0.48 : 1}
          roughness={1}
        />
      </mesh>
      {rootPaths.map((points, index) => (
        <group key={index}>
          <Tube
            points={points}
            radius={index % 3 === 0 ? 0.033 : 0.021}
            color="#e4bf83"
          />
          <Tube
            points={[
              points[2],
              [points[2][0] + 0.17 * Math.cos(index), 0.43, points[2][2] + 0.1],
              [
                points[2][0] + 0.23 * Math.cos(index),
                0.27,
                points[2][2] + 0.18,
              ],
            ]}
            radius={0.012}
            color="#e4bf83"
          />
        </group>
      ))}
      <group ref={canopy}>
        {stems.map((points, index) => (
          <Tube
            key={index}
            points={points}
            radius={index ? 0.034 : 0.055}
            color="#4e7e44"
          />
        ))}
        <LeafBlade
          position={[0.02, 2.25, 0]}
          rotation={[0.35, 0.3, -0.96]}
          length={1.38}
          width={0.37}
          color="#65ad68"
        />
        <LeafBlade
          position={[-0.02, 2.65, 0.01]}
          rotation={[-0.2, 2.4, 0.92]}
          length={1.5}
          width={0.44}
          color="#96ce79"
        />
        <LeafBlade
          position={[0, 3.22, 0.02]}
          rotation={[0.45, -0.5, -0.89]}
          length={1.36}
          width={0.34}
          color="#76ba69"
        />
        <LeafBlade
          position={[0, 3.57, 0]}
          rotation={[0.3, 2.6, 0.65]}
          length={1.2}
          width={0.31}
          color="#aedb83"
        />
        <LeafBlade
          position={[-0.04, 4.02, 0.02]}
          rotation={[0.12, -0.3, -0.28]}
          length={0.76}
          width={0.24}
          color="#c4e997"
        />
        <LeafBlade
          position={[-0.38, 2.9, -0.12]}
          rotation={[0.4, 1.6, 0.9]}
          length={1.13}
          width={0.3}
          color="#5ba865"
        />
        <LeafBlade
          position={[0.47, 2.76, 0.1]}
          rotation={[0.3, -0.7, -0.88]}
          length={1.15}
          width={0.34}
          color="#83c175"
        />
      </group>
      {selected && (
        <Html center position={[0, 1.8, 1.15]}>
          <span className="rdx-world-tag">Planta</span>
        </Html>
      )}
    </group>
  );
}

function HeroPico({
  onSelect,
  board,
  selected,
}: {
  onSelect: (id: ElementId) => void;
  board: Board;
  selected: boolean;
}) {
  const arduino = board !== "pico";
  const uno = board === "uno";
  return (
    <group
      position={[-2.03, 0.18, 0.7]}
      rotation={[0, -0.22, 0]}
      onPointerOver={(event) => sceneCursor(event, true)}
      onPointerOut={(event) => sceneCursor(event, false)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect("pico");
      }}
    >
      <mesh>
        <boxGeometry args={[1.55, 0.17, 1.08]} />
        <meshStandardMaterial color="#f6f0d8" roughness={0.58} />
      </mesh>
      {Array.from({ length: 11 }, (_, x) =>
        Array.from({ length: 5 }, (_, z) => (
          <mesh
            key={`${x}-${z}`}
            position={[-0.68 + x * 0.13, 0.093, -0.4 + z * 0.19]}
          >
            <boxGeometry args={[0.039, 0.016, 0.04]} />
            <meshStandardMaterial color="#7d8475" />
          </mesh>
        )),
      )}
      <mesh position={[-0.22, 0.18, -0.08]}>
        <boxGeometry args={[uno ? 1.18 : 0.92, 0.08, uno ? 0.76 : 0.48]} />
        <meshStandardMaterial
          color={arduino ? "#208a98" : "#227b57"}
          metalness={0.13}
          roughness={0.48}
        />
      </mesh>
      <mesh position={[-0.24, 0.24, -0.08]}>
        <boxGeometry args={[uno ? 0.54 : 0.25, 0.07, uno ? 0.15 : 0.24]} />
        <meshStandardMaterial color="#1c2524" />
      </mesh>
      <mesh position={[-0.64, 0.24, -0.08]}>
        <boxGeometry
          args={[uno ? 0.27 : 0.19, uno ? 0.23 : 0.12, uno ? 0.28 : 0.23]}
        />
        <meshStandardMaterial
          color="#b9c6bd"
          metalness={0.7}
          roughness={0.22}
        />
      </mesh>
      {[-1, 1].flatMap((side) =>
        Array.from({ length: 10 }, (_, index) => (
          <mesh
            key={`${side}-${index}`}
            position={[
              -0.59 + index * 0.075,
              0.23,
              -0.08 + side * (uno ? 0.34 : 0.2),
            ]}
          >
            <boxGeometry args={[0.036, 0.09, 0.045]} />
            <meshStandardMaterial
              color={uno ? "#293b39" : "#d9ba64"}
              metalness={0.65}
              roughness={0.25}
            />
          </mesh>
        )),
      )}
      {selected && (
        <Html center position={[0, 0.08, 0.78]}>
          <span className="rdx-world-tag">
            {board === "pico"
              ? "Pico W"
              : board === "uno"
                ? "Arduino Uno"
                : "Arduino Nano"}
          </span>
        </Html>
      )}
    </group>
  );
}

function Network({
  animate,
  onSelect,
  pulse,
  selected,
}: {
  animate: boolean;
  onSelect: (id: ElementId) => void;
  pulse: number;
  selected: boolean;
}) {
  const paths = useMemo<V3[][]>(
    () => [
      [
        [0.65, 1.78, 0.3],
        [0.2, 1.72, 1],
        [-1.2, 0.62, 1.1],
        [-1.95, 0.43, 0.75],
      ],
      [
        [-1.95, 0.45, 0.7],
        [-1.6, 1.9, -0.6],
        [0.7, 2.48, -1.3],
        [2.1, 2.2, -0.5],
      ],
      [
        [2.1, 2.2, -0.5],
        [2.47, 1.45, -0.12],
        [2.3, 0.95, 0.58],
      ],
    ],
    [],
  );
  return (
    <group>
      {paths.map((points, index) => (
        <group key={index}>
          <Tube
            points={points}
            radius={0.019}
            color={index ? "#73d9d0" : "#d6f96c"}
            opacity={0.45}
            emissive
          />
          <MovingSignal
            key={pulse}
            points={points}
            animate={animate}
            count={pulse ? 5 : 2}
            color={index ? "#91e5df" : "#d6f96c"}
            size={0.045}
          />
        </group>
      ))}
      <group
        position={[2.1, 2.2, -0.5]}
        onPointerOver={(event) => sceneCursor(event, true)}
        onPointerOut={(event) => sceneCursor(event, false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect("network");
        }}
      >
        <mesh>
          <octahedronGeometry args={[0.25, 0]} />
          <meshStandardMaterial
            color="#80dcd3"
            emissive="#439c93"
            emissiveIntensity={0.5}
            metalness={0.48}
            roughness={0.25}
          />
        </mesh>
        {[0.42, 0.62, 0.82].map((radius, index) => (
          <mesh key={radius} rotation={[0, 0.4, 0.15]}>
            <torusGeometry args={[radius, 0.011, 6, 60, Math.PI * 1.55]} />
            <meshBasicMaterial
              color="#89dad0"
              transparent
              opacity={0.47 - index * 0.08}
            />
          </mesh>
        ))}
        {selected && (
          <Html center position={[0, 0.85, 0]}>
            <span className="rdx-world-tag">Wi-Fi</span>
          </Html>
        )}
      </group>
      <group
        position={[2.3, 0.9, 0.58]}
        rotation={[0, -0.5, 0]}
        onPointerOver={(event) => sceneCursor(event, true)}
        onPointerOut={(event) => sceneCursor(event, false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect("network");
        }}
      >
        <mesh>
          <boxGeometry args={[0.75, 0.12, 0.5]} />
          <meshStandardMaterial color="#284c40" roughness={0.55} />
        </mesh>
        {[0, 1, 2, 3].map((index) => (
          <mesh
            key={index}
            position={[-0.23 + index * 0.15, 0.1 + index * 0.035, 0]}
          >
            <boxGeometry args={[0.08, 0.08 + index * 0.07, 0.12]} />
            <meshStandardMaterial
              color={index > 1 ? "#d6f96c" : "#75d3c4"}
              emissive="#254b3a"
            />
          </mesh>
        ))}
        {selected && (
          <Html center position={[0, -0.03, 0.52]}>
            <span className="rdx-world-tag">Dashboard</span>
          </Html>
        )}
      </group>
    </group>
  );
}

function StationLed({
  on,
  onSelect,
  selected,
}: {
  on: boolean;
  onSelect: (id: ElementId) => void;
  selected: boolean;
}) {
  return (
    <group
      position={[-1.05, 0.38, 1.15]}
      onPointerOver={(event) => sceneCursor(event, true)}
      onPointerOut={(event) => sceneCursor(event, false)}
      onClick={(event) => {
        event.stopPropagation();
        onSelect("led");
      }}
    >
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.058, -0.04, 0]}>
          <cylinderGeometry args={[0.014, 0.014, 0.3, 6]} />
          <meshStandardMaterial color="#c9d2bb" metalness={0.7} />
        </mesh>
      ))}
      <mesh position={[0, 0.16, 0]}>
        <capsuleGeometry args={[0.11, 0.16, 4, 12]} />
        <meshStandardMaterial
          color={on ? "#e7fb73" : "#859547"}
          emissive="#d6f96c"
          emissiveIntensity={on ? 2 : 0}
          roughness={0.3}
        />
      </mesh>
      {on && (
        <pointLight
          position={[0, 0.3, 0]}
          color="#d6f96c"
          intensity={1.4}
          distance={2.5}
        />
      )}
      {selected && (
        <Html center position={[0, 0.62, 0]}>
          <span className={`rdx-world-tag ${on ? "rdx-world-tag--on" : ""}`}>
            LED · {on ? "encendido" : "tócame"}
          </span>
        </Html>
      )}
    </group>
  );
}

function SolarSeeds({ animate, light }: { animate: boolean; light: number }) {
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!animate || !group.current) return;
    elapsed.current += Math.min(delta, 0.05);
    group.current.rotation.y = elapsed.current * 0.035;
    group.current.children.forEach((seed, index) => {
      seed.position.y =
        1.2 +
        (index % 4) * 0.7 +
        Math.sin(elapsed.current * 0.4 + index) * 0.16;
    });
  });
  return (
    <group ref={group}>
      {Array.from({ length: 12 }, (_, index) => (
        <mesh
          key={index}
          position={[
            Math.cos(index * 2.4) * 2.7,
            1.2 + (index % 4) * 0.7,
            Math.sin(index * 2.4) * 2.3,
          ]}
        >
          <sphereGeometry args={[0.025 + (index % 3) * 0.007, 6, 6]} />
          <meshBasicMaterial
            color="#f3d56a"
            transparent
            opacity={0.2 + light / 180}
          />
        </mesh>
      ))}
    </group>
  );
}

function LivingWorld({
  animate,
  roots,
  onSelect,
  action,
  selected,
  soil,
  light,
  led,
  pulse,
  board,
}: {
  animate: boolean;
  roots: boolean;
  onSelect: (id: ElementId) => void;
  action: CameraAction;
  selected: ElementId;
  soil: number;
  light: number;
  led: boolean;
  pulse: number;
  board: Board;
}) {
  return (
    <>
      <ambientLight intensity={1.4} />
      <hemisphereLight args={["#e4f5da", "#173b33", 1.7]} />
      <directionalLight
        position={[-4, 8, 5]}
        intensity={1.1 + light / 32}
        color="#fff0cc"
      />
      <directionalLight position={[4, 4, -4]} intensity={2.8} color="#73d9d0" />
      <mesh position={[0, -0.08, 0]}>
        <cylinderGeometry args={[3.45, 3.7, 0.17, 80]} />
        <meshStandardMaterial
          color="#1e493d"
          roughness={0.82}
          metalness={0.08}
        />
      </mesh>
      {[2.8, 3.1, 3.4].map((radius) => (
        <mesh
          key={radius}
          position={[0, 0.018, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry args={[radius, 0.006, 4, 100]} />
          <meshBasicMaterial color="#5b8170" transparent opacity={0.36} />
        </mesh>
      ))}
      <Plant
        animate={animate}
        roots={roots}
        soil={soil}
        light={light}
        selected={selected === "plant"}
        onSelect={onSelect}
      />
      <SolarSeeds animate={animate} light={light} />
      <group
        position={[0.68, 1.59, 0.29]}
        rotation={[0, -0.5, -0.1]}
        onPointerOver={(event) => sceneCursor(event, true)}
        onPointerOut={(event) => sceneCursor(event, false)}
        onClick={(event) => {
          event.stopPropagation();
          onSelect("sensor");
        }}
      >
        <mesh>
          <boxGeometry args={[0.16, 1.05, 0.04]} />
          <meshStandardMaterial color="#2f7850" roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.39, 0.025]}>
          <boxGeometry args={[0.21, 0.31, 0.04]} />
          <meshStandardMaterial color="#254336" roughness={0.5} />
        </mesh>
        {selected === "sensor" && (
          <Html center position={[0.36, 0.4, 0.2]}>
            <span className="rdx-world-tag">Sensor</span>
          </Html>
        )}
      </group>
      <HeroPico
        onSelect={onSelect}
        board={board}
        selected={selected === "pico"}
      />
      <StationLed on={led} onSelect={onSelect} selected={selected === "led"} />
      <Network
        animate={animate}
        onSelect={onSelect}
        pulse={pulse}
        selected={selected === "network"}
      />
      <mesh
        position={[FOCUS[selected].target[0], 0.025, FOCUS[selected].target[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry
          args={[
            selected === "plant" ? 1.25 : 0.42,
            selected === "plant" ? 1.3 : 0.46,
            48,
          ]}
        />
        <meshBasicMaterial
          color="#d6f96c"
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
      <SceneCamera
        action={action}
        target={[0, 2.1, 0]}
        home={[6, 4.7, 7.2]}
        maxDistance={18}
        bounds={{ min: [-3.1, 0, -1.5], max: [3.1, 4.8, 1.7] }}
        enablePan
      />
    </>
  );
}

export interface LivingStationProps {
  className?: string;
  mode?: "hero" | "explore";
  board?: Board;
  /** Soil and light are percentages; omitted values remain unreported. */
  readings?: {
    soil?: number;
    light?: number;
    led?: boolean;
    source: "hardware" | "simulation";
  };
}

export function LivingStation({
  className = "",
  mode = "hero",
  board = "pico",
  readings,
}: LivingStationProps) {
  const reference = useRef<HTMLElement>(null);
  const active = useSceneActive(reference);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false),
    [roots, setRoots] = useState(false);
  const [selected, setSelected] = useState<ElementId>("plant");
  const [visited, setVisited] = useState<ElementId[]>([]);
  const [soil, setSoil] = useState(45);
  const [light, setLight] = useState(70);
  const [led, setLed] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [action, setAction] = useState<CameraAction>({
    type: "reset",
    sequence: 0,
  });
  const animate = !paused && !reduced && active;
  const selection = ELEMENTS.find((element) => element.id === selected)!;
  const selectedTitle =
    selected === "pico"
      ? `${BOARD_NAMES[board]} · aquí vive tu código`
      : selection.title;
  const clamp = (value: number | undefined, fallback: number) =>
    value !== undefined && Number.isFinite(value)
      ? Math.max(0, Math.min(100, value))
      : fallback;
  const soilValue = readings ? clamp(readings.soil, 50) : soil;
  const lightValue = readings ? clamp(readings.light, 50) : light;
  const ledValue = readings ? readings.led === true : led;
  const sourceLabel = readings
    ? readings.source === "hardware"
      ? "Lecturas de tu estación"
      : "Simulación del dashboard"
    : "Exploración 3D";
  const camera = (type: CameraAction["type"]) =>
    setAction((current) => ({ type, sequence: current.sequence + 1 }));
  const select = (id: ElementId) => {
    setSelected(id);
    setVisited((current) =>
      current.includes(id) ? current : [...current, id],
    );
    setFeedback("");
    setAction((current) => ({
      type: "focus",
      sequence: current.sequence + 1,
      focusTarget: FOCUS[id].target,
      focusPosition: FOCUS[id].position,
    }));
  };
  const touchModel = (id: ElementId) => {
    select(id);
    if (id === "led" && !readings) {
      setLed((current) => !current);
      setFeedback(
        led
          ? "LED apagado · vuelve a tocarlo para encenderlo."
          : "¡Encendido! Tu primer gesto se convirtió en una acción.",
      );
    }
  };
  const sendSignal = () => {
    setPulse((value) => value + 1);
    setFeedback(`Dato de exploración enviado: humedad ${soil}% → placa → red.`);
  };
  return (
    <section
      ref={reference}
      className={`rdx-living rdx-living--${mode} ${className}`}
      aria-label="Estación de planta en 3D: toca y descubre sus partes"
    >
      <div className="rdx-scene-eyebrow">
        <span /> {sourceLabel}
      </div>
      <div className="rdx-living-canvas">
        <SafeCanvas
          dpr={[1, 1.6]}
          frameloop={animate ? "always" : "demand"}
          camera={{ position: [6, 4.7, 7.2], fov: 41 }}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          fallback={
            <div className="rdx-fallback">
              <Sprout size={52} />
              <strong>Tu estación sigue siendo interactiva</strong>
              <div
                className="rdx-flat-station"
                aria-label="Representación de la planta y su placa"
              >
                <Sprout
                  className="rdx-flat-plant"
                  size={100}
                  style={{ transform: `rotate(${(50 - soilValue) / 10}deg)` }}
                />
                <span
                  className={`rdx-flat-led ${ledValue ? "rdx-flat-led--on" : ""}`}
                >
                  <Lightbulb size={28} />
                </span>
                <Cpu size={42} />
                <Radio size={35} />
              </div>
              <p>
                Toca una parte o mueve los controles de abajo para explorarla.
              </p>
            </div>
          }
        >
          <Suspense fallback={null}>
            <LivingWorld
              animate={animate}
              roots={roots}
              onSelect={touchModel}
              action={action}
              selected={selected}
              soil={soilValue}
              light={lightValue}
              led={ledValue}
              pulse={pulse}
              board={board}
            />
          </Suspense>
        </SafeCanvas>
      </div>
      <div className="rdx-scene-tools" aria-label="Controles de la vista 3D">
        <button
          onClick={() => setRoots((value) => !value)}
          aria-pressed={roots}
          title="Ver las raíces a través de la maceta"
          aria-label="Ver raíces de la planta"
        >
          <Sprout size={17} />
          <span>Raíces</span>
        </button>
        <button
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused || reduced}
          aria-label={
            reduced
              ? "Animación pausada por tu preferencia de movimiento"
              : paused
                ? "Reanudar animación"
                : "Pausar animación"
          }
          disabled={reduced}
        >
          {paused || reduced ? <Play size={17} /> : <Pause size={17} />}
        </button>
        <button
          onClick={() => camera("zoom-in")}
          aria-label="Acercar la estación"
        >
          <ZoomIn size={17} />
        </button>
        <button
          onClick={() => camera("zoom-out")}
          aria-label="Alejar la estación"
        >
          <ZoomOut size={17} />
        </button>
        <button
          onClick={() => camera("reset")}
          aria-label="Restablecer vista de la estación"
        >
          <RotateCcw size={17} />
        </button>
      </div>
      <div className="rdx-living-info">
        <div className="rdx-discovery-hint">
          <span>
            <MousePointer2 size={14} /> Toca una parte · arrastra para girar
          </span>
          {!readings && (
            <span aria-label={`${visited.length} de 5 partes descubiertas`}>
              {visited.length}/5 descubiertas
            </span>
          )}
        </div>
        <div
          className="rdx-element-tabs"
          aria-label="Explora las partes de la estación"
        >
          {ELEMENTS.map((element) => (
            <button
              key={element.id}
              onClick={() => select(element.id)}
              aria-pressed={selected === element.id}
              aria-label={
                element.id === "pico"
                  ? board === "pico"
                    ? "Pico W"
                    : "Arduino"
                  : element.short
              }
            >
              <element.icon size={15} />
              {element.id === "pico"
                ? board === "pico"
                  ? "Pico W"
                  : "Arduino"
                : element.short}
              {visited.includes(element.id) && (
                <Check size={12} aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
        <div className="rdx-selection" aria-live="polite">
          <strong>{selectedTitle}</strong>
          <p>
            {readings
              ? selected === "sensor" || selected === "plant"
                ? readings.soil !== undefined
                  ? `Humedad de tu estación: ${Math.round(readings.soil)}%.`
                  : "El próximo dato de humedad aparecerá aquí."
                : selected === "led"
                  ? readings.led !== undefined
                    ? `LED de tu estación: ${readings.led ? "encendido" : "apagado"}.`
                    : "Explora la luz que controlarás desde tu código."
                  : selection.text
              : selection.text}
          </p>
        </div>
        {!readings && (
          <div className="rdx-experiment-controls">
            {(selected === "plant" || selected === "sensor") && (
              <>
                <label className="rdx-world-range">
                  <Droplets size={16} />
                  <span>Humedad</span>
                  <input
                    aria-label="Humedad de la exploración"
                    type="range"
                    min="0"
                    max="100"
                    value={soil}
                    onChange={(event) => {
                      setSoil(Number(event.target.value));
                      setFeedback(
                        "La humedad cambia → el sensor cambia su señal.",
                      );
                    }}
                  />
                  <output>{soil}%</output>
                </label>
                {selected === "plant" && (
                  <label className="rdx-world-range">
                    <Sun size={16} />
                    <span>Luz</span>
                    <input
                      aria-label="Luz de la exploración"
                      type="range"
                      min="0"
                      max="100"
                      value={light}
                      onChange={(event) => {
                        setLight(Number(event.target.value));
                        setFeedback(
                          "La escena responde a la luz. En tu estación la medirá un sensor.",
                        );
                      }}
                    />
                    <output>{light}%</output>
                  </label>
                )}
              </>
            )}
            {selected === "led" && (
              <button
                className="rdx-world-action"
                onClick={() => {
                  setLed((current) => !current);
                  setFeedback(
                    led
                      ? "LED apagado."
                      : "¡LED encendido! Una salida convierte tu código en una acción.",
                  );
                }}
              >
                <Lightbulb size={17} /> {led ? "Apagar LED" : "Encender LED"}
              </button>
            )}
            {(selected === "pico" || selected === "network") && (
              <button className="rdx-world-action" onClick={sendSignal}>
                <Zap size={17} /> Enviar una señal
              </button>
            )}
          </div>
        )}
        <div className="rdx-world-feedback" role="status">
          {feedback ||
            (!readings && visited.length === ELEMENTS.length
              ? "¡Estación descubierta! Ahora construirás la tuya, paso a paso."
              : "")}
        </div>
        <span className="rdx-model-note">
          {readings ? sourceLabel : "Modelo de exploración"}
        </span>
      </div>
    </section>
  );
}

export default LivingStation;
