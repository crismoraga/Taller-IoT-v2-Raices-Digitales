import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { pointXY } from "../../circuit/breadboard";
import { moduleBox, rainPlateBox } from "../../circuit/geometry";
import type { PartInstance } from "../../circuit/model";
import { HardwareBody } from "../HardwareModels";
import { BoardText, Tube, type V3 } from "../Primitives";

/** Bodies are local to the part centre. External connector pins, labels and
 * breadboard leads belong to CircuitExperience's shared endpoint renderer. */
export interface AnalogSensorProps {
  part: PartInstance;
  dim?: boolean;
  flow?: boolean;
  /** World units per 2.54 mm breadboard pitch. */
  unit?: number;
}

type Strip = { position: V3; size: V3; rotation?: V3 };

/** Tracks, vents and grilles share one draw call instead of one per line. */
function Strips({
  strips,
  color,
  metalness = 0.3,
}: {
  strips: Strip[];
  color: string;
  metalness?: number;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const object = new THREE.Object3D();
    strips.forEach((strip, index) => {
      object.position.set(...strip.position);
      object.scale.set(...strip.size);
      object.rotation.set(...(strip.rotation ?? [0, 0, 0]));
      object.updateMatrix();
      mesh.current!.setMatrixAt(index, object.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [strips]);
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, strips.length]}>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color={color}
        metalness={metalness}
        roughness={0.52}
      />
    </instancedMesh>
  );
}

/** The mounting holes are actual cutouts in the PCB, visible from both sides. */
function Pcb({
  width,
  depth,
  color,
  holes = [],
  thickness = 0.075,
}: {
  width: number;
  depth: number;
  color: string;
  holes?: V3[];
  thickness?: number;
}) {
  const holeKey = holes.map((hole) => hole.join(",")).join(";");
  const geometry = useMemo(() => {
    const shape = new THREE.Shape();
    const x = width / 2,
      z = depth / 2,
      r = Math.min(0.035, width / 12);
    shape.moveTo(-x + r, -z);
    shape.lineTo(x - r, -z);
    shape.quadraticCurveTo(x, -z, x, -z + r);
    shape.lineTo(x, z - r);
    shape.quadraticCurveTo(x, z, x - r, z);
    shape.lineTo(-x + r, z);
    shape.quadraticCurveTo(-x, z, -x, z - r);
    shape.lineTo(-x, -z + r);
    shape.quadraticCurveTo(-x, -z, -x + r, -z);
    holes.forEach(([cx, , cz]) => {
      const hole = new THREE.Path();
      // Shape coordinates invert Z when rotated into the horizontal plane.
      hole.absarc(cx, -cz, 0.04, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    });
    const result = new THREE.ExtrudeGeometry(shape, {
      depth: thickness,
      curveSegments: 6,
      bevelEnabled: false,
    });
    result.rotateX(-Math.PI / 2);
    result.translate(0, -thickness / 2, 0);
    result.computeVertexNormals();
    return result;
  }, [width, depth, thickness, holeKey]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color={color} roughness={0.62} metalness={0.06} />
      </mesh>
      {holes.map(([x, , z], index) => (
        <mesh
          key={index}
          position={[x, thickness / 2 + 0.003, z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.041, 0.066, 18]} />
          <meshStandardMaterial
            color="#bda569"
            metalness={0.7}
            roughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
}

function Smd({
  position,
  size = [0.065, 0.03, 0.035],
  color = "#b0a68d",
}: {
  position: V3;
  size?: V3;
  color?: string;
}) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.65} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * size[0] * 0.42, 0, 0]}>
          <boxGeometry
            args={[size[0] * 0.16, size[1] + 0.003, size[2] + 0.003]}
          />
          <meshStandardMaterial
            color="#c4ccc4"
            metalness={0.75}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

function PowerLed({ position, flow }: { position: V3; flow: boolean }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.04, 0.026, 0.045]} />
      <meshStandardMaterial
        color={flow ? "#b5e27b" : "#c4d2b0"}
        emissive={flow ? "#9fd354" : "#000"}
        emissiveIntensity={flow ? 0.65 : 0}
        roughness={0.35}
      />
    </mesh>
  );
}

