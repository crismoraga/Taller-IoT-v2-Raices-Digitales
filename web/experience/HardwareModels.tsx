import { useEffect, useLayoutEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import { useThree, type ThreeElements } from "@react-three/fiber";
import { isPoint } from "../circuit/breadboard";
import type { Circuit, PartInstance } from "../circuit/model";
import { partDef } from "../circuit/parts";
import { controllerPins } from "../circuit/boards";
import type { V3 } from "./Primitives";

/** Socketed Uno headers and breadboard holes accept a metal pin; exposed
 * Nano/module headers need a female sleeve. This follows the actual terminal,
 * rather than applying one connector shape to both ends of every cable. */
export function terminalConnector(circuit: Circuit, endpoint: string) {
  if (isPoint(endpoint)) return "macho" as const;
  if (endpoint.startsWith("controller."))
    return circuit.board === "uno" ? ("macho" as const) : ("hembra" as const);
  const part = circuit.parts.find(
    (entry) => entry.id === endpoint.split(".")[0],
  );
  if (part?.type === "soil" || part?.type === "ds18b20")
    return "integrado" as const;
  return "hembra" as const;
}

/** Low-cost local geometry for the characteristic flat edge beside a LED's
 * cathode. The flat faces +X; the component rotates it towards its cathode. */
export function ledFlangeGeometry(radius = 0.145, height = 0.025) {
  const angle = Math.acos(0.9);
  const outline = new THREE.Shape();
  outline.moveTo(radius * Math.cos(angle), radius * Math.sin(angle));
  outline.absarc(0, 0, radius, angle, Math.PI * 2 - angle, false);
  outline.closePath();
  const result = new THREE.ExtrudeGeometry(outline, {
    depth: height,
    steps: 1,
    curveSegments: 12,
    bevelEnabled: false,
  });
  result.rotateX(-Math.PI / 2);
  result.translate(0, -height / 2, 0);
  result.computeVertexNormals();
  return result;
}

/** One continuous barrel and dome prevents a visible seam in close-up views. */
export function ledDomeGeometry(radius = 0.125, barrelHeight = 0.19) {
  const profile = [
    new THREE.Vector2(0, 0.012),
    new THREE.Vector2(radius, 0.012),
  ];
  for (let index = 0; index <= 12; index++) {
    const angle = ((index / 12) * Math.PI) / 2;
    profile.push(
      new THREE.Vector2(
        Math.cos(angle) * radius,
        0.012 + barrelHeight + Math.sin(angle) * radius,
      ),
    );
  }
  return new THREE.LatheGeometry(profile, 24);
}

/** Both scenes use the same polarity: the flat edge and cup face +X. */
export const LED_POLARITY = {
  anode: { x: -0.057, leadLength: 0.31 },
  cathode: { x: 0.057, leadLength: 0.26 },
} as const;

export function LedOptic({
  color,
  lit = false,
  dim = false,
}: {
  color: string;
  lit?: boolean;
  dim?: boolean;
}) {
  const model = useMemo(
    () => ({ flange: ledFlangeGeometry(), dome: ledDomeGeometry() }),
    [],
  );
  useEffect(
    () => () => {
      model.flange.dispose();
      model.dome.dispose();
    },
    [model],
  );
  return (
    <group>
      <mesh geometry={model.dome}>
        <meshPhysicalMaterial
          color={color}
          emissive={lit ? color : "#000"}
          emissiveIntensity={lit ? 0.52 : 0}
          roughness={0.2}
          clearcoat={0.9}
          clearcoatRoughness={0.16}
          transparent
          opacity={dim ? 0.49 : 0.73}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={model.flange}>
        <meshStandardMaterial color={color} roughness={0.35} />
      </mesh>
      <mesh position={[0.037, 0.088, 0]}>
        <cylinderGeometry args={[0.048, 0.018, 0.022, 16]} />
        <meshStandardMaterial
          color="#c5d0c4"
          metalness={0.72}
          roughness={0.29}
        />
      </mesh>
      <mesh position={[-0.042, 0.068, 0]}>
        <boxGeometry args={[0.022, 0.045, 0.022]} />
        <meshStandardMaterial
          color="#b7c4b7"
          metalness={0.66}
          roughness={0.3}
        />
      </mesh>
      <mesh
        position={[-0.0025, 0.0955, 0]}
        rotation={[0, 0, -Math.atan2(0.079, 0.017)]}
      >
        <cylinderGeometry args={[0.003, 0.003, Math.hypot(0.079, 0.017), 6]} />
        <meshStandardMaterial color="#cfb66b" metalness={0.7} roughness={0.3} />
      </mesh>
    </group>
  );
}

/** Leads leave a tall connector upwards before arching towards the other endpoint. */
export function hardwareWireCurve(a: V3, b: V3): V3[] {
  const distance = Math.hypot(a[0] - b[0], a[2] - b[2]);
  const base = Math.max(a[1], b[1]);
  const height = Math.max(
    base + 0.22,
    Math.min(1.05, base + 0.22 + distance * 0.09),
  );
  return [
    a,
    [a[0], a[1] + (height - a[1]) * 0.7, a[2]],
    [(a[0] + b[0]) / 2, height, (a[2] + b[2]) / 2],
    [b[0], b[1] + (height - b[1]) * 0.7, b[2]],
    b,
  ];
}

/** Soft studio reflections generated once on this device; no external image download. */
export function HardwareStudio() {
  const { gl, scene, invalidate } = useThree();
  useLayoutEffect(() => {
    const faces = Array.from({ length: 6 }, (_, index) => {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = 128;
      const context = canvas.getContext("2d")!;
      const gradient = context.createLinearGradient(0, 0, 0, 128);
      gradient.addColorStop(0, index === 2 ? "#faf8e8" : "#9dafa1");
      gradient.addColorStop(0.46, index === 3 ? "#475146" : "#dce3d3");
      gradient.addColorStop(1, "#4d6253");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 128, 128);
      if (index === 0 || index === 4) {
        context.fillStyle = "#f9f8eb";
        context.fillRect(16, 12, 30, 72);
      }
      return canvas;
    });
    const cube = new THREE.CubeTexture(faces);
    cube.colorSpace = THREE.SRGBColorSpace;
    cube.needsUpdate = true;
    const generator = new THREE.PMREMGenerator(gl);
    const result = generator.fromCubemap(cube);
    cube.dispose();
    generator.dispose();
    const previous = scene.environment;
    const previousIntensity = scene.environmentIntensity;
    scene.environment = result.texture;
    scene.environmentIntensity = 0.46;
    invalidate();
    return () => {
      scene.environment = previous;
      scene.environmentIntensity = previousIntensity;
      result.dispose();
    };
  }, [gl, scene, invalidate]);
  return null;
}

