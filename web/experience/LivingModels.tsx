import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Board } from "../lib/context";
import { BoardText, Tube, type V3 } from "./Primitives";

/** Small, locally generated models: no texture downloads or runtime asset fetches. */
export function LivingLeaf({
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
  const model = useMemo(() => {
    const vertices: number[] = [];
    const colors: number[] = [];
    const indexes: number[] = [];
    const sections = 22;
    const spans = 6;
    const base = new THREE.Color(color);
    const edge = new THREE.Color(color).multiplyScalar(0.85);
    const tip = new THREE.Color("#c5e7a5");
    const point = (t: number, across: number): V3 => {
      const outline = Math.pow(Math.sin(t * Math.PI), 0.78);
      const spread = outline * width;
      const curl = Math.sin(t * Math.PI) * length * 0.16;
      return [
        across * spread,
        t * length,
        curl -
          Math.abs(across) ** 1.3 * spread * 0.28 +
          Math.sin(t * Math.PI * 3) * Math.abs(across) * width * 0.028,
      ];
    };
    for (let i = 0; i <= sections; i++) {
      const t = i / sections;
      for (let j = 0; j <= spans; j++) {
        const across = (j / spans) * 2 - 1;
        vertices.push(...point(t, across));
        const shade = base
          .clone()
          .lerp(edge, Math.abs(across) * 0.5)
          .lerp(tip, t ** 2 * 0.23);
        colors.push(shade.r, shade.g, shade.b);
      }
    }
    for (let i = 0; i < sections; i++) {
      for (let j = 0; j < spans; j++) {
        const a = i * (spans + 1) + j;
        const b = a + 1;
        const c = a + spans + 1;
        indexes.push(a, b, c + 1, a, c + 1, c);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(vertices, 3),
    );
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indexes);
    geometry.computeVertexNormals();
    const mainVein: V3[] = Array.from({ length: 12 }, (_, i) => {
      const p = point(i / 11, 0);
      p[2] += 0.008;
      return p;
    });
    const veins: V3[][] = [];
    for (const side of [-1, 1]) {
      for (const t of [0.23, 0.39, 0.55, 0.7]) {
        veins.push(
          Array.from({ length: 5 }, (_, i) => {
            const across = (i / 4) * 0.88 * side;
            const p = point(t + (i / 4) * 0.13, across);
            p[2] += 0.008;
            return p;
          }),
        );
      }
    }
    return { geometry, mainVein, veins };
  }, [length, width, color]);
  useEffect(() => () => model.geometry.dispose(), [model]);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={model.geometry} castShadow>
        <meshPhysicalMaterial
          vertexColors
          side={THREE.DoubleSide}
          roughness={0.61}
          clearcoat={0.15}
          clearcoatRoughness={0.68}
          sheen={0.4}
          sheenColor="#afd19b"
          sheenRoughness={0.8}
        />
      </mesh>
      <Tube points={model.mainVein} radius={0.008} color="#b1cc8b" />
      {model.veins.map((points, index) => (
        <Tube key={index} points={points} radius={0.0034} color="#8cb774" />
      ))}
    </group>
  );
}

function SoilDetails({ roots }: { roots: boolean }) {
  const reference = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!reference.current) return;
    const dummy = new THREE.Object3D();
    const shade = new THREE.Color();
    for (let i = 0; i < 46; i++) {
      const angle = i * 2.39996322973;
      const distance = Math.sqrt((i + 0.5) / 46) * 0.94;
      dummy.position.set(
        Math.cos(angle) * distance,
        1.569 + (i % 3) * 0.002,
        Math.sin(angle) * distance,
      );
      dummy.rotation.set(i * 0.37, i * 1.2, i * 0.49);
      dummy.scale.set(
        0.022 + (i % 4) * 0.008,
        0.012 + (i % 3) * 0.004,
        0.024 + (i % 5) * 0.007,
      );
      dummy.updateMatrix();
      reference.current.setMatrixAt(i, dummy.matrix);
      shade.set(i % 8 === 0 ? "#afa081" : i % 3 === 0 ? "#6e5941" : "#44382a");
      reference.current.setColorAt(i, shade);
    }
    reference.current.instanceMatrix.needsUpdate = true;
    if (reference.current.instanceColor)
      reference.current.instanceColor.needsUpdate = true;
  }, []);
  return (
    <instancedMesh
      ref={reference}
      args={[undefined, undefined, 46]}
      visible={!roots}
    >
      <dodecahedronGeometry args={[1, 0]} />
      <meshStandardMaterial roughness={1} />
    </instancedMesh>
  );
}