function Chip({
  position,
  width = 0.19,
  depth = 0.2,
  label,
}: {
  position: V3;
  width?: number;
  depth?: number;
  label?: string;
}) {
  const legs = useMemo(
    () =>
      [-1, 1].flatMap((side) =>
        Array.from({ length: 4 }, (_, index) => ({
          position: [
            side * (width / 2 + 0.02),
            0.015,
            ((index - 1.5) * depth) / 4,
          ] as V3,
          size: [0.055, 0.012, 0.018] as V3,
        })),
      ),
    [width, depth],
  );
  return (
    <group position={position}>
      <HardwareBody
        size={[width, 0.07, depth]}
        color="#252a25"
        radius={0.009}
        bevel={0.003}
        roughness={0.72}
      />
      <Strips strips={legs} color="#b4c0b3" metalness={0.75} />
      {label && (
        <BoardText
          position={[0, 0.039, 0]}
          size={0.045}
          color="#deddd1"
          width={width * 0.85}
        >
          {label}
        </BoardText>
      )}
    </group>
  );
}

function Trimmer({
  position,
  color = "#2163b0",
}: {
  position: V3;
  color?: string;
}) {
  return (
    <group position={position}>
      <HardwareBody
        size={[0.24, 0.2, 0.24]}
        color={color}
        radius={0.016}
        bevel={0.006}
        roughness={0.61}
      />
      <mesh position={[0, 0.104, 0]}>
        <cylinderGeometry args={[0.064, 0.064, 0.01, 20]} />
        <meshStandardMaterial
          color="#c9b278"
          metalness={0.68}
          roughness={0.33}
        />
      </mesh>
      <mesh position={[0, 0.111, 0]} rotation={[0, 0.42, 0]}>
        <boxGeometry args={[0.105, 0.004, 0.017]} />
        <meshStandardMaterial color="#594e34" roughness={0.9} />
      </mesh>
    </group>
  );
}