/** Keep pin names in the inspector while resolving their physical holes for the scene. */
export function inspectedTerminals(part: PartInstance) {
  return part.holes
    ? Object.entries(part.holes).map(([pin, hole]) => `${pin} → ${hole}`)
    : partDef(part).pins.map((pin) => `${part.id}.${pin.id}`);
}

export function highlightedTerminals(
  circuit: Circuit,
  terminals?: readonly string[],
) {
  return (
    terminals
      ?.map((terminal) => terminal.split("→").at(-1)!.trim())
      .filter((terminal) => {
        if (isPoint(terminal)) return true;
        const [id, pin] = terminal.split(".");
        if (id === "controller")
          return controllerPins(circuit.board).some(
            (entry) => entry.name === pin,
          );
        const part = circuit.parts.find((entry) => entry.id === id);
        return !!part && partDef(part).pins.some((entry) => entry.id === pin);
      }) ?? []
  );
}

/** Locally generated moulded parts: bevels stay inside the given dimensions. */
export function HardwareBody({
  size,
  color,
  radius = 0.04,
  bevel = 0.008,
  roughness = 0.48,
  metalness = 0,
  children,
  ...props
}: Omit<ThreeElements["mesh"], "children"> & {
  size: [number, number, number];
  color: string;
  radius?: number;
  bevel?: number;
  roughness?: number;
  metalness?: number;
  children?: ReactNode;
}) {
  const [width, height, depth] = size;
  const geometry = useMemo(() => {
    const edge = Math.min(bevel, height / 4, width / 8, depth / 8);
    const x = width / 2 - edge;
    const z = depth / 2 - edge;
    const corner = Math.max(0.001, Math.min(radius - edge, x, z));
    const outline = new THREE.Shape();
    outline.moveTo(-x + corner, -z);
    outline.lineTo(x - corner, -z);
    outline.quadraticCurveTo(x, -z, x, -z + corner);
    outline.lineTo(x, z - corner);
    outline.quadraticCurveTo(x, z, x - corner, z);
    outline.lineTo(-x + corner, z);
    outline.quadraticCurveTo(-x, z, -x, z - corner);
    outline.lineTo(-x, -z + corner);
    outline.quadraticCurveTo(-x, -z, -x + corner, -z);
    const result = new THREE.ExtrudeGeometry(outline, {
      depth: height - edge * 2,
      steps: 1,
      curveSegments: 3,
      bevelEnabled: edge > 0,
      bevelSegments: 1,
      bevelThickness: edge,
      bevelSize: edge,
    });
    result.rotateX(-Math.PI / 2);
    result.translate(0, -height / 2 + edge, 0);
    result.computeVertexNormals();
    return result;
  }, [width, height, depth, radius, bevel]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh {...props} geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
      {children}
    </mesh>
  );
}