export function LivingPot({ roots, soil }: { roots: boolean; soil?: number }) {
  const geometry = useMemo(() => {
    // A rounded lip, hollow interior and foot make the ceramic read as an object.
    const profile = [
      [0.68, 0.08],
      [0.78, 0.08],
      [0.8, 0.13],
      [0.8, 0.2],
      [0.84, 0.25],
      [1.02, 1.43],
      [1.09, 1.49],
      [1.12, 1.56],
      [1.11, 1.61],
      [1.06, 1.64],
      [1.01, 1.61],
      [0.99, 1.55],
      [0.97, 1.44],
      [0.72, 0.25],
      [0.68, 0.21],
      [0.68, 0.08],
    ];
    return new THREE.LatheGeometry(
      profile.map(([x, y]) => new THREE.Vector2(x, y)),
      64,
    );
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group>
      <mesh geometry={geometry} castShadow={!roots} receiveShadow>
        <meshPhysicalMaterial
          color="#c9845f"
          roughness={0.48}
          clearcoat={0.12}
          clearcoatRoughness={0.5}
          transparent={roots}
          opacity={roots ? 0.13 : 1}
          depthWrite={!roots}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 0.048, 0]} receiveShadow>
        <cylinderGeometry args={[1.03, 1.06, 0.078, 64]} />
        <meshStandardMaterial color="#a86b4f" roughness={0.66} />
      </mesh>
      <mesh position={[0, 0.085, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.025, 0.045, 10, 64]} />
        <meshPhysicalMaterial
          color="#b77551"
          roughness={0.48}
          clearcoat={0.13}
        />
      </mesh>
      {[0.5, 0.96, 1.24].map((height) => (
        <mesh
          key={height}
          position={[0, height, 0]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <torusGeometry
            args={[0.84 + (height - 0.25) * 0.151, 0.0035, 4, 64]}
          />
          <meshStandardMaterial
            color="#b87553"
            roughness={0.65}
            transparent={roots}
            opacity={roots ? 0.1 : 0.5}
            depthWrite={!roots}
          />
        </mesh>
      ))}
      <mesh position={[0, 1.513, 0]} receiveShadow>
        <cylinderGeometry args={[0.98, 0.98, 0.11, 64]} />
        <meshStandardMaterial
          color={
            soil === undefined ? "#463d2e" : soil > 50 ? "#302b22" : "#584731"
          }
          transparent={roots}
          opacity={roots ? 0.15 : 1}
          depthWrite={!roots}
          roughness={1}
        />
      </mesh>
      <SoilDetails roots={roots} />
    </group>
  );
}

function BreadboardHoles() {
  const reference = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!reference.current) return;
    const dummy = new THREE.Object3D();
    let index = 0;
    for (let x = 0; x < 11; x++) {
      for (let z = 0; z < 6; z++) {
        dummy.position.set(-0.66 + x * 0.13, 0.094, -0.41 + z * 0.165);
        dummy.updateMatrix();
        reference.current.setMatrixAt(index++, dummy.matrix);
      }
    }
    reference.current.instanceMatrix.needsUpdate = true;
  }, []);
  return (
    <instancedMesh ref={reference} args={[undefined, undefined, 66]}>
      <boxGeometry args={[0.036, 0.011, 0.04]} />
      <meshStandardMaterial color="#4e5649" roughness={0.92} />
    </instancedMesh>
  );
}