function Soil({
  width,
  depth,
  front,
  dim,
  unit,
}: {
  width: number;
  depth: number;
  front: number;
  dim: boolean;
  unit: number;
}) {
  const geometry = useMemo(() => {
    const w = width / 2,
      tip = -depth / 2,
      head = depth / 2;
    const outline = new THREE.Shape();
    outline.moveTo(-w * 0.82, head);
    outline.lineTo(w * 0.82, head);
    outline.lineTo(w * 0.82, head - depth * 0.22);
    outline.lineTo(w, head - depth * 0.25);
    outline.lineTo(w, tip + width * 0.42);
    outline.quadraticCurveTo(w, tip, 0, tip);
    outline.quadraticCurveTo(-w, tip, -w, tip + width * 0.42);
    outline.lineTo(-w, head - depth * 0.25);
    outline.lineTo(-w * 0.82, head - depth * 0.22);
    outline.closePath();
    const result = new THREE.ExtrudeGeometry(outline, {
      depth: 0.075,
      bevelEnabled: false,
      curveSegments: 10,
    });
    // The electronics/header end is +Z for a module above the breadboard.
    result.rotateX(Math.PI / 2);
    result.translate(0, 0.0375, 0);
    result.computeVertexNormals();
    return result;
  }, [width, depth]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const electrode = useMemo(() => {
    const left = -width * 0.36,
      right = width * 0.36;
    const near = depth * 0.12,
      far = -depth * 0.42;
    return [
      {
        position: [left, 0.041, (near + far) / 2] as V3,
        size: [0.011, 0.002, near - far] as V3,
      },
      {
        position: [right, 0.041, (near + far) / 2] as V3,
        size: [0.011, 0.002, near - far] as V3,
      },
      {
        position: [0, 0.041, near] as V3,
        size: [right - left, 0.002, 0.011] as V3,
      },
      {
        position: [0, 0.041, far] as V3,
        size: [right - left, 0.002, 0.011] as V3,
      },
    ];
  }, [width, depth]);
  return (
    <group rotation={[0, front < 0 ? Math.PI : 0, 0]}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial
          color={dim ? "#637364" : "#202b22"}
          roughness={0.64}
        />
      </mesh>
      {/* The sensing copper is coated, not exposed resistive fingers. */}
      <Strips
        strips={electrode}
        color={dim ? "#788575" : "#647143"}
        metalness={0.12}
      />
      <Chip
        position={[-width * 0.12, 0.086, depth * 0.32]}
        width={unit * 1.5}
        depth={unit * 1.9}
      />
      {[-1, 0, 1].map((index) => (
        <Smd
          key={index}
          position={[width * 0.18, 0.064, depth * 0.3 + index * unit * 0.6]}
        />
      ))}
      <BoardText
        position={[0, 0.044, -depth * 0.035]}
        size={unit * 0.68}
        color="#c6cec0"
        width={width * 0.82}
      >
        CAPACITIVA
      </BoardText>
      <BoardText
        position={[0, 0.044, depth * 0.18]}
        size={unit * 0.53}
        color="#adbda5"
      >
        v1.2
      </BoardText>
      <BoardText
        position={[0, 0.044, -depth * 0.27]}
        size={unit * 0.55}
        color="#899e77"
      >
        SUELO
      </BoardText>
    </group>
  );
}

function Water({
  width,
  depth,
  front,
  dim,
  flow,
  unit,
}: {
  width: number;
  depth: number;
  front: number;
  dim: boolean;
  flow: boolean;
  unit: number;
}) {
  const strips = useMemo(() => {
    const count = 10,
      left = -width * 0.4,
      span = width * 0.8;
    const near = depth * 0.18,
      far = -depth * 0.46;
    const tracks: Strip[] = Array.from({ length: count }, (_, index) => {
      const a = index % 2 ? far : far + unit * 0.6;
      const b = index % 2 ? near - unit * 0.6 : near;
      return {
        position: [
          left + (span * index) / (count - 1),
          0.041,
          (a + b) / 2,
        ] as V3,
        size: [unit * 0.18, 0.006, b - a] as V3,
      };
    });
    // Alternating fingers join opposite buses: two electrodes, not ten pins.
    tracks.push(
      {
        position: [0, 0.041, near],
        size: [span + unit * 0.2, 0.006, unit * 0.16],
      },
      {
        position: [0, 0.041, far],
        size: [span + unit * 0.2, 0.006, unit * 0.16],
      },
    );
    return tracks;
  }, [width, depth, unit]);
  const holes: V3[] = [
    [-width * 0.36, 0, depth * 0.37],
    [width * 0.36, 0, depth * 0.37],
  ];
  return (
    <group rotation={[0, front < 0 ? Math.PI : 0, 0]}>
      <Pcb
        width={width}
        depth={depth}
        color={dim ? "#a27d6d" : "#bb3f31"}
        holes={holes}
      />
      <Strips
        strips={strips}
        color={dim ? "#c1b38c" : "#dcb55e"}
        metalness={0.68}
      />
      <Chip
        position={[0, 0.085, depth * 0.3]}
        width={unit * 0.72}
        depth={unit * 1.2}
      />
      <Smd position={[-width * 0.23, 0.06, depth * 0.27]} />
      <Smd position={[width * 0.24, 0.06, depth * 0.27]} />
      <PowerLed position={[width * 0.22, 0.055, depth * 0.37]} flow={flow} />
      <BoardText
        position={[0, 0.046, depth * 0.19]}
        size={unit * 0.55}
        color="#f6e6c5"
        width={width * 0.8}
      >
        NIVEL DE AGUA
      </BoardText>
    </group>
  );
}

function Rain({
  part,
  width,
  depth,
  dim,
  flow,
  unit,
}: {
  part: PartInstance;
  width: number;
  depth: number;
  dim: boolean;
  flow: boolean;
  unit: number;
}) {
  const box = moduleBox(part),
    plate = rainPlateBox(part);
  const px = (plate.x + plate.w / 2 - box.x - box.w / 2) * unit;
  const pz = (plate.y + plate.h / 2 - box.y - box.h / 2) * unit;
  const pw = plate.w * unit,
    pd = plate.h * unit;
  const front = box.y < 0 ? 1 : -1;
  const strips = useMemo(() => {
    const count = 18,
      spacing = (pd * 0.8) / (count - 1);
    const result: Strip[] = Array.from({ length: count }, (_, index) => ({
      position: [
        index % 2 ? -pw * 0.03 : pw * 0.03,
        0.041,
        -pd * 0.4 + index * spacing,
      ] as V3,
      size: [pw * 0.83, 0.007, unit * 0.21] as V3,
    }));
    result.push(
      {
        position: [-pw * 0.43, 0.041, 0],
        size: [unit * 0.21, 0.007, pd * 0.82],
      },
      {
        position: [pw * 0.43, 0.041, 0],
        size: [unit * 0.21, 0.007, pd * 0.82],
      },
    );
    return result;
  }, [pw, pd, unit]);
  const holes: V3[] = [-1, 1].flatMap((x) =>
    [-1, 1].map((z) => [x * pw * 0.45, 0, z * pd * 0.44] as V3),
  );
  return (
    <group>
      <Pcb width={width} depth={depth} color={dim ? "#728d8c" : "#245e72"} />
      <Chip
        position={[-width * 0.22, 0.087, 0]}
        width={unit * 1.4}
        depth={unit * 2}
        label="393"
      />
      <Trimmer position={[width * 0.21, 0.14, -front * depth * 0.1]} />
      <BoardText
        position={[0, 0.043, front * depth * 0.29]}
        size={unit * 0.53}
        color="#f1eccb"
      >
        LM393
      </BoardText>
      <Smd position={[-width * 0.25, 0.06, -front * depth * 0.33]} />
      <Smd position={[width * 0.25, 0.06, -front * depth * 0.33]} />
      <Smd position={[width * 0.25, 0.06, -front * depth * 0.25]} />
      <PowerLed
        position={[width * 0.24, 0.058, front * depth * 0.27]}
        flow={flow}
      />
      <HardwareBody
        position={[0, 0.073, -front * depth * 0.42]}
        size={[unit * 2, 0.09, unit * 0.6]}
        color="#253126"
        radius={0.01}
        bevel={0.003}
      />
      <group position={[px, 0, pz]}>
        <Pcb
          width={pw}
          depth={pd}
          color={dim ? "#818471" : "#3c4933"}
          holes={holes}
        />
        <Strips
          strips={strips}
          color={dim ? "#bcb8a0" : "#c8c4a7"}
          metalness={0.65}
        />
        <BoardText
          position={[0, 0.047, -pd * 0.45]}
          size={unit * 0.55}
          color="#e3dec2"
        >
          FC-37
        </BoardText>
      </group>
      {[-1, 1].map((side) => {
        const start: V3 = [side * unit * 0.5, 0.105, -front * depth * 0.42];
        const end: V3 = [
          px - pw * 0.43,
          0.055,
          pz - pd * 0.27 + side * unit * 0.5,
        ];
        return (
          <Tube
            key={side}
            points={[
              start,
              [width * 0.65, 0.2, -front * depth * 0.48],
              [px - pw * 0.5 - unit, 0.19, end[2]],
              end,
            ]}
            radius={unit * 0.065}
            color={side > 0 ? "#bc5545" : "#263b32"}
            opacity={dim ? 0.58 : 1}
          />
        );
      })}
    </group>
  );
}

function Ultrasound({
  part,
  dim,
  unit,
}: {
  part: PartInstance;
  dim: boolean;
  unit: number;
}) {
  const holes = Object.values(part.holes ?? {}).map(pointXY);
  const cy = holes.length
    ? holes.reduce((sum, hole) => sum + hole.y, 0) / holes.length
    : 0;
  const outward = cy > 8.5 ? 1 : -1;
  const mm = unit / 2.54;
  const width = 45 * mm,
    depth = 20 * mm,
    radius = 8 * mm;
  const grille = useMemo(() => {
    const strips: Strip[] = [];
    const aperture = radius * 0.76;
    for (let index = -5; index <= 5; index++) {
      const offset = (index * aperture) / 6;
      const length = Math.sqrt(aperture * aperture - offset * offset) * 2;
      strips.push({
        position: [offset, 0, 0],
        size: [mm * 0.22, length, mm * 0.13],
      });
      strips.push({
        position: [0, offset, 0],
        size: [length, mm * 0.22, mm * 0.13],
      });
    }
    return strips;
  }, [radius, mm]);
  return (
    <group position={[0, 0.01, 0]}>
      {/* HC-SR04's PCB stands behind the transducers; it is not a flat tray. */}
      <group position={[0, depth / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <Pcb width={width} depth={depth} color={dim ? "#728e9b" : "#2379ab"} />
      </group>
      <BoardText
        position={[0, unit * 0.48, outward * 0.043]}
        rotation={[0, outward < 0 ? Math.PI : 0, 0]}
        size={unit * 0.58}
        color="#e9ead0"
      >
        HC-SR04
      </BoardText>
      <group
        position={[0, depth / 2, -outward * 0.075]}
        rotation={[outward > 0 ? -Math.PI / 2 : Math.PI / 2, 0, 0]}
      >
        <Chip position={[0, 0, 0]} width={unit * 1.6} depth={unit * 1.5} />
      </group>
      {[-1, 1].map((side) => (
        <group
          key={side}
          position={[side * 13 * mm, depth / 2, outward * (6 * mm + 0.0375)]}
          rotation={[0, outward < 0 ? Math.PI : 0, 0]}
        >
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[radius, radius, 12 * mm, 40, 1, true]} />
            <meshStandardMaterial
              color={dim ? "#bbc3bd" : "#c5cfca"}
              metalness={0.84}
              roughness={0.24}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, 6 * mm]}>
            <ringGeometry args={[radius * 0.79, radius, 40]} />
            <meshStandardMaterial
              color="#d6dbd3"
              metalness={0.83}
              roughness={0.21}
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[0, 0, 5.75 * mm]}>
            <circleGeometry args={[radius * 0.78, 30]} />
            <meshStandardMaterial
              color="#263d37"
              metalness={0.4}
              roughness={0.8}
              side={THREE.DoubleSide}
            />
          </mesh>
          <group position={[0, 0, 5.86 * mm]}>
            <Strips strips={grille} color="#87918b" metalness={0.68} />
          </group>
        </group>
      ))}
    </group>
  );
}

