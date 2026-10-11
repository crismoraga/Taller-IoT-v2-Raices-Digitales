import {
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Box,
  Pause,
  Play,
  RotateCcw,
  ScanLine,
  Sparkles,
  Crosshair,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import * as THREE from "three";
import {
  BOARD,
  COLUMNS,
  LETTERS,
  RAIL_COLUMNS,
  describePoint,
  isPoint,
  pointXY,
  shortPoint,
  stripOf,
  type RailName,
} from "../circuit/breadboard";
import { BreadboardView } from "../circuit/BreadboardView";
import { layoutCallouts } from "../circuit/calloutLayout";
import {
  bodyOutline,
  endpointXY,
  moduleBox,
  type XY,
} from "../circuit/geometry";
import {
  WIRE_HEX,
  resistorBands,
  type Circuit,
  type PartInstance,
  type Wire,
} from "../circuit/model";
import { partDef } from "../circuit/parts";
import { PICO_PINS, picoPinForStrip } from "../circuit/pico";
import {
  BoardText,
  CylinderBetween,
  MovingSignal,
  Tube,
  type V3,
} from "./Primitives";
import {
  SafeCanvas,
  SceneHtml as Html,
  SceneCamera,
  useReducedMotion,
  useSceneActive,
  type CameraAction,
  type SceneBounds,
} from "./SceneSupport";
import "./experience.css";

const U = 0.13;
const position = (point: XY, height = 0.13): V3 => [
  (point.x - BOARD.width / 2) * U,
  height,
  (point.y - 8.5) * U,
];
const atHole = (hole: string, height = 0.13) => position(pointXY(hole), height);
interface Selection {
  title: string;
  text: string;
  detail?: string;
  terminals?: string[];
}

function Breadboard() {
  const holes = useRef<THREE.InstancedMesh>(null);
  const points = useMemo(
    () => [
      ...Array.from({ length: COLUMNS }, (_, index) =>
        LETTERS.map((letter) => `${letter}${index + 1}`),
      ).flat(),
      ...(["tp", "tn", "bp", "bn"] as RailName[]).flatMap((rail) =>
        RAIL_COLUMNS.map((column) => `${rail}:${column}`),
      ),
    ],
    [],
  );
  useLayoutEffect(() => {
    if (!holes.current) return;
    const object = new THREE.Object3D();
    points.forEach((point, index) => {
      object.position.set(...atHole(point, 0.115));
      object.updateMatrix();
      holes.current!.setMatrixAt(index, object.matrix);
    });
    holes.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  return (
    <group>
      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[BOARD.width * U, 0.2, 19.5 * U]} />
        <meshStandardMaterial color="#f4ecda" roughness={0.72} />
      </mesh>
      <mesh position={[0, 0.105, 0]}>
        <boxGeometry args={[64 * U, 0.009, 2 * U]} />
        <meshStandardMaterial color="#d4cbbb" roughness={0.85} />
      </mesh>
      <instancedMesh ref={holes} args={[undefined, undefined, points.length]}>
        <boxGeometry args={[0.049, 0.012, 0.049]} />
        <meshStandardMaterial color="#546057" roughness={0.6} />
      </instancedMesh>
      {[
        { y: -0.47, color: "#d64545" },
        { y: 1.47, color: "#3e8fd0" },
        { y: 15.45, color: "#d64545" },
        { y: 17.48, color: "#3e8fd0" },
      ].map((rail) => (
        <mesh key={rail.y} position={position({ x: 33, y: rail.y }, 0.118)}>
          <boxGeometry args={[62 * U, 0.004, 0.019]} />
          <meshBasicMaterial color={rail.color} />
        </mesh>
      ))}
      {Array.from({ length: COLUMNS }, (_, index) => index + 1)
        .filter((column) => column === 1 || column === 63 || column % 5 === 0)
        .flatMap((column) =>
          [2, 15].map((y) => (
            <BoardText
              key={`${column}-${y}`}
              position={position({ x: BOARD.x0 + column - 1, y }, 0.126)}
              size={0.092}
            >{`${column}`}</BoardText>
          )),
        )}
      {LETTERS.flatMap((letter) =>
        [0.75, 65].map((x) => (
          <BoardText
            key={`${letter}-${x}`}
            position={position({ x, y: pointXY(`${letter}1`).y }, 0.128)}
            size={0.1}
          >
            {letter}
          </BoardText>
        )),
      )}
      {[
        { label: "+", y: 0, color: "#bd4845" },
        { label: "−", y: 1, color: "#3e8fd0" },
        { label: "+", y: 16, color: "#bd4845" },
        { label: "−", y: 17, color: "#3e8fd0" },
      ].map((rail) => (
        <BoardText
          key={rail.y}
          position={position({ x: 1, y: rail.y }, 0.128)}
          size={0.13}
          color={rail.color}
        >
          {rail.label}
        </BoardText>
      ))}
    </group>
  );
}

function Pico({ select }: { select: (selection: Selection) => void }) {
  return (
    <group>
      <mesh
        position={position({ x: 11.5, y: 8.5 }, 0.22)}
        onClick={(event) => {
          event.stopPropagation();
          select({
            title: "Raspberry Pi Pico W",
            text: "El USB mira hacia el número 1, a la izquierda. Las dos filas de pines van en c y h, cruzando el canal central.",
            detail:
              "Un pin GP lleva una señal de 0 o 3,3 V. El número GP y el número físico de la pata son cosas distintas.",
          });
        }}
      >
        <boxGeometry args={[20.3 * U, 0.12, 6.5 * U]} />
        <meshStandardMaterial color="#247858" roughness={0.55} />
      </mesh>
      <mesh position={position({ x: 11, y: 8.5 }, 0.305)}>
        <boxGeometry args={[0.45, 0.08, 0.4]} />
        <meshStandardMaterial color="#222c2a" roughness={0.62} />
      </mesh>
      <mesh position={position({ x: 16.4, y: 8.5 }, 0.31)}>
        <boxGeometry args={[0.49, 0.085, 0.47]} />
        <meshStandardMaterial
          color="#a5b6ab"
          metalness={0.6}
          roughness={0.35}
        />
      </mesh>
      <mesh position={position({ x: 1.9, y: 8.5 }, 0.33)}>
        <boxGeometry args={[0.28, 0.16, 0.3]} />
        <meshStandardMaterial
          color="#b8c8c2"
          metalness={0.8}
          roughness={0.25}
        />
      </mesh>
      <BoardText
        position={position({ x: 6.6, y: 8.5 }, 0.296)}
        size={0.13}
        color="#eef7dc"
        width={0.66}
      >
        Pico W
      </BoardText>
      <BoardText
        position={position({ x: 1.1, y: 8.5 }, 0.425)}
        size={0.09}
        color="#304d43"
      >
        USB
      </BoardText>
      {PICO_PINS.map((pin) => (
        <group key={pin.physical}>
          <mesh
            position={atHole(pin.hole, 0.235)}
            onClick={(event) => {
              event.stopPropagation();
              select({
                title: `${pin.name} · pin físico ${pin.physical}`,
                text: pin.role,
                detail: `${pin.voltage}. ${pin.warning ?? ""}`,
                terminals: [pin.hole, ...pin.free],
              });
            }}
          >
            <boxGeometry args={[0.063, 0.26, 0.061]} />
            <meshStandardMaterial
              color={pin.kind === "gnd" ? "#738775" : "#d2ae55"}
              metalness={0.72}
              roughness={0.28}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function Resistor({ part, dim }: { part: PartInstance; dim: boolean }) {
  const holes = Object.values(part.holes ?? {});
  const start = atHole(holes[0], 0.15),
    end = atHole(holes[1], 0.15);
  const midpoint = new THREE.Vector3(...start)
    .add(new THREE.Vector3(...end))
    .multiplyScalar(0.5);
  const direction = new THREE.Vector3(...end).sub(new THREE.Vector3(...start));
  const length = direction.length();
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(1, 0, 0),
    direction.normalize(),
  );
  const bodyLength = Math.min(0.4, length * 0.58);
  return (
    <group>
      <CylinderBetween
        from={start}
        to={[start[0], 0.25, start[2]]}
        radius={0.011}
        color="#a9b7ad"
      />
      <CylinderBetween
        from={end}
        to={[end[0], 0.25, end[2]]}
        radius={0.011}
        color="#a9b7ad"
      />
      <group position={[midpoint.x, 0.25, midpoint.z]} quaternion={quaternion}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.012, 0.012, length, 8]} />
          <meshStandardMaterial color="#aab7ad" metalness={0.6} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.069, 0.069, bodyLength, 16]} />
          <meshStandardMaterial
            color={dim ? "#b7ac99" : "#d4bd8b"}
            roughness={0.6}
          />
        </mesh>
        {resistorBands(part.props?.ohms ?? 220).map((color, index) => (
          <mesh
            key={index}
            position={[(index - 1.5) * bodyLength * 0.21, 0, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <torusGeometry args={[0.0695, 0.011, 6, 16]} />
            <meshStandardMaterial color={color} roughness={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

function SensorBody({
  part,
  dim,
  flow,
}: {
  part: PartInstance;
  dim: boolean;
  flow: boolean;
}) {
  const definition = partDef(part);
  const holePositions = Object.values(part.holes ?? {}).map((hole) =>
    pointXY(hole),
  );
  const box = moduleBox(part);
  const center = holePositions.length
    ? {
        x:
          holePositions.reduce((sum, value) => sum + value.x, 0) /
          holePositions.length,
        y:
          holePositions.reduce((sum, value) => sum + value.y, 0) /
          holePositions.length,
      }
    : { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const pos = position(center, 0.31);
  const color = dim ? "#a7b5a0" : "#2f8463";
  if (part.type === "resistor") return <Resistor part={part} dim={dim} />;
  return (
    <>
      {Object.entries(part.holes ?? {}).map(([pin, hole]) => (
        <CylinderBetween
          key={pin}
          from={atHole(hole, 0.12)}
          to={[atHole(hole)[0], 0.3, atHole(hole)[2]]}
          radius={0.015}
          color="#b5bdb7"
        />
      ))}
      <group position={pos}>
        {part.type === "led" ? (
          <>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.125, 0.125, 0.19, 24]} />
              <meshStandardMaterial
                color={
                  part.props?.color === "azul"
                    ? "#4291d2"
                    : part.props?.color === "amarillo"
                      ? "#e7c239"
                      : "#e25842"
                }
                emissive={flow ? "#e84724" : "#000"}
                emissiveIntensity={flow ? 0.7 : 0}
                roughness={0.24}
                transparent
                opacity={dim ? 0.5 : 0.88}
              />
            </mesh>
            <mesh position={[0, 0.145, 0]}>
              <sphereGeometry
                args={[0.125, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshStandardMaterial
                color={
                  part.props?.color === "azul"
                    ? "#4291d2"
                    : part.props?.color === "amarillo"
                      ? "#e7c239"
                      : "#e25842"
                }
                emissive={flow ? "#e84724" : "#000"}
                emissiveIntensity={flow ? 0.8 : 0}
                roughness={0.25}
              />
            </mesh>
            <mesh position={[0, -0.055, 0]}>
              <cylinderGeometry args={[0.145, 0.145, 0.025, 24]} />
              <meshStandardMaterial color="#e59c8f" />
            </mesh>
          </>
        ) : part.type === "ldr" ? (
          <>
            <mesh position={[0, 0.09, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.15, 0.055, 22]} />
              <meshStandardMaterial color="#b77c49" roughness={0.8} />
            </mesh>
            {[-2, -1, 0, 1, 2].map((index) => (
              <mesh key={index} position={[index * 0.045, 0.09, 0.03]}>
                <boxGeometry
                  args={[0.018, 0.2 - Math.abs(index) * 0.025, 0.01]}
                />
                <meshStandardMaterial color="#e3be85" />
              </mesh>
            ))}
          </>
        ) : part.type === "button" ? (
          <>
            <mesh>
              <boxGeometry args={[0.54, 0.17, 0.54]} />
              <meshStandardMaterial color="#727c74" metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.13, 16]} />
              <meshStandardMaterial color="#243d32" />
            </mesh>
          </>
        ) : part.type === "buzzer" ? (
          <>
            <mesh position={[0, 0.13, 0]}>
              <cylinderGeometry args={[0.3, 0.3, 0.43, 30]} />
              <meshStandardMaterial color="#26382e" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.35, 0]}>
              <cylinderGeometry args={[0.075, 0.075, 0.003, 16]} />
              <meshBasicMaterial color="#071b16" />
            </mesh>
            <BoardText position={[0.16, 0.351, 0]} size={0.12} color="#f2edce">
              +
            </BoardText>
          </>
        ) : part.type === "potentiometer" ? (
          <>
            <mesh>
              <boxGeometry args={[0.39, 0.16, 0.32]} />
              <meshStandardMaterial color="#336d95" />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.1, 0.1, 0.26, 16]} />
              <meshStandardMaterial
                color="#b8c9ba"
                metalness={0.6}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[0, 0.32, 0]}>
              <boxGeometry args={[0.15, 0.005, 0.025]} />
              <meshStandardMaterial color="#526e60" />
            </mesh>
          </>
        ) : part.type === "hcsr04" ? (
          <>
            <mesh position={[0, 0.05, center.y > 8.5 ? 0.26 : -0.26]}>
              <boxGeometry args={[2.15, 0.12, 0.6]} />
              <meshStandardMaterial color="#267b8b" roughness={0.48} />
            </mesh>
            {[-0.66, 0.66].map((x) => (
              <group key={x} position={[x, 0.26, center.y > 8.5 ? 0.4 : -0.4]}>
                <mesh rotation={[Math.PI / 2, 0, 0]}>
                  <cylinderGeometry args={[0.32, 0.32, 0.38, 30]} />
                  <meshStandardMaterial
                    color="#c8d2c9"
                    metalness={0.72}
                    roughness={0.25}
                  />
                </mesh>
                <mesh
                  position={[0, 0, center.y > 8.5 ? 0.197 : -0.197]}
                  rotation={[Math.PI / 2, 0, 0]}
                >
                  <cylinderGeometry args={[0.24, 0.24, 0.004, 24]} />
                  <meshStandardMaterial
                    color="#2e4843"
                    metalness={0.5}
                    roughness={0.6}
                  />
                </mesh>
              </group>
            ))}
          </>
        ) : part.type === "dht11" ? (
          <>
            <mesh position={[0, 0.2, center.y > 8.5 ? 0.2 : -0.2]}>
              <boxGeometry args={[0.68, 0.58, 0.34]} />
              <meshStandardMaterial
                color={dim ? "#829ea6" : "#4295b5"}
                roughness={0.7}
              />
            </mesh>
            {Array.from({ length: 6 }, (_, index) => (
              <mesh
                key={index}
                position={[
                  -0.25 + index * 0.1,
                  0.28,
                  center.y > 8.5 ? 0.375 : -0.375,
                ]}
              >
                <boxGeometry args={[0.045, 0.33, 0.015]} />
                <meshStandardMaterial color="#234c61" />
              </mesh>
            ))}
          </>
        ) : part.type === "lm35" || part.type === "tilt" ? (
          <mesh position={[0, 0.14, 0]}>
            <boxGeometry args={[0.3, 0.42, 0.14]} />
            <meshStandardMaterial
              color={part.type === "tilt" ? "#b7bb76" : "#253930"}
              metalness={0.2}
            />
          </mesh>
        ) : (
          <>
            <mesh>
              <boxGeometry args={[box.w * U, 0.09, box.h * U]} />
              <meshStandardMaterial color={color} roughness={0.52} />
            </mesh>
            {part.type === "pir" ? (
              <mesh position={[0, 0.2, 0]}>
                <sphereGeometry
                  args={[0.27, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]}
                />
                <meshStandardMaterial color="#f7f5df" roughness={0.75} />
              </mesh>
            ) : part.type === "ds18b20" ? (
              <mesh position={[0, 0.08, -0.02]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.075, 0.075, 0.54, 18]} />
                <meshStandardMaterial
                  color="#ced8d0"
                  metalness={0.75}
                  roughness={0.27}
                />
              </mesh>
            ) : (
              <>
                <mesh position={[-0.15, 0.095, 0]}>
                  <boxGeometry args={[0.19, 0.1, 0.2]} />
                  <meshStandardMaterial color="#22372d" />
                </mesh>
                {Array.from({ length: 5 }, (_, index) => (
                  <mesh
                    key={index}
                    position={[0.1 + index * 0.055, 0.053, 0.01]}
                  >
                    <boxGeometry args={[0.022, 0.008, 0.35]} />
                    <meshStandardMaterial
                      color={part.type === "water" ? "#d3a66b" : "#c9c098"}
                      metalness={0.55}
                    />
                  </mesh>
                ))}
              </>
            )}
            <BoardText
              position={[0, 0.058, -0.18]}
              size={0.08}
              color="#ebf3db"
              width={box.w * U * 0.85}
            >
              {part.type.toUpperCase()}
            </BoardText>
          </>
        )}
      </group>
      {!part.holes &&
        definition.pins.map((pin) => {
          const point = endpointXY(
            { parts: [part] } as Circuit,
            `${part.id}.${pin.id}`,
          );
          return (
            <group key={pin.id}>
              <mesh position={position(point, 0.25)}>
                <boxGeometry args={[0.045, 0.22, 0.045]} />
                <meshStandardMaterial color="#cfb273" metalness={0.72} />
              </mesh>
              <BoardText
                position={position(
                  { x: point.x, y: point.y + (box.y < 0 ? 0.7 : -0.7) },
                  0.135,
                )}
                size={0.076}
                color="#4f6657"
                width={0.27}
              >
                {pin.label}
              </BoardText>
            </group>
          );
        })}
    </>
  );
}

function Connection({
  circuit,
  wire,
  active,
  flow,
  animate,
  select,
}: {
  circuit: Circuit;
  wire: Wire;
  active: boolean;
  flow: boolean;
  animate: boolean;
  select: (selection: Selection) => void;
}) {
  const points = useMemo<V3[]>(() => {
    const a = position(endpointXY(circuit, wire.from), 0.15),
      b = position(endpointXY(circuit, wire.to), 0.15);
    const distance = Math.hypot(a[0] - b[0], a[2] - b[2]);
    const height = Math.min(1.05, 0.32 + distance * 0.13);
    return [
      a,
      [a[0], height * 0.8, a[2]],
      [(a[0] + b[0]) / 2, height, (a[2] + b[2]) / 2],
      [b[0], height * 0.8, b[2]],
      b,
    ];
  }, [circuit, wire]);
  return (
    <group
      onClick={(event) => {
        event.stopPropagation();
        select({
          title: `Cable ${wire.color} · ${wire.carries}`,
          text: `De ${wire.from} a ${wire.to}.`,
          detail:
            wire.kind === "cable"
              ? "Los terminales del módulo se identifican por su marca impresa. Confirma las marcas en la pieza física: pueden variar entre fabricantes."
              : "Inserta un extremo en cada agujero indicado. Las letras y números permanecen iguales al girar la vista.",
          terminals: [wire.from, wire.to],
        });
      }}
    >
      <Tube
        points={points}
        radius={active ? 0.029 : 0.022}
        color={WIRE_HEX[wire.color]}
        opacity={active ? 1 : 0.38}
      />
      {flow && active && (
        <MovingSignal
          points={points}
          animate={animate}
          color="#e0ea82"
          size={0.037}
          count={2}
        />
      )}
      {[points[0], points[points.length - 1]].map((end, index) => (
        <mesh key={index} position={[end[0], 0.16, end[2]]}>
          <cylinderGeometry args={[0.037, 0.024, 0.07, 10]} />
          <meshStandardMaterial color={WIRE_HEX[wire.color]} />
        </mesh>
      ))}
    </group>
  );
}

function TerminalMarker({
  endpoint,
  circuit,
}: {
  endpoint: string;
  circuit: Circuit;
}) {
  const pos = position(endpointXY(circuit, endpoint), 0.18);
  return (
    <group>
      <mesh position={pos} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.056, 0.085, 22]} />
        <meshBasicMaterial
          color="#1673a5"
          side={THREE.DoubleSide}
          depthTest={false}
        />
      </mesh>
    </group>
  );
}

/** Keep labels readable in screen space even when neighbouring pins overlap in perspective. */
function TerminalLabels({
  endpoints,
  circuit,
  cable,
}: {
  endpoints: string[];
  circuit: Circuit;
  cable: boolean;
}) {
  const { camera, size } = useThree();
  const points = useMemo(
    () =>
      endpoints.map((endpoint, index) => {
        const at = endpointXY(circuit, endpoint);
        const pin = isPoint(endpoint)
          ? picoPinForStrip(stripOf(endpoint))
          : undefined;
        const label = isPoint(endpoint)
          ? shortPoint(endpoint)
          : (endpoint.split(".").at(-1) ?? endpoint);
        return {
          endpoint,
          point: new THREE.Vector3(...position(at, 0.18)),
          label: cable ? `${index === 0 ? "A" : "B"} · ${label}` : label,
          sub: pin ? `${pin.name} · pin ${pin.physical}` : undefined,
        };
      }),
    [endpoints.join("|"), circuit, cable],
  );
  const [screen, setScreen] = useState<
    { x: number; y: number; visible: boolean }[]
  >([]);
  const [origin, setOrigin] = useState({ x: 0, y: 0 });
  useFrame(() => {
    const projected = points.map(({ point }) => {
      const clip = point.clone().project(camera);
      return {
        x: ((clip.x + 1) * size.width) / 2,
        y: ((1 - clip.y) * size.height) / 2,
        visible:
          Math.abs(clip.x) <= 1 &&
          Math.abs(clip.y) <= 1 &&
          Math.abs(clip.z) <= 1,
      };
    });
    setScreen((previous) =>
      previous.length === projected.length &&
      previous.every(
        (point, index) =>
          Math.abs(point.x - projected[index].x) < 0.25 &&
          Math.abs(point.y - projected[index].y) < 0.25 &&
          point.visible === projected[index].visible,
      )
        ? previous
        : projected,
    );
    const clip = new THREE.Vector3().project(camera);
    const nextOrigin = {
      x: ((clip.x + 1) * size.width) / 2,
      y: ((1 - clip.y) * size.height) / 2,
    };
    setOrigin((previous) =>
      Math.abs(previous.x - nextOrigin.x) < 0.25 &&
      Math.abs(previous.y - nextOrigin.y) < 0.25
        ? previous
        : nextOrigin,
    );
  });
  const labels = points.flatMap((point, index) =>
    screen[index]?.visible ? [{ ...point, ...screen[index] }] : [],
  );
  const boxes = layoutCallouts(
    labels.map((label) => ({
      x: label.x,
      y: label.y,
      width: Math.max(
        64,
        label.label.length * 7.5 + 20,
        (label.sub?.length ?? 0) * 6.7 + 20,
      ),
      height: label.sub ? 42 : 28,
      side: label.y < size.height / 2 ? -1 : 1,
    })),
    size.width,
    size.height,
  );
  return (
    <Html position={[0, 0, 0]} zIndexRange={[3, 0]}>
      <svg
        className="rdx-terminal-overlay"
        width={size.width}
        height={size.height}
        style={{ left: -origin.x, top: -origin.y }}
        aria-hidden="true"
      >
        {labels.map((label, index) => {
          const box = boxes[index];
          const edgeY = label.y < box.y ? box.y : box.y + box.height;
          return (
            <g key={label.endpoint}>
              <line
                x1={label.x}
                y1={label.y}
                x2={box.x + box.width / 2}
                y2={edgeY}
                stroke="#fff9e9"
                strokeWidth={4}
              />
              <line
                x1={label.x}
                y1={label.y}
                x2={box.x + box.width / 2}
                y2={edgeY}
                stroke="#12364d"
                strokeWidth={1.5}
              />
              <circle
                cx={label.x}
                cy={label.y}
                r={6}
                fill="none"
                stroke="#12364d"
                strokeWidth={2}
              />
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={6}
                fill="#fff9e9"
                stroke="#12364d"
                strokeWidth={1.5}
              />
              <text
                x={box.x + box.width / 2}
                y={box.y + 18}
                textAnchor="middle"
                fill="#12364d"
                fontSize={12}
                fontWeight={800}
              >
                {label.label}
              </text>
              {label.sub && (
                <text
                  x={box.x + box.width / 2}
                  y={box.y + 33}
                  textAnchor="middle"
                  fill="#1e5b7f"
                  fontSize={11}
                  fontWeight={700}
                >
                  {label.sub}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </Html>
  );
}

function Activate2DFallback({ activate }: { activate: () => void }) {
  const marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    // Canvas mounts its alternative DOM content even when WebGL is supported.
    // Only SafeCanvas's actual unsupported/lost/error branch places it outside
    // the canvas; that is the point at which the 2D diagram should take over.
    if (marker.current && !marker.current.closest("canvas")) activate();
  }, [activate]);
  return <span ref={marker} hidden />;
}

function CircuitWorld({
  circuit,
  activeStep,
  mode,
  flow,
  animate,
  select,
  action,
  home,
  target,
  bounds,
}: {
  circuit: Circuit;
  activeStep: number;
  mode: "step" | "all";
  flow: boolean;
  animate: boolean;
  select: (selection: Selection) => void;
  action: CameraAction;
  home: V3;
  target: V3;
  bounds: SceneBounds;
}) {
  const step = circuit.steps[activeStep];
  const completedSteps =
    mode === "all" ? circuit.steps : circuit.steps.slice(0, activeStep + 1);
  const partIds = new Set(completedSteps.flatMap((entry) => entry.parts ?? []));
  const wireIds = new Set(completedSteps.flatMap((entry) => entry.wires ?? []));
  const activeWires = new Set(step?.wires ?? []),
    activeParts = new Set(step?.parts ?? []);
  const visibleWires =
    mode === "all"
      ? circuit.wires
      : circuit.wires.filter((wire) => wireIds.has(wire.id));
  const visibleParts =
    mode === "all"
      ? circuit.parts
      : circuit.parts.filter((part) => partIds.has(part.id));
  const actionTerminals = [
    ...new Set([
      ...visibleWires
        .filter((wire) => activeWires.has(wire.id))
        .flatMap((wire) => [wire.from, wire.to]),
      ...visibleParts
        .filter((part) => activeParts.has(part.id))
        .flatMap((part) => Object.values(part.holes ?? {})),
    ]),
  ];
  const terminals = actionTerminals.length
    ? actionTerminals
    : [...new Set(step?.focus ?? [])];
  return (
    <>
      <ambientLight intensity={1.75} />
      <hemisphereLight args={["#fff9e7", "#8d9e8c", 1.6]} />
      <directionalLight position={[3, 9, 4]} intensity={2.8} color="#fff5dc" />
      <directionalLight
        position={[-5, 5, -4]}
        intensity={1.2}
        color="#b0eadc"
      />
      <Breadboard />
      <Pico select={select} />
      {visibleParts.map((part) => (
        <group
          key={part.id}
          onClick={(event) => {
            event.stopPropagation();
            const definition = partDef(part);
            select({
              title: part.label,
              text: definition.about,
              detail: definition.orientation,
              terminals: Object.entries(part.holes ?? {}).map(
                ([pin, hole]) => `${pin} → ${hole}`,
              ),
            });
          }}
        >
          <SensorBody
            part={part}
            dim={mode !== "all" && !activeParts.has(part.id)}
            flow={flow}
          />
        </group>
      ))}
      {visibleWires.map((wire) => (
        <Connection
          key={wire.id}
          circuit={circuit}
          wire={wire}
          active={mode === "all" || activeWires.has(wire.id)}
          flow={flow}
          animate={animate}
          select={select}
        />
      ))}
      {mode === "step" &&
        terminals.map((endpoint) => (
          <TerminalMarker
            key={endpoint}
            endpoint={endpoint}
            circuit={circuit}
          />
        ))}
      {mode === "step" && (
        <TerminalLabels
          endpoints={terminals}
          circuit={circuit}
          cable={activeWires.size === 1}
        />
      )}
      <SceneCamera
        action={action}
        target={target}
        home={home}
        maxDistance={21}
        bounds={bounds}
      />
    </>
  );
}

export interface CircuitExperienceProps {
  circuit: Circuit;
  activeStep?: number;
  mode?: "step" | "all";
  className?: string;
}

export function CircuitExperience({
  circuit,
  activeStep = 0,
  mode = "step",
  className = "",
}: CircuitExperienceProps) {
  const reference = useRef<HTMLElement>(null);
  const active = useSceneActive(reference);
  const reduced = useReducedMotion();
  const [flow, setFlow] = useState(false),
    [paused, setPaused] = useState(false);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [fallback2D, setFallback2D] = useState(false);
  const activateFallback = useCallback(() => setFallback2D(true), []);
  const [overview, setOverview] = useState(false);
  const [action, setAction] = useState<CameraAction>({
    type: "reset",
    sequence: 0,
  });
  // -1 is the preparation screen: neither view has placed any component yet.
  const stepIndex = Math.max(
    -1,
    Math.min(circuit.steps.length - 1, activeStep),
  );
  const step = circuit.steps[stepIndex];
  const fullBounds = useMemo<SceneBounds>(() => {
    // Keep the complete physical board in view, including its unused half.
    // Bounds also cover modules placed outside the board, throughout all steps.
    const points: V3[] = [
      [(-BOARD.width * U) / 2 - 0.12, -0.13, (-19.5 * U) / 2 - 0.1],
      [(BOARD.width * U) / 2 + 0.12, 1.1, (19.5 * U) / 2 + 0.1],
    ];
    for (const part of circuit.parts) {
      if (!part.holes) {
        const box = moduleBox(part);
        points.push(
          position({ x: box.x - 0.6, y: box.y - 0.6 }, 0.7),
          position({ x: box.x + box.w + 0.6, y: box.y + box.h + 0.6 }, 0.7),
        );
      }
      for (const outline of bodyOutline(part)) {
        if (outline.kind === "circle")
          points.push(
            position({ x: outline.cx - outline.r, y: outline.cy - outline.r }),
            position({ x: outline.cx + outline.r, y: outline.cy + outline.r }),
          );
        else
          points.push(
            position({ x: outline.x, y: outline.y }),
            position({ x: outline.x + outline.w, y: outline.y + outline.h }),
          );
      }
    }
    return {
      min: [
        Math.min(...points.map((point) => point[0])),
        -0.13,
        Math.min(...points.map((point) => point[2])),
      ],
      max: [
        Math.max(...points.map((point) => point[0])),
        1.1,
        Math.max(...points.map((point) => point[2])),
      ],
    };
  }, [circuit]);
  const bounds = useMemo<SceneBounds>(() => {
    if (overview || mode === "all" || !step) return fullBounds;
    const points: V3[] = [];
    for (const wire of circuit.wires.filter((item) =>
      step.wires?.includes(item.id),
    ))
      points.push(
        position(endpointXY(circuit, wire.from)),
        position(endpointXY(circuit, wire.to)),
      );
    for (const part of circuit.parts.filter((item) =>
      step.parts?.includes(item.id),
    )) {
      for (const hole of Object.values(part.holes ?? {}))
        points.push(atHole(hole));
      const box = moduleBox(part);
      if (!part.holes)
        points.push(
          position({ x: box.x, y: box.y }),
          position({ x: box.x + box.w, y: box.y + box.h }),
        );
      for (const outline of bodyOutline(part)) {
        if (outline.kind === "circle")
          points.push(
            position({ x: outline.cx - outline.r, y: outline.cy - outline.r }),
            position({ x: outline.cx + outline.r, y: outline.cy + outline.r }),
          );
        else
          points.push(
            position({ x: outline.x, y: outline.y }),
            position({ x: outline.x + outline.w, y: outline.y + outline.h }),
          );
      }
    }
    if (!points.length)
      for (const hole of step.focus ?? []) points.push(atHole(hole));
    if (!points.length) return fullBounds;
    return {
      min: [
        Math.min(...points.map((point) => point[0])) - 0.65,
        -0.13,
        Math.min(...points.map((point) => point[2])) - 0.55,
      ],
      max: [
        Math.max(...points.map((point) => point[0])) + 0.65,
        1.1,
        Math.max(...points.map((point) => point[2])) + 0.55,
      ],
    };
  }, [circuit, step, fullBounds, overview, mode]);
  const target = useMemo<V3>(
    () =>
      bounds.min.map((value, index) => (value + bounds.max[index]) / 2) as V3,
    [bounds],
  );
  const home = useMemo<V3>(
    () => [target[0] + 0.4, target[1] + 8, target[2] + 4.8],
    [target],
  );
  useEffect(() => {
    setSelection(null);
    setInspectorOpen(false);
    setOverview(false);
    setAction((current) => ({ type: "reset", sequence: current.sequence + 1 }));
  }, [circuit.id, stepIndex]);
  useEffect(() => {
    if (selection) setInspectorOpen(true);
  }, [selection]);
  useEffect(() => {
    setAction((current) => ({ type: "reset", sequence: current.sequence + 1 }));
  }, [circuit.id]);
  const camera = (type: CameraAction["type"]) =>
    setAction((current) => ({ type, sequence: current.sequence + 1 }));
  const visibleSteps =
    mode === "all" ? circuit.steps : circuit.steps.slice(0, stepIndex + 1);
  const visibleParts =
    mode === "all"
      ? circuit.parts
      : circuit.parts.filter((part) =>
          visibleSteps.some((entry) => entry.parts?.includes(part.id)),
        );
  const visibleWires =
    mode === "all"
      ? circuit.wires
      : circuit.wires.filter((wire) =>
          visibleSteps.some((entry) => entry.wires?.includes(wire.id)),
        );
  if (fallback2D)
    return (
      <section
        className={`rdx-circuit ${className}`}
        aria-label={`Plano 2D de ${circuit.title}`}
      >
        <p className="rdx-circuit-fallback-note" role="status">
          Este navegador no dispone de WebGL. Vista 2D activa.
        </p>
        <div className="rdx-circuit-canvas">
          <BreadboardView
            circuit={circuit}
            stepIndex={stepIndex}
            complete={mode === "all"}
            description={step ? `${step.title}. ${step.detail}` : undefined}
          />
        </div>
      </section>
    );
  return (
    <section
      ref={reference}
      className={`rdx-circuit ${className}`}
      aria-label={`Modelo 3D de ${circuit.title}`}
    >
      <div className="rdx-circuit-heading">
        <span>
          <Box size={15} /> Montaje 3D
        </span>
        <small>Arrastra para girar · pellizca para acercar</small>
      </div>
      <div className="rdx-circuit-canvas">
        <SafeCanvas
          dpr={[1, 1.5]}
          frameloop={
            !active
              ? "never"
              : flow && !paused && !reduced
                ? "always"
                : "demand"
          }
          camera={{ position: home, fov: 40 }}
          gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
          fallback={<Activate2DFallback activate={activateFallback} />}
        >
          <Suspense fallback={null}>
            <CircuitWorld
              circuit={circuit}
              activeStep={stepIndex}
              mode={mode}
              flow={flow}
              animate={!paused && !reduced && active}
              select={setSelection}
              action={action}
              home={home}
              target={target}
              bounds={bounds}
            />
          </Suspense>
        </SafeCanvas>
      </div>
      <div
        className="rdx-circuit-controls"
        aria-label="Controles del montaje 3D"
      >
        {mode === "step" && step && (
          <button
            type="button"
            onClick={() => {
              setOverview(false);
              camera("reset");
            }}
            aria-pressed={!overview}
          >
            <Crosshair size={16} /> Este paso
          </button>
        )}
        <button type="button" onClick={() => camera("top")}>
          <ScanLine size={16} />
          Vista superior
        </button>
        <button
          type="button"
          onClick={() => {
            setOverview(true);
            camera("reset");
          }}
          aria-label="Ver todo el montaje 3D"
          title="Ver todo el montaje"
        >
          <RotateCcw size={16} />
        </button>
        <button
          type="button"
          onClick={() => camera("zoom-in")}
          aria-label="Acercar montaje"
        >
          <ZoomIn size={16} />
        </button>
        <button
          type="button"
          onClick={() => camera("zoom-out")}
          aria-label="Alejar montaje"
        >
          <ZoomOut size={16} />
        </button>
      </div>
      <details
        className="rdx-circuit-details"
        open={inspectorOpen}
        onToggle={(event) => {
          setInspectorOpen(event.currentTarget.open);
          if (!event.currentTarget.open) setFlow(false);
        }}
      >
        <summary>Explorar piezas y conexiones</summary>
        <div className="rdx-circuit-controls rdx-circuit-controls--extras">
          <button
            type="button"
            className="rdx-flow-toggle"
            onClick={() => setFlow((value) => !value)}
            aria-pressed={flow}
          >
            <Sparkles size={15} />
            <span>Recorrido ilustrativo</span>
          </button>
          {flow && (
            <button
              onClick={() => setPaused((value) => !value)}
              disabled={reduced}
              aria-label={paused ? "Reanudar recorrido" : "Pausar recorrido"}
            >
              {paused || reduced ? <Play size={16} /> : <Pause size={16} />}
            </button>
          )}
        </div>
        <div className="rdx-circuit-inspector">
          <label htmlFor={`inspect-${circuit.id}`}>
            Explora una pieza o un cable
          </label>
          <select
            id={`inspect-${circuit.id}`}
            value=""
            onChange={(event) => {
              const value = event.target.value;
              const part = visibleParts.find(
                (candidate) => `part:${candidate.id}` === value,
              );
              if (part) {
                const definition = partDef(part);
                setSelection({
                  title: part.label,
                  text: definition.about,
                  detail: definition.orientation,
                  terminals: Object.entries(part.holes ?? {}).map(
                    ([pin, hole]) => `${pin} → ${hole}`,
                  ),
                });
              }
              const wire = visibleWires.find(
                (candidate) => `wire:${candidate.id}` === value,
              );
              if (wire)
                setSelection({
                  title: `Cable ${wire.color} · ${wire.carries}`,
                  text: `Une ${wire.from} con ${wire.to}.`,
                  terminals: [wire.from, wire.to],
                });
            }}
          >
            <option value="">Selecciona o toca el modelo</option>
            <optgroup label="Piezas">
              {visibleParts.map((part) => (
                <option key={part.id} value={`part:${part.id}`}>
                  {part.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Cables">
              {visibleWires.map((wire) => (
                <option key={wire.id} value={`wire:${wire.id}`}>
                  {wire.color}: {wire.from} → {wire.to} · {wire.carries}
                </option>
              ))}
            </optgroup>
          </select>
          <div className="rdx-inspect-description" aria-live="polite">
            <strong>
              {selection?.title ??
                (mode === "step"
                  ? (step?.title ?? "Antes de cablear")
                  : circuit.title)}
            </strong>
            <p>
              {selection?.text ??
                (mode === "step"
                  ? (step?.detail ??
                    "Desconecta USB y otras fuentes. Prepara las piezas y sigue el primer paso antes de conectar.")
                  : "Gira el montaje y selecciona cualquier pieza. Todas las conexiones provienen del mismo plano que la vista 2D.")}
            </p>
            {selection?.detail && <p>{selection.detail}</p>}
            {selection?.terminals && (
              <div className="rdx-terminal-list">
                {selection.terminals.map((terminal) => (
                  <span
                    key={terminal}
                    title={
                      isPoint(terminal) ? describePoint(terminal) : undefined
                    }
                  >
                    {terminal}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        <p className="rdx-circuit-note">
          {flow
            ? "El brillo y los puntos animados explican el recorrido; no confirman que tu placa esté encendida ni representan mediciones reales."
            : "Modelo educativo · agujeros y terminales coinciden con el plano 2D. Comprueba las marcas de tu pieza antes de conectarla."}
        </p>
      </details>
    </section>
  );
}

export default CircuitExperience;
