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
  RAIL_SPLIT_AFTER,
  describePoint,
  isPoint,
  pointXY,
  shortPoint,
  stripOf,
  holesOfStrip,
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
  controllerBox,
  controllerPin,
  controllerPins,
} from "../circuit/boards";
import type { Board } from "../lib/context";
import {
  BoardText,
  CylinderBetween,
  MovingSignal,
  type V3,
} from "./Primitives";
import {
  HardwareBody,
  HardwareStudio,
  UsbJack,
  socketRimGeometry,
  inspectedTerminals,
  highlightedTerminals,
  hardwareWireCurve,
} from "./HardwareModels";
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
const atEndpoint = (circuit: Circuit, endpoint: string, height = 0.15) =>
  position(
    endpointXY(circuit, endpoint),
    endpoint.startsWith("controller.")
      ? circuit.board === "uno"
        ? 0.49
        : 0.425
      : isPoint(endpoint)
        ? height
        : 0.36,
  );
interface Selection {
  title: string;
  text: string;
  detail?: string;
  terminals?: string[];
}

function Breadboard({
  circuit,
  select,
  activateEndpoint,
}: {
  circuit: Circuit;
  select: (selection: Selection) => void;
  activateEndpoint: (end: string) => boolean;
}) {
  const holes = useRef<THREE.InstancedMesh>(null);
  const rims = useRef<THREE.InstancedMesh>(null);
  const rimGeometry = useMemo(socketRimGeometry, []);
  useEffect(() => () => rimGeometry.dispose(), [rimGeometry]);
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
      object.position.set(...atHole(point, 0.104));
      object.updateMatrix();
      holes.current!.setMatrixAt(index, object.matrix);
      object.position.set(...atHole(point, 0.116));
      object.updateMatrix();
      rims.current?.setMatrixAt(index, object.matrix);
    });
    holes.current.instanceMatrix.needsUpdate = true;
    if (rims.current) rims.current.instanceMatrix.needsUpdate = true;
  }, [points]);
  return (
    <group>
      <HardwareBody
        position={[0, 0, 0]}
        size={[BOARD.width * U, 0.2, 19.5 * U]}
        color="#f0eadb"
        radius={0.09}
        bevel={0.014}
        roughness={0.74}
      />
      <HardwareBody
        position={[0, 0.103, 0]}
        size={[64 * U, 0.009, 2 * U]}
        color="#cfc8b7"
        radius={0.014}
        bevel={0.001}
        roughness={0.86}
      />
      {/* Socket walls use one geometry and one draw call, not 830 separate meshes. */}
      <instancedMesh
        ref={rims}
        args={[rimGeometry, undefined, points.length]}
        raycast={() => null}
      >
        <meshStandardMaterial
          color="#d4d2bf"
          roughness={0.77}
          side={THREE.DoubleSide}
        />
      </instancedMesh>
      <instancedMesh
        ref={holes}
        args={[undefined, undefined, points.length]}
        onClick={(event) => {
          event.stopPropagation();
          const hole = points[event.instanceId ?? -1];
          if (!hole || activateEndpoint(hole)) return;
          const strip = stripOf(hole, true);
          const linked = holesOfStrip(strip);
          const pin =
            !circuit.board || circuit.board === "pico"
              ? picoPinForStrip(strip)
              : undefined;
          select({
            title: `Agujero ${shortPoint(hole)}`,
            text:
              linked.length === 5
                ? `Estos cinco agujeros están unidos por dentro: ${linked.join(", ")}. El canal del centro separa las dos mitades.`
                : "Esta mitad del riel comparte la alimentación de los agujeros resaltados.",
            detail: pin
              ? `Esta tira llega al pin ${pin.name} de Pico W.`
              : "Toca otra fila para descubrir cómo se conectan los componentes.",
            terminals: linked,
          });
        }}
      >
        <boxGeometry args={[0.049, 0.012, 0.049]} />
        <meshStandardMaterial color="#3f493e" roughness={0.84} />
      </instancedMesh>
      {[
        { y: -0.47, color: "#d64545" },
        { y: 1.47, color: "#3e8fd0" },
        { y: 15.45, color: "#d64545" },
        { y: 17.48, color: "#3e8fd0" },
      ].flatMap((rail) =>
        [
          { from: BOARD.x0, to: BOARD.x0 + RAIL_SPLIT_AFTER - 1 },
          { from: BOARD.x0 + RAIL_SPLIT_AFTER + 1, to: BOARD.x0 + COLUMNS - 1 },
        ].map((segment, index) => (
          <mesh
            key={`${rail.y}-${index}`}
            position={position(
              { x: (segment.from + segment.to) / 2, y: rail.y },
              0.118,
            )}
          >
            <boxGeometry
              args={[(segment.to - segment.from) * U, 0.004, 0.019]}
            />
            <meshBasicMaterial color={rail.color} />
          </mesh>
        )),
      )}
      {[-0.42, 16.42].map((y) => (
        <mesh
          key={y}
          position={position({ x: BOARD.x0 + RAIL_SPLIT_AFTER, y }, 0.112)}
        >
          <boxGeometry args={[0.016, 0.004, 2.3 * U]} />
          <meshStandardMaterial color="#cdc6b6" roughness={0.85} />
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
    <group
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
      <HardwareBody
        position={position({ x: 11.5, y: 8.5 }, 0.22)}
        size={[20.3 * U, 0.12, 6.5 * U]}
        color="#247858"
        radius={0.045}
        roughness={0.53}
      />
      <HardwareBody
        position={position({ x: 11, y: 8.5 }, 0.305)}
        size={[0.45, 0.08, 0.4]}
        color="#202b27"
        radius={0.022}
        bevel={0.004}
        roughness={0.69}
      />
      <BoardText
        position={position({ x: 11, y: 8.5 }, 0.35)}
        size={0.052}
        color="#9bab9e"
      >
        RP2040
      </BoardText>
      <HardwareBody
        position={position({ x: 16.4, y: 8.5 }, 0.31)}
        size={[0.49, 0.085, 0.47]}
        color="#a7b5ab"
        radius={0.025}
        bevel={0.009}
        metalness={0.78}
        roughness={0.32}
      />
      <UsbJack kind="micro" position={position({ x: 1.9, y: 8.5 }, 0.33)} />
      <HardwareBody
        position={position({ x: 4.3, y: 8.5 }, 0.315)}
        size={[0.19, 0.035, 0.19]}
        color="#d8decf"
        radius={0.018}
        bevel={0.003}
        metalness={0.46}
        roughness={0.4}
      />
      <HardwareBody
        position={position({ x: 4.3, y: 8.5 }, 0.348)}
        size={[0.092, 0.03, 0.092]}
        color="#ede9d9"
        radius={0.016}
        roughness={0.65}
      />
      <BoardText
        position={position({ x: 4.3, y: 7.25 }, 0.289)}
        size={0.047}
        color="#e4f5d8"
      >
        BOOTSEL
      </BoardText>
      <mesh position={position({ x: 3.15, y: 6.35 }, 0.291)}>
        <boxGeometry args={[0.07, 0.022, 0.036]} />
        <meshStandardMaterial color="#e0edbf" roughness={0.42} />
      </mesh>
      {[
        { x: 2.15, y: 6.4 },
        { x: 2.15, y: 10.6 },
        { x: 20.85, y: 6.4 },
        { x: 20.85, y: 10.6 },
      ].map((hole, index) => (
        <group key={`mount-${index}`}>
          <mesh
            position={position(hole, 0.287)}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <ringGeometry args={[0.051, 0.078, 20]} />
            <meshStandardMaterial
              color="#b69c50"
              metalness={0.7}
              roughness={0.37}
            />
          </mesh>
          <mesh
            position={position(hole, 0.288)}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <circleGeometry args={[0.048, 20]} />
            <meshStandardMaterial color="#264f3c" roughness={0.88} />
          </mesh>
        </group>
      ))}
      {Array.from({ length: 6 }, (_, index) => (
        <mesh
          key={`smd-${index}`}
          position={position({ x: 8.5 + index * 0.8, y: 6.6 }, 0.3)}
        >
          <boxGeometry args={[0.038, 0.034, 0.055]} />
          <meshStandardMaterial
            color={index % 2 ? "#9b9475" : "#667061"}
            roughness={0.7}
            metalness={0.12}
          />
        </mesh>
      ))}
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
            position={atHole(pin.hole, 0.284)}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <ringGeometry args={[0.036, 0.052, 12]} />
            <meshStandardMaterial
              color="#b79e52"
              metalness={0.68}
              roughness={0.39}
            />
          </mesh>
          <mesh
            position={atHole(pin.hole, 0.235)}
            onClick={(event) => {
              event.stopPropagation();
              select({
                title: `${pin.name} · pin físico ${pin.physical}`,
                text: pin.role,
                detail: pin.voltage,
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

function ArduinoController({
  board,
  select,
  activateEndpoint,
}: {
  board: Board;
  select: (selection: Selection) => void;
  activateEndpoint: (endpoint: string) => boolean;
}) {
  const box = controllerBox(board);
  const center = { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  return (
    <group
      aria-label={board === "uno" ? "Arduino Uno" : "Arduino Nano"}
      onClick={(event) => {
        event.stopPropagation();
        select({
          title: board === "uno" ? "Arduino Uno" : "Arduino Nano",
          text: "La placa queda junto a la protoboard, con el USB hacia la izquierda. Busca el nombre impreso junto al conector.",
          detail:
            "Los pines D envían o reciben señales digitales; los A miden un voltaje.",
        });
      }}
    >
      <HardwareBody
        position={position(center, 0.22)}
        size={[box.w * U, 0.13, box.h * U]}
        color="#087a64"
        radius={board === "uno" ? 0.1 : 0.036}
        roughness={0.49}
      />
      <UsbJack
        kind={board === "uno" ? "b" : "mini"}
        position={position({ x: box.x + 0.9, y: center.y }, 0.38)}
      />
      <HardwareBody
        position={position({ x: center.x + 1.5, y: center.y }, 0.34)}
        size={[board === "uno" ? 1.82 : 0.45, 0.13, 0.4]}
        color="#1a2926"
        radius={0.022}
        bevel={0.005}
        roughness={0.68}
      />
      <BoardText
        position={position({ x: center.x + 1.5, y: center.y }, 0.41)}
        size={board === "uno" ? 0.066 : 0.048}
        color="#a5b6a7"
      >
        ATmega328P
      </BoardText>
      {[-1, 1].flatMap((side) =>
        Array.from({ length: board === "uno" ? 14 : 8 }, (_, index) => (
          <mesh
            key={`chip-${side}-${index}`}
            position={position(
              {
                x:
                  center.x +
                  1.5 +
                  (index - (board === "uno" ? 6.5 : 3.5)) *
                    (board === "uno" ? 1 : 0.34),
                y: center.y + side * 1.66,
              },
              0.3,
            )}
          >
            <boxGeometry
              args={[board === "uno" ? 0.035 : 0.025, 0.025, 0.095]}
            />
            <meshStandardMaterial
              color="#a7b3a7"
              metalness={0.72}
              roughness={0.33}
            />
          </mesh>
        )),
      )}
      {(board === "uno"
        ? [
            [1.7, 1.4],
            [25.3, 1.4],
            [1.7, 19.1],
            [25.3, 19.1],
          ]
        : [
            [1, 3.55],
            [16, 3.55],
          ]
      ).map(([x, y], index) => (
        <group key={`controller-mount-${index}`}>
          <mesh
            position={position({ x: box.x + x, y: box.y + y }, 0.289)}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <ringGeometry args={[0.049, 0.075, 20]} />
            <meshStandardMaterial
              color="#b69c50"
              metalness={0.69}
              roughness={0.36}
            />
          </mesh>
          <mesh
            position={position({ x: box.x + x, y: box.y + y }, 0.29)}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <circleGeometry args={[0.047, 20]} />
            <meshStandardMaterial color="#234b3d" roughness={0.9} />
          </mesh>
        </group>
      ))}
      {board === "uno" && (
        <>
          <HardwareBody
            position={position({ x: box.x + 4, y: center.y - 5 }, 0.4)}
            size={[0.42, 0.23, 0.35]}
            color="#23322b"
            radius={0.045}
            roughness={0.62}
          />
          <mesh
            position={position({ x: box.x + 2.43, y: center.y - 5 }, 0.405)}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.074, 0.074, 0.008, 16]} />
            <meshStandardMaterial color="#06110b" roughness={0.88} />
          </mesh>
          <BoardText
            position={position({ x: box.x + 4, y: center.y - 3 }, 0.296)}
            size={0.064}
            color="#d4ecd6"
          >
            POWER
          </BoardText>
        </>
      )}
      {board !== "uno" &&
        [-1, 1].flatMap((side) =>
          Array.from({ length: 8 }, (_, index) => (
            <mesh
              key={`chip-side-${side}-${index}`}
              position={position(
                {
                  x: center.x + 1.5 + side * 1.82,
                  y: center.y + (index - 3.5) * 0.32,
                },
                0.3,
              )}
            >
              <boxGeometry args={[0.075, 0.025, 0.025]} />
              <meshStandardMaterial
                color="#a7b3a7"
                metalness={0.72}
                roughness={0.33}
              />
            </mesh>
          )),
        )}
      <BoardText
        position={position(
          {
            x: center.x - (board === "uno" ? 0 : 3.6),
            y: center.y + (board === "uno" ? 3.2 : 0.5),
          },
          0.301,
        )}
        size={board === "uno" ? 0.18 : 0.13}
        color="#edffdf"
      >
        {board === "uno" ? "Arduino Uno" : "Arduino Nano"}
      </BoardText>
      {controllerPins(board).map((pin) => (
        <group key={pin.name}>
          <mesh
            position={position(pin, 0.35)}
            onClick={(event) => {
              event.stopPropagation();
              if (activateEndpoint(`controller.${pin.name}`)) return;
              select({
                title: `Pin ${pin.label} de Arduino`,
                text:
                  pin.kind === "adc"
                    ? "Entrada analógica: mide un voltaje y lo transforma en un número."
                    : pin.kind === "gpio"
                      ? "Pin digital: envía o recibe una señal."
                      : pin.kind === "gnd"
                        ? "GND: referencia común de 0 V."
                        : pin.name === "3V3"
                          ? "Salida de 3,3 V para alimentar los sensores del taller."
                          : pin.name === "5V"
                            ? "Salida de 5 V que llega del cable USB."
                            : "Conector de la placa.",
                terminals: [`controller.${pin.name}`],
              });
            }}
          >
            <boxGeometry args={[0.095, board === "uno" ? 0.25 : 0.15, 0.1]} />
            <meshStandardMaterial
              color={board === "uno" ? "#1c302b" : "#d7bb66"}
              metalness={board === "uno" ? 0.1 : 0.7}
              roughness={0.3}
            />
          </mesh>
          {board === "uno" && (
            <>
              <mesh position={position(pin, 0.479)}>
                <boxGeometry args={[0.055, 0.006, 0.055]} />
                <meshStandardMaterial color="#647d68" metalness={0.5} />
              </mesh>
              <mesh position={position(pin, 0.484)}>
                <boxGeometry args={[0.032, 0.004, 0.032]} />
                <meshBasicMaterial color="#030d09" />
              </mesh>
            </>
          )}
          {board !== "uno" && (
            <mesh
              position={position(pin, 0.293)}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={() => null}
            >
              <ringGeometry args={[0.026, 0.044, 12]} />
              <meshStandardMaterial
                color="#b69d50"
                metalness={0.72}
                roughness={0.35}
              />
            </mesh>
          )}
          <BoardText
            position={position(
              { x: pin.x, y: pin.y + (pin.y < center.y ? 0.8 : -0.8) },
              0.299,
            )}
            size={0.088}
            color="#f0ffe2"
          >
            {pin.label}
          </BoardText>
        </group>
      ))}
    </group>
  );
}

/** A connection grows once, when the learner finishes its two ends. */
function ConnectedTube({
  points,
  color,
  active,
  animate,
  preview,
}: {
  points: V3[];
  color: string;
  active: boolean;
  animate: boolean;
  preview: boolean;
}) {
  const { invalidate } = useThree();
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map((point) => new THREE.Vector3(...point)),
    );
    return new THREE.TubeGeometry(curve, 64, active ? 0.029 : 0.022, 8, false);
  }, [points, active]);
  const progress = useRef(animate && active && !preview ? 0 : 1);
  useEffect(() => {
    progress.current = animate && active && !preview ? 0 : 1;
    invalidate();
  }, [geometry, preview]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame((_, delta) => {
    if (!animate) progress.current = 1;
    progress.current = Math.min(
      1,
      progress.current + Math.min(delta, 0.05) * 2.8,
    );
    geometry.setDrawRange(
      0,
      Math.floor(((geometry.index?.count ?? 0) * progress.current) / 3) * 3,
    );
    if (progress.current < 1) invalidate();
  });
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        color={color}
        roughness={0.32}
        metalness={0.02}
        transparent={preview || !active}
        opacity={preview ? 0.2 : active ? 1 : 0.38}
        emissive={active ? color : "#000000"}
        emissiveIntensity={preview ? 0 : 0.045}
      />
    </mesh>
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
  const ledColor =
    part.props?.color === "azul"
      ? "#4291d2"
      : part.props?.color === "amarillo"
        ? "#e7c239"
        : "#e25842";
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
              <meshPhysicalMaterial
                color={ledColor}
                emissive={flow ? ledColor : "#000"}
                emissiveIntensity={flow ? 0.5 : 0}
                roughness={0.26}
                clearcoat={0.82}
                clearcoatRoughness={0.21}
                transparent
                opacity={dim ? 0.63 : 0.88}
              />
            </mesh>
            <mesh position={[0, 0.145, 0]}>
              <sphereGeometry
                args={[0.125, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]}
              />
              <meshPhysicalMaterial
                color={ledColor}
                emissive={flow ? ledColor : "#000"}
                emissiveIntensity={flow ? 0.54 : 0}
                roughness={0.26}
                clearcoat={0.82}
                clearcoatRoughness={0.21}
                transparent
                opacity={dim ? 0.63 : 0.9}
              />
            </mesh>
            <mesh position={[0, -0.055, 0]}>
              <cylinderGeometry args={[0.145, 0.145, 0.025, 24]} />
              <meshStandardMaterial color={ledColor} roughness={0.41} />
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
            <HardwareBody
              size={[0.54, 0.17, 0.54]}
              color="#727c74"
              radius={0.04}
              metalness={0.48}
              roughness={0.41}
            />
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
            <HardwareBody
              size={[0.39, 0.16, 0.32]}
              color="#336d95"
              radius={0.026}
              roughness={0.56}
            />
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
            <HardwareBody
              position={[0, 0.05, center.y > 8.5 ? 0.26 : -0.26]}
              size={[2.15, 0.12, 0.6]}
              color="#267b8b"
              radius={0.045}
              roughness={0.53}
            />
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
            <HardwareBody
              position={[0, 0.2, center.y > 8.5 ? 0.2 : -0.2]}
              size={[0.68, 0.58, 0.34]}
              color={dim ? "#829ea6" : "#4295b5"}
              radius={0.035}
              bevel={0.01}
              roughness={0.67}
            />
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
            <HardwareBody
              size={[box.w * U, 0.09, box.h * U]}
              color={color}
              radius={0.035}
              roughness={0.55}
            />
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
  connectionState,
}: {
  circuit: Circuit;
  wire: Wire;
  connectionState?: "take" | "a" | "b" | "placed";
  active: boolean;
  flow: boolean;
  animate: boolean;
  select: (selection: Selection) => void;
}) {
  const points = useMemo<V3[]>(() => {
    const a = atEndpoint(circuit, wire.from),
      b = atEndpoint(circuit, wire.to);
    return hardwareWireCurve(a, b);
  }, [circuit, wire]);
  if (active && (connectionState === "take" || connectionState === "a"))
    return null;
  const preview = active && connectionState === "b";
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
      <ConnectedTube
        points={points}
        color={WIRE_HEX[wire.color]}
        active={active}
        animate={animate}
        preview={preview}
      />
      {flow && active && !preview && (
        <MovingSignal
          points={points}
          animate={animate}
          color="#e0ea82"
          size={0.037}
          count={2}
        />
      )}
      {(preview ? [points[0]] : [points[0], points[points.length - 1]]).map(
        (end, index) => (
          <mesh key={index} position={[end[0], end[1] + 0.01, end[2]]}>
            <cylinderGeometry args={[0.037, 0.024, 0.07, 10]} />
            <meshStandardMaterial color={WIRE_HEX[wire.color]} />
          </mesh>
        ),
      )}
    </group>
  );
}

function TerminalMarker({
  endpoint,
  circuit,
  selected = false,
  activate,
}: {
  endpoint: string;
  circuit: Circuit;
  selected?: boolean;
  activate?: () => void;
}) {
  const pos = atEndpoint(circuit, endpoint, 0.18);
  return (
    <group>
      <mesh
        position={pos}
        rotation={[-Math.PI / 2, 0, 0]}
        renderOrder={20}
        onClick={(event) => {
          event.stopPropagation();
          activate?.();
        }}
      >
        <ringGeometry
          args={[selected ? 0.065 : 0.056, selected ? 0.13 : 0.1, 32]}
        />
        <meshBasicMaterial
          color={selected ? "#e3fb79" : "#42d49b"}
          side={THREE.DoubleSide}
          depthTest={false}
          depthWrite={false}
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
  activeEndpoint,
  activate,
  terminalNotes,
}: {
  endpoints: string[];
  circuit: Circuit;
  cable: boolean;
  activeEndpoint?: "a" | "b";
  activate?: (endpoint: string) => void;
  terminalNotes?: Record<string, string>;
}) {
  const { camera, size } = useThree();
  const points = useMemo(
    () =>
      endpoints.map((endpoint, index) => {
        const at = endpointXY(circuit, endpoint);
        const pin =
          isPoint(endpoint) && (!circuit.board || circuit.board === "pico")
            ? picoPinForStrip(stripOf(endpoint))
            : undefined;
        const label = isPoint(endpoint)
          ? shortPoint(endpoint)
          : (endpoint.split(".").at(-1) ?? endpoint);
        return {
          endpoint,
          badge: index === 0 ? "a" : "b",
          point: new THREE.Vector3(...atEndpoint(circuit, endpoint, 0.18)),
          label: cable ? `${index === 0 ? "A" : "B"} · ${label}` : label,
          sub:
            terminalNotes?.[endpoint] ??
            (pin ? `${pin.name} · pin ${pin.physical}` : undefined),
        };
      }),
    [endpoints.join("|"), circuit, cable, terminalNotes],
  );
  const [screen, setScreen] = useState<
    { x: number; y: number; visible: boolean }[]
  >([]);
  useFrame(() => {
    // Demand rendering may be the first frame after a camera focus. Project
    // from the updated camera matrix so a label stays on its physical hole.
    camera.updateMatrixWorld();
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
    <Html screenSpace position={[0, 0, 0]} zIndexRange={[3, 0]}>
      <svg
        className="rdx-terminal-overlay"
        width={size.width}
        height={size.height}
        style={{ left: 0, top: 0 }}
        aria-hidden={!activate}
      >
        {labels.map((label, index) => {
          const box = boxes[index];
          const edgeY = label.y < box.y ? box.y : box.y + box.height;
          return (
            <g
              key={label.endpoint}
              role={activate ? "button" : undefined}
              tabIndex={activate ? 0 : undefined}
              aria-label={`Tocar extremo ${label.badge.toUpperCase()}: ${label.endpoint}`}
              style={{
                pointerEvents: activate ? "auto" : "none",
                cursor: activate ? "pointer" : undefined,
              }}
              onClick={() => activate?.(label.endpoint)}
              onKeyDown={(event) => {
                if (["Enter", " "].includes(event.key)) {
                  event.preventDefault();
                  activate?.(label.endpoint);
                }
              }}
            >
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
                stroke="#143829"
                strokeWidth={1.5}
              />
              <circle
                cx={label.x}
                cy={label.y}
                r={6}
                fill="none"
                stroke="#143829"
                strokeWidth={2}
              />
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                rx={6}
                fill={activeEndpoint === label.badge ? "#ecffb2" : "#edfff1"}
                stroke="#1d634c"
                strokeWidth={1.5}
              />
              <text
                x={box.x + box.width / 2}
                y={box.y + 18}
                textAnchor="middle"
                fill="#143829"
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
                  fill="#466956"
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

function ResumeScene({ active }: { active: boolean }) {
  const { invalidate, size } = useThree();
  useEffect(() => {
    if (active) invalidate();
  }, [active, size.width, size.height, invalidate]);
  return null;
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
  activeEndpoint,
  onEndpointActivate,
  connectionState,
  selection,
  activePartPin,
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
  activeEndpoint?: "a" | "b";
  onEndpointActivate?: (endpoint: "a" | "b") => void;
  connectionState?: "take" | "a" | "b" | "placed";
  selection: Selection | null;
  activePartPin?: { partId: string; pinId: string };
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
  const focusedPart = activePartPin
    ? visibleParts.find((part) => part.id === activePartPin.partId)
    : undefined;
  const focusedPartHole = focusedPart?.holes?.[activePartPin?.pinId ?? ""];
  const focusedPin = focusedPart
    ? partDef(focusedPart).pins.find((pin) => pin.id === activePartPin?.pinId)
    : undefined;
  const terminalNotes =
    focusedPartHole && focusedPin
      ? { [focusedPartHole]: focusedPin.aka?.[0] ?? focusedPin.label }
      : undefined;
  const terminals = focusedPartHole
    ? [focusedPartHole]
    : actionTerminals.length
      ? actionTerminals
      : [...new Set(step?.focus ?? [])];
  const currentWire = circuit.wires.find(
    (wire) => step?.wires?.length === 1 && step.wires[0] === wire.id,
  );
  const activateEndpoint = (endpoint: string) => {
    if (mode !== "step" || !currentWire || !onEndpointActivate) return false;
    if (endpoint === currentWire.from) {
      onEndpointActivate("a");
      return true;
    }
    if (endpoint === currentWire.to) {
      onEndpointActivate("b");
      return true;
    }
    return false;
  };
  return (
    <>
      <HardwareStudio />
      <ambientLight intensity={1.15} />
      <hemisphereLight args={["#fff9e7", "#8d9e8c", 1.35]} />
      <directionalLight
        position={[3, 9, 4]}
        intensity={2.6}
        color="#fff5dc"
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
        shadow-bias={-0.0005}
        shadow-normalBias={0.012}
      />
      <directionalLight
        position={[-5, 5, -4]}
        intensity={1.2}
        color="#b0eadc"
      />
      <mesh
        position={[
          (bounds.min[0] + bounds.max[0]) / 2,
          -0.112,
          (bounds.min[2] + bounds.max[2]) / 2,
        ]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
        raycast={() => null}
      >
        <planeGeometry
          args={[
            Math.max(12, bounds.max[0] - bounds.min[0] + 2),
            Math.max(7, bounds.max[2] - bounds.min[2] + 2),
          ]}
        />
        <shadowMaterial opacity={0.16} transparent />
      </mesh>
      <Breadboard
        circuit={circuit}
        select={select}
        activateEndpoint={activateEndpoint}
      />
      {!circuit.board || circuit.board === "pico" ? (
        <Pico select={select} />
      ) : (
        <ArduinoController
          key={circuit.board}
          board={circuit.board}
          select={select}
          activateEndpoint={activateEndpoint}
        />
      )}
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
              terminals: inspectedTerminals(part),
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
          connectionState={
            activeWires.has(wire.id) ? connectionState : undefined
          }
        />
      ))}
      {mode === "step" &&
        terminals.map((endpoint) => (
          <TerminalMarker
            key={endpoint}
            endpoint={endpoint}
            circuit={circuit}
            selected={
              endpoint === focusedPartHole ||
              (!!currentWire &&
                endpoint ===
                  (activeEndpoint === "b" ? currentWire.to : currentWire.from))
            }
            activate={() => activateEndpoint(endpoint)}
          />
        ))}
      {mode === "step" && (
        <TerminalLabels
          endpoints={terminals}
          circuit={circuit}
          cable={activeWires.size === 1}
          activeEndpoint={activeEndpoint}
          activate={currentWire ? activateEndpoint : undefined}
          terminalNotes={terminalNotes}
        />
      )}
      {highlightedTerminals(circuit, selection?.terminals).map((terminal) => (
        <TerminalMarker
          key={`inspect-${terminal}`}
          endpoint={terminal}
          circuit={circuit}
          selected
        />
      ))}
      <SceneCamera
        key={`${circuit.id}:${circuit.board ?? "pico"}`}
        action={action}
        target={target}
        home={home}
        maxDistance={40}
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
  activeEndpoint?: "a" | "b";
  onEndpointActivate?: (endpoint: "a" | "b") => void;
  requestFocusEndpoint?: { endpoint: "a" | "b"; token: number };
  connectionState?: "take" | "a" | "b" | "placed";
  /** Identify one leg at a time before inserting the whole component. */
  activePartPin?: { partId: string; pinId: string };
  requestFocusPartPin?: { partId: string; pinId: string; token: number };
}

export function CircuitExperience({
  circuit,
  activeStep = 0,
  mode = "step",
  className = "",
  activeEndpoint,
  onEndpointActivate,
  requestFocusEndpoint,
  connectionState,
  activePartPin,
  requestFocusPartPin,
}: CircuitExperienceProps) {
  // A circuit's controller is part of its identity, including custom circuits
  // whose human-facing id stays the same when a different board is chosen.
  const sceneIdentity = `${circuit.id}:${circuit.board ?? "pico"}`;
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
  // -1 is the unassembled explorer: neither view has placed a component yet.
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
    if (circuit.board && circuit.board !== "pico") {
      const box = controllerBox(circuit.board);
      points.push(
        position({ x: box.x - 1.2, y: box.y - 0.8 }, 0.7),
        position({ x: box.x + box.w + 0.7, y: box.y + box.h + 0.8 }, 0.7),
      );
    }
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
  useLayoutEffect(() => {
    setSelection(null);
    setInspectorOpen(false);
    setOverview(false);
    setAction((current) => ({ type: "reset", sequence: current.sequence + 1 }));
  }, [sceneIdentity, stepIndex]);
  useEffect(() => {
    if (selection) setInspectorOpen(true);
  }, [selection]);
  const camera = (type: CameraAction["type"]) =>
    setAction((current) => ({ type, sequence: current.sequence + 1 }));
  const activeWire =
    step?.wires?.length === 1
      ? circuit.wires.find((wire) => wire.id === step.wires![0])
      : undefined;
  const focusEndpoint = useCallback(
    (endpoint: "a" | "b") => {
      if (!activeWire) return;
      setSelection(null);
      setInspectorOpen(false);
      const at = atEndpoint(
        circuit,
        endpoint === "a" ? activeWire.from : activeWire.to,
        0.18,
      );
      setAction((current) => ({
        type: "focus",
        sequence: current.sequence + 1,
        focusTarget: at,
        focusPosition: [at[0] + 0.4, at[1] + 3.2, at[2] + 1.9],
      }));
    },
    [activeWire, circuit],
  );
  useEffect(() => {
    if (requestFocusEndpoint) focusEndpoint(requestFocusEndpoint.endpoint);
  }, [requestFocusEndpoint?.token, focusEndpoint]);
  const focusPartPin = useCallback(
    (partId: string, pinId: string) => {
      const part = circuit.parts.find((candidate) => candidate.id === partId);
      const hole = part?.holes?.[pinId];
      if (!hole) return;
      const at = atHole(hole, 0.18);
      setSelection(null);
      setInspectorOpen(false);
      setAction((current) => ({
        type: "focus",
        sequence: current.sequence + 1,
        focusTarget: at,
        focusPosition: [at[0] + 0.18, at[1] + 3.6, at[2] + 1.5],
      }));
    },
    [circuit],
  );
  useEffect(() => {
    if (requestFocusPartPin)
      focusPartPin(requestFocusPartPin.partId, requestFocusPartPin.pinId);
  }, [requestFocusPartPin?.token, focusPartPin]);
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
            activeEndpoint={activeEndpoint}
            onEndpointActivate={onEndpointActivate}
            requestFocusEndpoint={requestFocusEndpoint}
            connectionState={connectionState}
            activePartPin={activePartPin}
            requestFocusPartPin={requestFocusPartPin}
          />
        </div>
      </section>
    );
  return (
    <section
      ref={reference}
      className={`rdx-circuit ${className}`}
      aria-label={`Modelo 3D de ${circuit.title}`}
      data-board={circuit.board ?? "pico"}
      data-circuit={circuit.id}
    >
      <div className="rdx-circuit-heading">
        <span>
          <Box size={15} /> Montaje 3D
        </span>
        <small>Arrastra para girar · rueda para acercar</small>
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
          shadows="soft"
          fallback={<Activate2DFallback activate={activateFallback} />}
        >
          <ResumeScene active={active} />
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
              activeEndpoint={activeEndpoint}
              onEndpointActivate={onEndpointActivate}
              connectionState={connectionState}
              selection={selection}
              activePartPin={activePartPin}
            />
          </Suspense>
        </SafeCanvas>
      </div>
      <div
        className="rdx-circuit-controls"
        aria-label="Controles del montaje 3D"
      >
        {mode === "step" &&
          activeWire &&
          ["a", "b"].map((end, index) => (
            <button
              key={end}
              type="button"
              className="rdx-endpoint-actions"
              aria-pressed={activeEndpoint === end}
              aria-label={`Acercar extremo ${end.toUpperCase()}: ${index === 0 ? activeWire.from : activeWire.to}`}
              onClick={() => {
                focusEndpoint(end as "a" | "b");
                onEndpointActivate?.(end as "a" | "b");
              }}
            >
              <Crosshair size={16} />
              {end.toUpperCase()} ·{" "}
              {isPoint(index === 0 ? activeWire.from : activeWire.to)
                ? shortPoint(index === 0 ? activeWire.from : activeWire.to)
                : (index === 0 ? activeWire.from : activeWire.to).split(".")[1]}
            </button>
          ))}
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
                  terminals: inspectedTerminals(part),
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
                  ? (step?.title ?? "Descubre el montaje")
                  : circuit.title)}
            </strong>
            <p>
              {selection?.text ??
                (mode === "step"
                  ? (step?.detail ??
                    "Toca la placa, sus pines y los agujeros. El primer paso te mostrará exactamente dónde va cada conexión.")
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