function Pir({
  width,
  depth,
  front,
  dim,
  flow,
  unit,
}: {
  width: number;
  depth: number;
  front: number;
  dim: boolean;
  flow: boolean;
  unit: number;
}) {
  const radius = (23 * unit) / 2.54 / 2;
  const holes: V3[] = [
    [-width * 0.43, 0, 0],
    [width * 0.43, 0, 0],
  ];
  const lensGeometry = useMemo(() => {
    const result = new THREE.SphereGeometry(
      radius,
      24,
      10,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    );
    // Facets on a PIR are Fresnel lens segments, rather than a smooth ping-pong ball.
    const faceted = result.toNonIndexed();
    result.dispose();
    return faceted;
  }, [radius]);
  useEffect(() => () => lensGeometry.dispose(), [lensGeometry]);
  return (
    <group>
      <Pcb
        width={width}
        depth={depth}
        color={dim ? "#6f9973" : "#2b9763"}
        holes={holes}
      />
      <HardwareBody
        position={[0, 0.072, -front * depth * 0.09]}
        size={[radius * 2.12, 0.12, radius * 2.02]}
        color={dim ? "#d5dccb" : "#e8eade"}
        radius={0.055}
        bevel={0.009}
        roughness={0.64}
      />
      <mesh geometry={lensGeometry} position={[0, 0.13, -front * depth * 0.09]}>
        <meshPhysicalMaterial
          color={dim ? "#d9ddce" : "#f4f3e9"}
          roughness={0.42}
          clearcoat={0.35}
          clearcoatRoughness={0.3}
          flatShading
          transparent
          opacity={0.93}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <Trimmer
          key={side}
          position={[side * width * 0.21, -0.16, -front * depth * 0.28]}
          color="#e3a433"
        />
      ))}
      <Chip
        position={[0, -0.11, front * depth * 0.12]}
        width={unit * 2.4}
        depth={unit * 2.9}
        label="BISS"
      />
      <PowerLed
        position={[width * 0.36, 0.056, front * depth * 0.25]}
        flow={flow}
      />
      <BoardText
        position={[0, 0.043, front * depth * 0.35]}
        size={unit * 0.56}
        color="#e5e9c6"
      >
        HC-SR501
      </BoardText>
    </group>
  );
}

