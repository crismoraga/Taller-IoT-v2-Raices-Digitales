import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
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
} from "lucide-react";
import * as THREE from "three";
import { MovingSignal, Tube, type V3 } from "./Primitives";
import {
  SafeCanvas,
  SceneCamera,
  useReducedMotion,
  useSceneActive,
  type CameraAction,
} from "./SceneSupport";
import "./experience.css";

type ElementId = "plant" | "sensor" | "pico" | "network";
const ELEMENTS: {
  id: ElementId;
  title: string;
  short: string;
  text: string;
  icon: typeof Leaf;
}[] = [
  {
    id: "plant",
    title: "La vida es el punto de partida",
    short: "Planta",
    text: "Una planta viva necesita agua, luz y una temperatura adecuada. Tú vas a transformar esas condiciones en información.",
    icon: Leaf,
  },
  {
    id: "sensor",
    title: "De humedad a una señal",
    short: "Sensor",
    text: "La sonda capacitiva se introduce en el sustrato, hasta la zona de medición. Su electrónica y conector siempre quedan secos.",
    icon: Droplets,
  },
  {
    id: "pico",
    title: "Una pequeña computadora",
    short: "Pico W",
    text: "La Pico convierte la señal del sensor en una lectura y ejecuta el código que tú escribes. El USB permite programarla desde el navegador.",
    icon: Cpu,
  },
  {
    id: "network",
    title: "Tu planta tiene algo que contar",
    short: "Red",
    text: "Con Wi-Fi y HTTPS, la estación puede enviar lecturas al servidor. El dashboard muestra datos reales cuando conectas tu hardware.",
    icon: Radio,
  },
];

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
  onSelect,
}: {
  animate: boolean;
  roots: boolean;
  onSelect: (id: ElementId) => void;
}) {
  const canopy = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!animate || !canopy.current) return;
    elapsed.current += Math.min(delta, 0.05);
    canopy.current.rotation.z = Math.sin(elapsed.current * 0.65) * 0.022;
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
          color="#352d22"
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
    </group>
  );
}

function HeroPico({ onSelect }: { onSelect: (id: ElementId) => void }) {
  return (
    <group
      position={[-2.03, 0.18, 0.7]}
      rotation={[0, -0.22, 0]}
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
        <boxGeometry args={[0.92, 0.08, 0.48]} />
        <meshStandardMaterial
          color="#227b57"
          metalness={0.13}
          roughness={0.48}
        />
      </mesh>
      <mesh position={[-0.24, 0.24, -0.08]}>
        <boxGeometry args={[0.25, 0.07, 0.24]} />
        <meshStandardMaterial color="#1c2524" />
      </mesh>
      <mesh position={[-0.64, 0.24, -0.08]}>
        <boxGeometry args={[0.19, 0.12, 0.23]} />
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
            position={[-0.59 + index * 0.075, 0.23, -0.08 + side * 0.2]}
          >
            <boxGeometry args={[0.036, 0.09, 0.045]} />
            <meshStandardMaterial
              color="#d9ba64"
              metalness={0.65}
              roughness={0.25}
            />
          </mesh>
        )),
      )}
      <Html center position={[0, 0.08, 0.78]}>
        <span className="rdx-world-tag">Pico W · el código</span>
      </Html>
    </group>
  );
}

function Network({
  animate,
  onSelect,
}: {
  animate: boolean;
  onSelect: (id: ElementId) => void;
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
            points={points}
            animate={animate}
            count={3}
            color={index ? "#91e5df" : "#d6f96c"}
            size={0.045}
          />
        </group>
      ))}
      <group
        position={[2.1, 2.2, -0.5]}
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
        <Html center position={[0, 0.85, 0]}>
          <span className="rdx-world-tag">Wi-Fi · la conexión</span>
        </Html>
      </group>
      <group
        position={[2.3, 0.9, 0.58]}
        rotation={[0, -0.5, 0]}
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
        <Html center position={[0, -0.03, 0.52]}>
          <span className="rdx-world-tag">Datos · tu dashboard</span>
        </Html>
      </group>
    </group>
  );
}

