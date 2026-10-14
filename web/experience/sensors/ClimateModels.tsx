import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { pointXY } from "../../circuit/breadboard";
import { moduleBox, modulePinXY } from "../../circuit/geometry";
import type { PartInstance } from "../../circuit/model";
import { partDef } from "../../circuit/parts";
import { HardwareBody } from "../HardwareModels";
import { BoardText, CylinderBetween, Tube, type V3 } from "../Primitives";

export interface ClimatePin {
  id: string;
  /** Local coordinates relative to SensorBody's existing group. */
  position: V3;
}

export interface ClimateModelProps {
  dim: boolean;
  outward?: 1 | -1;
  /** One breadboard pitch (2.54 mm), shared with the circuit scene. */
  unit?: number;
  boardWidth?: number;
  boardDepth?: number;
  pins?: ClimatePin[];
}

const PIN_COLORS: Record<string, string> = {
  VDD: "#cf5044",
  DATA: "#e7c055",
  GND: "#242b2a",
};

let ky015Asset: Promise<THREE.Group> | undefined;
function loadKy015() {
  if (!ky015Asset) {
    ky015Asset = new GLTFLoader()
      .loadAsync("/models/ky015.glb")
      .then(({ scene }) => scene)
      .catch((error: unknown) => {
        ky015Asset = undefined;
        throw error;
      });
  }
  return ky015Asset;
}

/** Real eight-solid KY-015 CAD, converted to a local mesh. Its printed pin
 * order is replaced with labels from the actual hole map, so changing the
 * selected module variant changes its visible terminals as well. */
export function Dht11ModuleModel(props: ClimateModelProps) {
  const { dim, outward = 1, unit = 0.13, pins } = props;
  const [cad, setCad] = useState<THREE.Group | null>(null);
  useEffect(() => {
    let active = true;
    void loadKy015().then(
      (scene) => {
        if (active) setCad(scene);
      },
      () => {
        // The complete local procedural model stays usable when an asset
        // cannot load, including all three physical leads.
      },
    );
    return () => {
      active = false;
    };
  }, []);
  const model = useMemo(() => {
    if (!cad) return null;
    const result = cad.clone(true);
    result.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material)
        ? object.material
        : [object.material];
      const cloned = materials.map((material: THREE.Material) => {
        const copy = material.clone();
        if (dim && copy instanceof THREE.MeshStandardMaterial)
          copy.color.lerp(new THREE.Color("#809087"), 0.42);
        return copy;
      });
      object.material = Array.isArray(object.material) ? cloned : cloned[0];
    });
    return result;
  }, [cad, dim]);
  useEffect(
    () => () => {
      model?.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const materials = Array.isArray(object.material)
          ? object.material
          : [object.material];
        materials.forEach((material: THREE.Material) => material.dispose());
      });
    },
    [model],
  );
  if (!model) return <Dht11ProceduralModel {...props} />;
  const mm = unit / 2.54;
  const leadPins = pins ?? [
    { id: "VCC", position: [-unit, 0, 0] as V3 },
    { id: "DATA", position: [0, 0, 0] as V3 },
    { id: "GND", position: [unit, 0, 0] as V3 },
  ];
  return (
    <group>
      <primitive object={model} scale={[mm, mm, outward * mm]} dispose={null} />
      {leadPins.map(({ id, position }) => (
        <BoardText
          key={id}
          position={[
            position[0],
            0.325 * (unit / 0.13),
            outward * 0.24 * (unit / 0.13),
          ]}
          rotation={outward === 1 ? [0, 0, 0] : [0, Math.PI, 0]}
          size={0.077 * (unit / 0.13)}
          width={0.09 * (unit / 0.13)}
          color="#184d3c"
        >
          {id === "VCC" ? "+" : id === "DATA" ? "S" : "−"}
        </BoardText>
      ))}
    </group>
  );
}

/** A complete procedural fallback; all pins retain their physical hole
 * positions and dynamic serigraphy, even before the local CAD is ready. */