function Header({
  count,
  position,
  female = false,
  pitch = 0.057,
}: {
  count: number;
  position: V3;
  female?: boolean;
  pitch?: number;
}) {
  return (
    <group position={position}>
      {female && (
        <mesh position={[((count - 1) * pitch) / 2, 0.032, 0]}>
          <boxGeometry args={[count * pitch, 0.074, 0.064]} />
          <meshStandardMaterial color="#182b29" roughness={0.7} />
        </mesh>
      )}
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[i * pitch, female ? 0.071 : 0.035, 0]}>
          <boxGeometry
            args={[female ? 0.021 : 0.019, female ? 0.004 : 0.073, 0.02]}
          />
          <meshStandardMaterial
            color={female ? "#565b4a" : "#d5b969"}
            metalness={0.75}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

export function LivingBoard({ board }: { board: Board }) {
  const uno = board === "uno";
  const arduino = board !== "pico";
  const width = uno ? 1.2 : 1.02;
  const depth = uno ? 0.78 : 0.43;
  return (
    <group>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[1.55, 0.17, 1.08]} />
        <meshStandardMaterial color="#ecebd6" roughness={0.75} />
      </mesh>
      <mesh position={[0, 0.091, 0]}>
        <boxGeometry args={[1.43, 0.008, 0.036]} />
        <meshStandardMaterial color="#c1c7b4" roughness={0.93} />
      </mesh>
      <BreadboardHoles />
      <BoardText position={[0.62, 0.101, 0.37]} size={0.06} color="#7c8571">
        +
      </BoardText>
      <BoardText position={[-0.65, 0.101, 0.37]} size={0.06} color="#7c8571">
        −
      </BoardText>
      <group position={[-0.2, 0.18, -0.08]}>
        <mesh castShadow receiveShadow>
          <boxGeometry args={[width, 0.043, depth]} />
          <meshPhysicalMaterial
            color={arduino ? "#277d87" : "#277653"}
            roughness={0.5}
            clearcoat={0.25}
            clearcoatRoughness={0.52}
          />
        </mesh>
        <mesh position={[uno ? 0.09 : 0.1, 0.054, 0]}>
          <boxGeometry args={[uno ? 0.4 : 0.2, 0.065, uno ? 0.14 : 0.2]} />
          <meshStandardMaterial color="#202c28" roughness={0.67} />
        </mesh>
        {[-1, 1].flatMap((side) =>
          Array.from({ length: uno ? 8 : 5 }, (_, i) => (
            <mesh
              key={`chip-${side}-${i}`}
              position={[
                uno ? -0.08 + i * 0.046 : 0.022 + i * 0.036,
                0.039,
                side * (uno ? 0.089 : 0.116),
              ]}
            >
              <boxGeometry args={[0.024, 0.018, 0.046]} />
              <meshStandardMaterial
                color="#a1aaa0"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
          )),
        )}
        <group position={[-width / 2 + 0.063, 0.07, 0]}>
          <mesh>
            <boxGeometry args={[uno ? 0.22 : 0.16, uno ? 0.15 : 0.092, 0.18]} />
            <meshStandardMaterial
              color="#b9c3b9"
              metalness={0.87}
              roughness={0.26}
            />
          </mesh>
          <mesh position={[-(uno ? 0.111 : 0.081), 0, 0]}>
            <boxGeometry args={[0.004, uno ? 0.083 : 0.046, 0.122]} />
            <meshStandardMaterial color="#36433b" roughness={0.7} />
          </mesh>
        </group>
        {uno ? (
          <>
            <Header count={8} position={[-0.53, 0.025, -0.35]} female />
            <Header count={6} position={[-0.025, 0.025, -0.35]} female />
            <Header count={8} position={[-0.53, 0.025, 0.35]} female />
            <Header count={6} position={[-0.025, 0.025, 0.35]} female />
          </>
        ) : (
          <>
            <Header
              count={board === "pico" ? 20 : 15}
              position={[-width / 2 + 0.04, 0.025, depth / 2 - 0.032]}
              pitch={(width - 0.08) / (board === "pico" ? 19 : 14)}
            />
            <Header
              count={board === "pico" ? 20 : 15}
              position={[-width / 2 + 0.04, 0.025, -depth / 2 + 0.032]}
              pitch={(width - 0.08) / (board === "pico" ? 19 : 14)}
            />
          </>
        )}
        {uno ? (
          <>
            <mesh position={[-0.43, 0.073, 0.27]}>
              <boxGeometry args={[0.19, 0.14, 0.15]} />
              <meshStandardMaterial color="#1e2e29" roughness={0.68} />
            </mesh>
            <mesh position={[-0.31, 0.065, -0.27]}>
              <boxGeometry args={[0.07, 0.06, 0.065]} />
              <meshStandardMaterial color="#e4ded0" roughness={0.55} />
            </mesh>
          </>
        ) : board === "pico" ? (
          <mesh position={[0.36, 0.053, 0.035]}>
            <boxGeometry args={[0.27, 0.046, 0.3]} />
            <meshStandardMaterial
              color="#b5c1ab"
              metalness={0.78}
              roughness={0.36}
            />
          </mesh>
        ) : null}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.25 + i * 0.077, 0.034, -0.07]}>
            <boxGeometry args={[0.034, 0.022, 0.018]} />
            <meshStandardMaterial color="#c3b79c" roughness={0.75} />
          </mesh>
        ))}
        <mesh position={[0.37, 0.032, -0.105]}>
          <boxGeometry args={[0.038, 0.021, 0.029]} />
          <meshStandardMaterial
            color="#d4ea87"
            emissive="#99bd61"
            emissiveIntensity={0.35}
            roughness={0.4}
          />
        </mesh>
        <BoardText
          position={[uno ? 0.05 : -0.12, 0.024, uno ? 0.2 : 0.12]}
          size={0.063}
          color="#e5efd6"
        >
          {uno ? "UNO" : arduino ? "NANO" : "PICO W"}
        </BoardText>
      </group>
    </group>
  );
}