function LivingWorld({
  animate,
  roots,
  onSelect,
  action,
}: {
  animate: boolean;
  roots: boolean;
  onSelect: (id: ElementId) => void;
  action: CameraAction;
}) {
  return (
    <>
      <ambientLight intensity={1.4} />
      <hemisphereLight args={["#e4f5da", "#173b33", 1.7]} />
      <directionalLight position={[-4, 8, 5]} intensity={3.2} color="#fff0cc" />
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
      <Plant animate={animate} roots={roots} onSelect={onSelect} />
      <group
        position={[0.68, 1.59, 0.29]}
        rotation={[0, -0.5, -0.1]}
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
        <Html center position={[0.36, 0.4, 0.2]}>
          <span className="rdx-world-tag">Sensor · la señal</span>
        </Html>
      </group>
      <HeroPico onSelect={onSelect} />
      <Network animate={animate} onSelect={onSelect} />
      <SceneCamera
        action={action}
        target={[0, 2.1, 0]}
        home={[6, 4.7, 7.2]}
        maxDistance={14}
      />
    </>
  );
}

export interface LivingStationProps {
  className?: string;
  mode?: "hero" | "explore";
}

export function LivingStation({
  className = "",
  mode = "hero",
}: LivingStationProps) {
  const reference = useRef<HTMLElement>(null);
  const active = useSceneActive(reference);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false),
    [roots, setRoots] = useState(false);
  const [selected, setSelected] = useState<ElementId>("plant");
  const [action, setAction] = useState<CameraAction>({
    type: "reset",
    sequence: 0,
  });
  const animate = !paused && !reduced && active;
  const selection = ELEMENTS.find((element) => element.id === selected)!;
  const camera = (type: CameraAction["type"]) =>
    setAction((current) => ({ type, sequence: current.sequence + 1 }));
  return (
    <section
      ref={reference}
      className={`rdx-living rdx-living--${mode} ${className}`}
      aria-label="Estación de planta en 3D: explora sus cuatro partes"
    >
      <div className="rdx-scene-eyebrow">
        <span /> Naturaleza × tecnología
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
              <strong>Tu planta, conectada al mundo</strong>
              <p>
                El render 3D necesita WebGL. Puedes explorar cada parte con los
                controles de abajo y seguir usando todas las actividades.
              </p>
            </div>
          }
        >
          <Suspense fallback={null}>
            <LivingWorld
              animate={animate}
              roots={roots}
              onSelect={setSelected}
              action={action}
            />
          </Suspense>
        </SafeCanvas>
      </div>
      <div className="rdx-scene-tools" aria-label="Controles de la vista 3D">
        <button
          onClick={() => setRoots((value) => !value)}
          aria-pressed={roots}
          title="Ver las raíces a través de la maceta"
        >
          <Sprout size={17} />
          <span>Raíces</span>
        </button>
        <button
          onClick={() => setPaused((value) => !value)}
          aria-pressed={paused || reduced}
          aria-label={paused ? "Reanudar animación" : "Pausar animación"}
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
        <div
          className="rdx-element-tabs"
          aria-label="Explora las partes de la estación"
        >
          {ELEMENTS.map((element) => (
            <button
              key={element.id}
              onClick={() => setSelected(element.id)}
              aria-pressed={selected === element.id}
            >
              <element.icon size={15} />
              {element.short}
            </button>
          ))}
        </div>
        <div className="rdx-selection" aria-live="polite">
          <strong>{selection.title}</strong>
          <p>{selection.text}</p>
        </div>
        <span className="rdx-model-note">
          Modelo educativo · el flujo animado ilustra información, no lecturas
          de una planta conectada.
        </span>
      </div>
    </section>
  );
}

export default LivingStation;