function Dht11ProceduralModel({
  dim,
  outward = 1,
  unit = 0.13,
  pins,
}: ClimateModelProps) {
  const scale = unit / 0.13;
  const blue = dim ? "#73959e" : "#3aa8d0";
  const faceRotation: V3 = outward === 1 ? [0, 0, 0] : [0, Math.PI, 0];
  const leadPins = pins ?? [
    { id: "VCC", position: [-unit, 0, 0] as V3 },
    { id: "DATA", position: [0, 0, 0] as V3 },
    { id: "GND", position: [unit, 0, 0] as V3 },
  ];
  return (
    <group scale={scale}>
      <HardwareBody
        position={[0, 0.64, outward * 0.01]}
        size={[14 * (0.13 / 2.54), 25 * (0.13 / 2.54), 0.068]}
        color={dim ? "#52695e" : "#263a32"}
        radius={0.045}
        bevel={0.003}
        roughness={0.63}
      />
      <HardwareBody
        position={[0, 0.045, 0]}
        size={[0.37, 0.1, 0.12]}
        color="#252d2b"
        radius={0.008}
        bevel={0.002}
        roughness={0.64}
      />
      <HardwareBody
        position={[0, 0.74, outward * 0.19]}
        size={[12 * (0.13 / 2.54), 15.5 * (0.13 / 2.54), 5.5 * (0.13 / 2.54)]}
        color={blue}
        radius={0.027}
        bevel={0.005}
        roughness={0.54}
      />
      {/* A recessed grille and crossing ribs show the real square vents;
          the rear shell remains opaque rather than looking like a glass box. */}
      <mesh position={[0, 0.86, outward * 0.332]}>
        <boxGeometry args={[0.515, 0.47, 0.004]} />
        <meshStandardMaterial color="#164e63" roughness={0.93} />
      </mesh>
      {[-0.259, -0.155, -0.051, 0.051, 0.155, 0.259].map((x) => (
        <mesh key={`vertical-${x}`} position={[x, 0.86, outward * 0.339]}>
          <boxGeometry args={[0.035, 0.485, 0.014]} />
          <meshStandardMaterial color={blue} roughness={0.58} />
        </mesh>
      ))}
      {[0.615, 0.712, 0.809, 0.906, 1.003, 1.1].map((y) => (
        <mesh key={`horizontal-${y}`} position={[0, y, outward * 0.34]}>
          <boxGeometry args={[0.55, 0.034, 0.014]} />
          <meshStandardMaterial color={blue} roughness={0.58} />
        </mesh>
      ))}
      <BoardText
        position={[0, 0.46, outward * 0.335]}
        size={0.073}
        color="#e1f4fa"
        rotation={faceRotation}
        width={0.39}
      >
        DHT11
      </BoardText>
      {leadPins.map(({ id, position }) => {
        const x = position[0] / scale;
        return (
          <group key={id}>
            <CylinderBetween
              from={[x, -0.19, position[2] / scale]}
              to={[x, 0.18, outward * 0.012]}
              radius={0.014}
              color="#c5c8bf"
            />
            <mesh
              position={[x, 0.18, outward * 0.05]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.019, 0.031, 12]} />
              <meshStandardMaterial
                color="#d9c18c"
                metalness={0.65}
                side={THREE.DoubleSide}
              />
            </mesh>
            <BoardText
              position={[x, 0.235, outward * 0.052]}
              rotation={faceRotation}
              size={0.076}
              color="#edf3d8"
              width={0.087}
            >
              {id === "VCC" ? "+" : id === "DATA" ? "S" : "−"}
            </BoardText>
          </group>
        );
      })}
      <HardwareBody
        position={[-0.22, 0.26, outward * 0.055]}
        size={[0.066, 0.09, 0.034]}
        color="#ddd5b5"
        radius={0.002}
        bevel={0.001}
      />
      <BoardText
        position={[0.225, 0.27, outward * 0.053]}
        rotation={faceRotation}
        size={0.039}
        color="#d6dfcd"
      >
        R1
      </BoardText>
    </group>
  );
}