/** An open socket facing the left edge; the dark mouth is not a solid metal cube. */
export function UsbJack({
  kind,
  position,
}: {
  kind: "micro" | "mini" | "b";
  position: [number, number, number];
}) {
  const size: [number, number, number] =
    kind === "b"
      ? [0.43, 0.27, 0.48]
      : kind === "mini"
        ? [0.29, 0.2, 0.31]
        : [0.28, 0.16, 0.3];
  const [width, height, depth] = size;
  const wall = 0.018;
  return (
    <group position={position}>
      <HardwareBody
        size={[width, wall, depth]}
        position={[0, height / 2 - wall / 2, 0]}
        color="#c5cfc9"
        radius={0.025}
        bevel={0.003}
        roughness={0.27}
        metalness={0.84}
      />
      <HardwareBody
        size={[width, wall, depth]}
        position={[0, -height / 2 + wall / 2, 0]}
        color="#9ba9a2"
        radius={0.025}
        bevel={0.003}
        roughness={0.31}
        metalness={0.84}
      />
      {[-1, 1].map((side) => (
        <HardwareBody
          key={side}
          size={[width, height - wall * 2, wall]}
          position={[0, 0, side * (depth / 2 - wall / 2)]}
          color="#aebbb3"
          radius={0.006}
          bevel={0.002}
          roughness={0.28}
          metalness={0.82}
        />
      ))}
      <mesh position={[width / 2 - wall, 0, 0]}>
        <boxGeometry args={[wall, height - wall * 2, depth - wall * 2]} />
        <meshStandardMaterial color="#172a22" roughness={0.73} />
      </mesh>
      <mesh position={[-0.015, kind === "b" ? -0.035 : 0, 0]}>
        <boxGeometry
          args={[width * 0.67, kind === "b" ? 0.095 : 0.026, depth * 0.55]}
        />
        <meshStandardMaterial color="#d9ddca" roughness={0.55} />
      </mesh>
      {Array.from({ length: kind === "b" ? 4 : 5 }, (_, index) => (
        <mesh
          key={index}
          position={[
            -width * 0.15,
            kind === "b" ? 0.017 : 0.016,
            (index - (kind === "b" ? 1.5 : 2)) * depth * 0.087,
          ]}
        >
          <boxGeometry args={[width * 0.43, 0.005, 0.013]} />
          <meshStandardMaterial
            color="#cfb66b"
            roughness={0.32}
            metalness={0.73}
          />
        </mesh>
      ))}
    </group>
  );
}

/** A single reusable bevel geometry for all 830 square sockets. */
export function socketRimGeometry() {
  const outer = 0.035;
  const inner = 0.0245;
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const positions = corners.flatMap(([x, z]) => [x * outer, 0.002, z * outer]);
  positions.push(
    ...corners.flatMap(([x, z]) => [x * inner, -0.009, z * inner]),
  );
  const indices: number[] = [];
  for (let index = 0; index < 4; index++) {
    const next = (index + 1) % 4;
    indices.push(index, index + 4, next, next, index + 4, next + 4);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(positions, 3),
  );
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
