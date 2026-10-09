import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export type V3 = [number, number, number];

export function Tube({
  points,
  radius = 0.025,
  color,
  opacity = 1,
  emissive = false,
}: {
  points: V3[];
  radius?: number;
  color: string;
  opacity?: number;
  emissive?: boolean;
}) {
  const geometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        new THREE.CatmullRomCurve3(
          points.map((point) => new THREE.Vector3(...point)),
        ),
        Math.max(12, points.length * 10),
        radius,
        8,
        false,
      ),
    [points, radius],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={color}
        roughness={0.36}
        metalness={0.18}
        transparent={opacity < 1}
        opacity={opacity}
        emissive={emissive ? color : "#000"}
        emissiveIntensity={emissive ? 0.28 : 0}
      />
    </mesh>
  );
}

export function MovingSignal({
  points,
  color = "#d6f96c",
  animate,
  count = 3,
  size = 0.05,
}: {
  points: V3[];
  color?: string;
  animate: boolean;
  count?: number;
  size?: number;
}) {
  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        points.map((point) => new THREE.Vector3(...point)),
      ),
    [points],
  );
  const group = useRef<THREE.Group>(null);
  const elapsed = useRef(0);
  useFrame((_, delta) => {
    if (!group.current || !animate) return;
    elapsed.current += Math.min(delta, 0.05);
    group.current.children.forEach((child, index) =>
      child.position.copy(
        curve.getPoint((elapsed.current * 0.17 + index / count) % 1),
      ),
    );
  });
  return (
    <group ref={group}>
      {Array.from({ length: count }, (_, index) => (
        <mesh key={index} position={curve.getPoint(index / count)}>
          <sphereGeometry args={[size, 10, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

/** All labels are generated locally. No remote font/texture request is needed. */
export function BoardText({
  children,
  position,
  size = 0.09,
  color = "#3b5148",
  width,
  rotation = [-Math.PI / 2, 0, 0],
}: {
  children: string;
  position: V3;
  size?: number;
  color?: string;
  width?: number;
  rotation?: V3;
}) {
  const label = useMemo(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d")!;
    const font = "600 64px system-ui, sans-serif";
    context.font = font;
    canvas.width = Math.max(
      64,
      Math.min(1024, Math.ceil(context.measureText(children).width) + 20),
    );
    canvas.height = 96;
    // Setting the canvas dimensions resets its drawing state.
    context.font = font;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = color;
    context.fillText(
      children,
      canvas.width / 2,
      canvas.height / 2,
      canvas.width - 12,
    );
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return { texture: result, aspect: canvas.width / canvas.height };
  }, [children, color]);
  useEffect(() => () => label.texture.dispose(), [label]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[width ?? size * label.aspect, size]} />
      <meshBasicMaterial
        map={label.texture}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function CylinderBetween({
  from,
  to,
  radius,
  color,
}: {
  from: V3;
  to: V3;
  radius: number;
  color: string;
}) {
  const start = new THREE.Vector3(...from),
    end = new THREE.Vector3(...to);
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    end.sub(start).normalize(),
  );
  return (
    <mesh position={midpoint} quaternion={quaternion}>
      <cylinderGeometry
        args={[
          radius,
          radius,
          new THREE.Vector3(...from).distanceTo(new THREE.Vector3(...to)),
          12,
        ]}
      />
      <meshStandardMaterial color={color} roughness={0.3} metalness={0.65} />
    </mesh>
  );
}