export function LivingSoilProbe() {
  return (
    <group>
      <mesh castShadow>
        <boxGeometry args={[0.16, 1.02, 0.033]} />
        <meshPhysicalMaterial
          color="#327d55"
          roughness={0.57}
          clearcoat={0.18}
        />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.046, -0.16, 0.019]}>
          <boxGeometry args={[0.021, 0.54, 0.003]} />
          <meshStandardMaterial
            color="#9bae6c"
            metalness={0.47}
            roughness={0.45}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.385, 0.02]}>
        <boxGeometry args={[0.2, 0.24, 0.035]} />
        <meshStandardMaterial color="#285c40" roughness={0.61} />
      </mesh>
      <mesh position={[0, 0.4, 0.052]}>
        <boxGeometry args={[0.048, 0.067, 0.027]} />
        <meshStandardMaterial color="#26312b" roughness={0.61} />
      </mesh>
      <mesh position={[0, 0.519, 0.02]}>
        <boxGeometry args={[0.115, 0.054, 0.072]} />
        <meshStandardMaterial color="#1d2e24" roughness={0.71} />
      </mesh>
      {[-1, 0, 1].map((offset) => (
        <mesh key={offset} position={[offset * 0.037, 0.556, 0.026]}>
          <boxGeometry args={[0.012, 0.04, 0.012]} />
          <meshStandardMaterial
            color="#d3b35f"
            metalness={0.8}
            roughness={0.28}
          />
        </mesh>
      ))}
    </group>
  );
}

export function LivingLedLens({ on }: { on?: boolean }) {
  return (
    <group>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.057, -0.033, 0]}>
          <boxGeometry args={[0.015, side === 1 ? 0.31 : 0.26, 0.016]} />
          <meshStandardMaterial
            color="#b9c4b6"
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>
      ))}
      <mesh position={[0, 0.108, 0]}>
        <cylinderGeometry args={[0.119, 0.119, 0.035, 24]} />
        <meshPhysicalMaterial
          color={on === undefined ? "#a9b2a3" : on ? "#dfee84" : "#97ac60"}
          roughness={0.27}
          clearcoat={0.6}
          clearcoatRoughness={0.2}
        />
      </mesh>
      <mesh position={[0, 0.196, 0]}>
        <capsuleGeometry args={[0.099, 0.12, 8, 24]} />
        <meshPhysicalMaterial
          color={on === undefined ? "#9fa99b" : on ? "#e4f596" : "#8fa954"}
          emissive="#cce98a"
          emissiveIntensity={on ? 1.05 : 0}
          roughness={0.23}
          clearcoat={0.9}
          clearcoatRoughness={0.17}
        />
      </mesh>
      <mesh position={[0.058, 0.232, 0.055]} rotation={[0.3, 0, -0.4]}>
        <sphereGeometry args={[0.018, 8, 8]} />
        <meshBasicMaterial
          color="#f1f7d7"
          transparent
          opacity={on ? 0.68 : 0.32}
        />
      </mesh>
      {on && (
        <pointLight
          position={[0, 0.29, 0]}
          color="#d6f96c"
          intensity={1.15}
          distance={2}
        />
      )}
    </group>
  );
}