function Ldr({ dim, unit }: { dim: boolean; unit: number }) {
  const radius = (5.2 * unit) / 2.54 / 2;
  const strips = useMemo(() => {
    const result: Strip[] = [];
    const count = 7,
      gap = (radius * 1.42) / (count - 1);
    for (let index = 0; index < count; index++) {
      const x = -radius * 0.71 + index * gap;
      const span = Math.sqrt(radius * radius * 0.75 - x * x) * 2;
      result.push({ position: [x, 0, 0], size: [unit * 0.043, span, 0.005] });
      if (index < count - 1) {
        const nextX = x + gap;
        const nextSpan = Math.sqrt(radius * radius * 0.75 - nextX * nextX) * 2;
        const y = ((index % 2 ? -1 : 1) * Math.min(span, nextSpan)) / 2;
        result.push({
          position: [x + gap / 2, y, 0],
          size: [gap, unit * 0.043, 0.005],
        });
      }
    }
    return result;
  }, [radius, unit]);
  return (
    <group position={[0, radius + 0.025, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius, radius, 0.048, 30]} />
        <meshStandardMaterial
          color={dim ? "#ad9882" : "#b77a42"}
          roughness={0.79}
        />
      </mesh>
      <mesh position={[0, 0, 0.025]}>
        <circleGeometry args={[radius * 0.9, 28]} />
        <meshStandardMaterial
          color={dim ? "#c4b8a1" : "#d9c5a2"}
          roughness={0.76}
        />
      </mesh>
      <group position={[0, 0, 0.028]}>
        <Strips
          strips={strips}
          color={dim ? "#a48970" : "#ae5735"}
          metalness={0.12}
        />
      </group>
    </group>
  );
}

/** Recognisable original procedural models, with no downloaded texture/model. */
export function AnalogSensor({
  part,
  dim = false,
  flow = false,
  unit = 0.13,
}: AnalogSensorProps) {
  const box = moduleBox(part);
  const width = box.w * unit,
    depth = box.h * unit;
  const front = box.y < 0 ? 1 : -1;
  switch (part.type) {
    case "soil":
      return (
        <Soil width={width} depth={depth} front={front} dim={dim} unit={unit} />
      );
    case "water":
      return (
        <Water
          width={width}
          depth={depth}
          front={front}
          dim={dim}
          flow={flow}
          unit={unit}
        />
      );
    case "rain":
      return (
        <Rain
          part={part}
          width={width}
          depth={depth}
          dim={dim}
          flow={flow}
          unit={unit}
        />
      );
    case "hcsr04":
      return <Ultrasound part={part} dim={dim} unit={unit} />;
    case "pir":
      return (
        <Pir
          width={width}
          depth={depth}
          front={front}
          dim={dim}
          flow={flow}
          unit={unit}
        />
      );
    case "ldr":
      return <Ldr dim={dim} unit={unit} />;
    default:
      return null;
  }
}