/** A D-shaped TO-92 outline, including its flat marked face. */
function to92Geometry() {
  const shape = new THREE.Shape();
  shape.moveTo(-0.105, 0.052);
  shape.lineTo(0.105, 0.052);
  shape.quadraticCurveTo(0.126, 0.04, 0.124, -0.007);
  shape.bezierCurveTo(0.122, -0.151, -0.122, -0.151, -0.124, -0.007);
  shape.quadraticCurveTo(-0.126, 0.04, -0.105, 0.052);
  const height = 0.242;
  const result = new THREE.ExtrudeGeometry(shape, {
    depth: height - 0.006,
    steps: 1,
    curveSegments: 10,
    bevelEnabled: true,
    bevelSegments: 1,
    bevelSize: 0.003,
    bevelThickness: 0.003,
  });
  result.rotateX(Math.PI / 2);
  result.translate(0, height - 0.003, 0);
  result.computeVertexNormals();
  return result;
}

export function Lm35Model({
  dim,
  outward = -1,
  unit = 0.13,
  pins,
}: ClimateModelProps) {
  const scale = unit / 0.13;
  // f-row parts show their flat face towards the centre channel (+Z).
  const face = -outward;
  const geometry = useMemo(to92Geometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const leadPins = pins ?? [
    { id: "vs", position: [-unit, 0, 0] as V3 },
    { id: "vout", position: [0, 0, 0] as V3 },
    { id: "gnd", position: [unit, 0, 0] as V3 },
  ];
  return (
    <group scale={scale}>
      <mesh
        geometry={geometry}
        position={[0, 0.105, 0]}
        rotation={[0, face === 1 ? 0 : Math.PI, 0]}
      >
        <meshStandardMaterial
          color={dim ? "#646d62" : "#262c28"}
          roughness={0.64}
        />
      </mesh>
      {leadPins.map(({ id, position }, index) => (
        <CylinderBetween
          key={id}
          from={[position[0] / scale, -0.012, position[2] / scale]}
          to={[(index - 1) * 0.067, 0.124, 0]}
          radius={0.011}
          color="#c5c8bc"
        />
      ))}
      <BoardText
        position={[0, 0.244, face * 0.057]}
        rotation={face === 1 ? [0, 0, 0] : [0, Math.PI, 0]}
        size={0.045}
        width={0.176}
        color="#dce1d6"
      >
        LM35
      </BoardText>
      <BoardText
        position={[0, 0.18, face * 0.057]}
        rotation={face === 1 ? [0, 0, 0] : [0, Math.PI, 0]}
        size={0.031}
        width={0.143}
        color="#8fa392"
      >
        TO-92
      </BoardText>
    </group>
  );
}

/** 35 × 6 mm stainless-steel probe (DFRobot DFR0198), not the bare
 * TO-92 DS18B20. One continuous surface joins the cylindrical body and nose. */
function probeGeometry(unit: number) {
  const mm = unit / 2.54;
  const radius = 3 * mm;
  const length = 35 * mm;
  const profile = [new THREE.Vector2(0, 0)];
  for (let index = 1; index <= 10; index++) {
    const angle = ((index / 10) * Math.PI) / 2;
    profile.push(
      new THREE.Vector2(
        radius * Math.sin(angle),
        radius * (1 - Math.cos(angle)),
      ),
    );
  }
  profile.push(new THREE.Vector2(radius, length), new THREE.Vector2(0, length));
  const geometry = new THREE.LatheGeometry(profile, 24);
  geometry.rotateZ(-Math.PI / 2);
  return geometry;
}

export function Ds18b20ProbeModel({
  dim,
  outward = -1,
  unit = 0.13,
  boardWidth = 21.5 * 0.13,
  boardDepth = 8 * 0.13,
  pins,
}: ClimateModelProps) {
  const mm = unit / 2.54;
  const scale = unit / 0.13;
  const radius = 3 * mm;
  const length = 35 * mm;
  const xStart = -boardWidth / 2 + radius * 1.05;
  const rear = xStart + length;
  const z = outward * boardDepth * 0.19;
  const steelY = radius + 0.025 * scale;
  const split: V3 = [
    Math.min(boardWidth / 2 - 0.17 * scale, rear + 0.39 * scale),
    0.095 * scale,
    -outward * 0.07 * scale,
  ];
  const leadPins = useMemo(
    () =>
      pins ?? [
        {
          id: "VDD",
          position: [-boardWidth / 4, 0.18, (-outward * boardDepth) / 2] as V3,
        },
        { id: "DATA", position: [0, 0.18, (-outward * boardDepth) / 2] as V3 },
        {
          id: "GND",
          position: [boardWidth / 4, 0.18, (-outward * boardDepth) / 2] as V3,
        },
      ],
    [pins, boardWidth, boardDepth, outward],
  );
  const geometry = useMemo(() => probeGeometry(unit), [unit]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const jacket = useMemo<V3[]>(
    () => [
      [rear - 0.05 * scale, steelY, z],
      [rear + 0.21 * scale, steelY, z],
      [split[0] + 0.09 * scale, 0.12 * scale, z * 0.4],
      split,
    ],
    [rear, steelY, z, split[0], split[1], split[2], scale],
  );
  const wires = useMemo(
    () =>
      leadPins.map(({ id, position }, index) => ({
        id,
        end: position,
        color: PIN_COLORS[id] ?? PIN_COLORS.DATA,
        points: [
          [split[0] + (index - 1) * 0.018 * scale, split[1], split[2]],
          [
            split[0] + (index - 1) * 0.047 * scale,
            split[1] + 0.025 * scale,
            split[2] - outward * 0.13 * scale,
          ],
          [
            (split[0] + position[0]) / 2,
            Math.max(split[1], position[1]) + 0.035 * scale,
            position[2] + outward * 0.17 * scale,
          ],
          [position[0], position[1], position[2] + outward * 0.027 * scale],
        ] as V3[],
      })),
    [leadPins, scale, outward, split[0], split[1], split[2]],
  );
  return (
    <group>
      <mesh geometry={geometry} position={[xStart, steelY, z]}>
        <meshStandardMaterial
          color={dim ? "#a1aaa2" : "#cbd5d0"}
          metalness={0.84}
          roughness={0.25}
        />
      </mesh>
      <mesh
        position={[rear - 0.01 * scale, steelY, z]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <cylinderGeometry
          args={[radius * 0.65, radius * 1.015, 0.19 * scale, 20]}
        />
        <meshStandardMaterial color="#272e2c" roughness={0.7} />
      </mesh>
      <Tube
        points={jacket}
        radius={0.052 * scale}
        color={dim ? "#69756a" : "#202925"}
      />
      {wires.map(({ id, end, color, points }) => (
        <group key={id}>
          <Tube points={points} radius={0.021 * scale} color={color} />
          <CylinderBetween
            from={points.at(-1)!}
            to={end}
            radius={0.011 * scale}
            color="#c9c4a6"
          />
        </group>
      ))}
      <BoardText
        position={[xStart + length * 0.57, steelY + radius + 0.004 * scale, z]}
        size={0.08 * scale}
        width={0.64 * scale}
        color="#40534a"
      >
        DS18B20
      </BoardText>
    </group>
  );
}

/** SensorBody owns the inserted legs and module terminal hit targets.
 * Only the probe owns its three flexible leads, which terminate exactly
 * at modulePinXY so physical labels and clickable endpoints coincide. */
export function ClimateSensor({
  part,
  dim,
  unit = 0.13,
}: {
  part: PartInstance;
  dim: boolean;
  flow?: boolean;
  unit?: number;
}) {
  const points = Object.values(part.holes ?? {}).map(pointXY);
  const box = moduleBox(part);
  const center = points.length
    ? {
        x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
        y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
      }
    : { x: box.x + box.w / 2, y: box.y + box.h / 2 };
  const outward: 1 | -1 = center.y > 8.5 ? 1 : -1;
  const pins = partDef(part).pins.map(({ id }) => {
    const point = part.holes?.[id]
      ? pointXY(part.holes[id])
      : modulePinXY(part, id);
    return {
      id,
      position: [
        (point.x - center.x) * unit,
        part.holes ? 0 : 0.18,
        (point.y - center.y) * unit,
      ] as V3,
    };
  });
  const props: ClimateModelProps = {
    dim,
    outward,
    unit,
    pins,
    boardWidth: box.w * unit,
    boardDepth: box.h * unit,
  };
  if (part.type === "dht11") return <Dht11ModuleModel {...props} />;
  if (part.type === "lm35") return <Lm35Model {...props} />;
  if (part.type === "ds18b20") return <Ds18b20ProbeModel {...props} />;
  return null;
}
