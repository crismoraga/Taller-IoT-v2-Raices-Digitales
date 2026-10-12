import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { Board } from "../lib/context";
import { BoardText, Tube, type V3 } from "./Primitives";
import { livingBoardProfile } from "./living-state";

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
        across * spread + Math.sin(t * Math.PI) * width * 0.035,
        t * length,
        curl -
          Math.abs(across) ** 1.3 * spread * 0.3 +
          across * Math.sin(t * Math.PI * 0.8) * width * 0.05 +
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
    const veinSections = [mainVein, ...veins].map(
      (points, index) =>
        new THREE.TubeGeometry(
          new THREE.CatmullRomCurve3(
            points.map((p) => new THREE.Vector3(...p)),
          ),
          index ? 12 : 24,
          index ? 0.0034 : 0.008,
          5,
          false,
        ),
    );
    const veinGeometry = mergeGeometries(veinSections)!;
    veinSections.forEach((section) => section.dispose());
    return { geometry, veinGeometry };
  }, [length, width, color]);
  useEffect(
    () => () => {
      model.geometry.dispose();
      model.veinGeometry.dispose();
    },
    [model],
  );
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
      <mesh geometry={model.veinGeometry}>
        <meshStandardMaterial color="#a6c990" roughness={0.77} />
      </mesh>
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
          roughness={0.62}
          clearcoat={0.16}
          clearcoatRoughness={0.65}
          transparent={roots}
          opacity={roots ? 0.13 : 1}
          depthWrite={!roots}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh position={[0, 1.555, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[1.078, 0.018, 8, 64]} />
        <meshStandardMaterial
          color="#e2ac86"
          roughness={0.63}
          transparent={roots}
          opacity={roots ? 0.13 : 1}
          depthWrite={!roots}
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

function BreadboardHoles({ board }: { board: Board }) {
  const reference = useRef<THREE.InstancedMesh>(null);
  const { width, depth, pinsPerSide } = livingBoardProfile(board);
  const count = (pinsPerSide + 4) * 14;
  useEffect(() => {
    if (!reference.current) return;
    const dummy = new THREE.Object3D();
    const pitch = (width - 0.076) / (pinsPerSide - 1);
    let index = 0;
    for (let x = 0; x < pinsPerSide + 4; x++) {
      for (const side of [-1, 1]) {
        for (let row = 0; row < 5; row++) {
          dummy.position.set(
            -width / 2 + 0.038 + (x - 2) * pitch,
            0.0858,
            side * (depth / 2 - 0.022 + (row - 2) * 0.07),
          );
          dummy.updateMatrix();
          reference.current.setMatrixAt(index++, dummy.matrix);
        }
        for (const rail of [0.445, 0.487]) {
          dummy.position.set(
            -width / 2 + 0.038 + (x - 2) * pitch,
            0.0858,
            side * rail,
          );
          dummy.updateMatrix();
          reference.current.setMatrixAt(index++, dummy.matrix);
        }
      }
    }
    reference.current.instanceMatrix.needsUpdate = true;
    reference.current.computeBoundingSphere();
  }, [width, depth, pinsPerSide]);
  return (
    <instancedMesh ref={reference} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.023, 0.0012, 0.029]} />
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
      <mesh position={[((count - 1) * pitch) / 2, female ? 0.039 : -0.042, 0]}>
        <boxGeometry args={[count * pitch, female ? 0.078 : 0.029, 0.063]} />
        <meshStandardMaterial color="#172826" roughness={0.64} />
      </mesh>
      <HeaderContacts
        key={`${count}:${female}:${pitch}`}
        count={count}
        female={female}
        pitch={pitch}
      />
    </group>
  );
}

function HeaderContacts({
  count,
  female,
  pitch,
}: {
  count: number;
  female: boolean;
  pitch: number;
}) {
  const contacts = useRef<THREE.InstancedMesh>(null);
  const collars = useRef<THREE.InstancedMesh>(null);
  useEffect(() => {
    if (!contacts.current) return;
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index++) {
      dummy.position.set(index * pitch, female ? 0.079 : -0.016, 0);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      contacts.current.setMatrixAt(index, dummy.matrix);
      if (collars.current) {
        dummy.position.y = 0.0796;
        dummy.rotation.x = -Math.PI / 2;
        dummy.updateMatrix();
        collars.current.setMatrixAt(index, dummy.matrix);
      }
    }
    for (const mesh of [contacts.current, collars.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [count, female, pitch]);
  return (
    <>
      <instancedMesh ref={contacts} args={[undefined, undefined, count]}>
        <boxGeometry
          args={[female ? 0.023 : 0.018, female ? 0.004 : 0.12, 0.023]}
        />
        <meshStandardMaterial
          color={female ? "#111d1b" : "#dbc079"}
          metalness={female ? 0.1 : 0.8}
          roughness={0.32}
        />
      </instancedMesh>
      {female && (
        <instancedMesh ref={collars} args={[undefined, undefined, count]}>
          <ringGeometry args={[0.011, 0.016, 8]} />
          <meshStandardMaterial
            color="#8f9277"
            metalness={0.72}
            roughness={0.35}
          />
        </instancedMesh>
      )}
    </>
  );
}

function ChipContacts({
  perSide,
  pitch,
  width,
  dip,
}: {
  perSide: number;
  pitch: number;
  width: number;
  dip: boolean;
}) {
  const reference = useRef<THREE.InstancedMesh>(null);
  const count = perSide * (dip ? 2 : 4);
  useEffect(() => {
    if (!reference.current) return;
    const dummy = new THREE.Object3D();
    const start = ((perSide - 1) * pitch) / 2;
    let index = 0;
    for (const side of [-1, 1]) {
      for (let pin = 0; pin < perSide; pin++) {
        dummy.position.set(
          -start + pin * pitch,
          0.049,
          side * (dip ? 0.105 : 0.12),
        );
        dummy.rotation.set(0, 0, 0);
        dummy.updateMatrix();
        reference.current.setMatrixAt(index++, dummy.matrix);
      }
      if (dip) continue;
      for (let pin = 0; pin < perSide; pin++) {
        dummy.position.set(side * 0.12, 0.049, -start + pin * pitch);
        dummy.rotation.set(0, Math.PI / 2, 0);
        dummy.updateMatrix();
        reference.current.setMatrixAt(index++, dummy.matrix);
      }
    }
    reference.current.instanceMatrix.needsUpdate = true;
    reference.current.computeBoundingSphere();
  }, [perSide, pitch, dip]);
  return (
    <instancedMesh ref={reference} args={[undefined, undefined, count]}>
      <boxGeometry args={[width, 0.018, 0.045]} />
      <meshStandardMaterial color="#acb6af" metalness={0.83} roughness={0.29} />
    </instancedMesh>
  );
}

function UsbSocket({
  uno,
  nano,
  width,
}: {
  uno: boolean;
  nano: boolean;
  width: number;
}) {
  const length = uno ? 0.28 : nano ? 0.18 : 0.145;
  const height = uno ? 0.21 : nano ? 0.095 : 0.07;
  const depth = uno ? 0.235 : nano ? 0.18 : 0.16;
  return (
    <group
      position={[
        -width / 2 + length * 0.26,
        height / 2 + 0.027,
        uno ? -0.25 : 0,
      ]}
    >
      <mesh castShadow>
        <boxGeometry args={[length, height, depth]} />
        <meshStandardMaterial
          color="#c3cbd0"
          metalness={0.88}
          roughness={0.24}
        />
      </mesh>
      <mesh position={[-length / 2 - 0.002, 0, 0]}>
        <boxGeometry args={[0.005, height * 0.66, depth * 0.78]} />
        <meshStandardMaterial color="#182321" roughness={0.65} />
      </mesh>
      <mesh position={[-length / 2 - 0.006, uno ? 0.018 : -0.006, 0]}>
        <boxGeometry args={[0.006, height * 0.2, depth * 0.45]} />
        <meshStandardMaterial
          color={uno ? "#e1e3db" : "#333c37"}
          roughness={0.6}
        />
      </mesh>
      {[0, 1].map((side) => (
        <mesh
          key={side}
          position={[
            length * 0.25,
            -height / 2 + 0.005,
            ((side ? 1 : -1) * depth) / 2,
          ]}
        >
          <boxGeometry args={[0.055, 0.014, 0.031]} />
          <meshStandardMaterial
            color="#b9c3c3"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

/** The Uno rests beside the wiring surface; Pico/Nano have real downward male pins. */
export function LivingBoard({ board }: { board: Board }) {
  const profile = livingBoardProfile(board);
  const { width, depth } = profile;
  const uno = board === "uno";
  const pico = board === "pico";
  const nano = !uno && !pico;
  const mounting = useMemo<V3[]>(
    () =>
      uno
        ? [
            [-width / 2 + 0.095, 0, -depth / 2 + 0.095],
            [width / 2 - 0.07, 0, -depth / 2 + 0.095],
            [width / 2 - 0.07, 0, depth / 2 - 0.095],
            [-width / 2 + 0.19, 0, depth / 2 - 0.095],
          ]
        : [
            [-width / 2 + (pico ? 0.15 : 0.028), 0, -depth / 2 + 0.075],
            [-width / 2 + (pico ? 0.15 : 0.028), 0, depth / 2 - 0.075],
            [width / 2 - 0.075, 0, -depth / 2 + 0.075],
            [width / 2 - 0.075, 0, depth / 2 - 0.075],
          ],
    [uno, pico, width, depth],
  );
  const pcb = useMemo(() => {
    const shape = new THREE.Shape();
    const w = width / 2,
      d = depth / 2,
      corner = uno ? 0.06 : 0.024;
    shape.moveTo(-w + corner, -d);
    shape.lineTo(w - corner, -d);
    shape.quadraticCurveTo(w, -d, w, -d + corner);
    shape.lineTo(w, d - corner);
    shape.quadraticCurveTo(w, d, w - corner, d);
    shape.lineTo(-w + corner, d);
    shape.quadraticCurveTo(-w, d, -w, d - corner);
    shape.lineTo(-w, -d + corner);
    shape.quadraticCurveTo(-w, -d, -w + corner, -d);
    for (const [x, , z] of mounting) {
      const hole = new THREE.Path();
      hole.absarc(x, -z, 0.025, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.027,
      bevelEnabled: true,
      bevelSize: 0.004,
      bevelThickness: 0.004,
      bevelSegments: 2,
      steps: 1,
      curveSegments: 12,
    });
  }, [width, depth, mounting]);
  useEffect(() => () => pcb.dispose(), [pcb]);
  const chipX = uno ? 0.15 : pico ? 0.045 : -0.075;
  const chipZ = uno ? 0.2 : 0;
  const chipContacts = uno || pico ? 14 : 8;
  const chipPitch = uno ? 0.04 : pico ? 0.0145 : 0.025;
  return (
    <group name={`living-controller-${board}`}>
      {!uno && (
        <group>
          <mesh castShadow receiveShadow>
            <boxGeometry args={[1.55, 0.17, 1.08]} />
            <meshStandardMaterial color="#ecebd6" roughness={0.75} />
          </mesh>
          <mesh position={[0, 0.091, 0]}>
            <boxGeometry args={[1.43, 0.008, 0.036]} />
            <meshStandardMaterial color="#c1c7b4" roughness={0.93} />
          </mesh>
          <BreadboardHoles key={board} board={board} />
          {[-1, 1].map((side) => (
            <group key={side}>
              {[0.422, 0.514].map((z, index) => (
                <mesh key={z} position={[0, 0.087, side * z]}>
                  <boxGeometry args={[1.4, 0.002, 0.004]} />
                  <meshStandardMaterial
                    color={index ? "#79968e" : "#b78069"}
                    roughness={0.92}
                  />
                </mesh>
              ))}
              <BoardText
                position={[-0.726, 0.1, side * 0.446]}
                size={0.041}
                color="#a76758"
              >
                +
              </BoardText>
              <BoardText
                position={[-0.726, 0.1, side * 0.49]}
                size={0.041}
                color="#557772"
              >
                −
              </BoardText>
            </group>
          ))}
        </group>
      )}
      <group position={[0, uno ? 0.065 : 0.136, 0]} name={`pcb-${board}`}>
        {uno &&
          mounting.map(([x, , z], i) => (
            <mesh key={i} position={[x, -0.046, z]}>
              <cylinderGeometry args={[0.038, 0.043, 0.092, 10]} />
              <meshStandardMaterial
                color="#dbc69c"
                roughness={0.56}
                metalness={0.45}
              />
            </mesh>
          ))}
        <mesh
          geometry={pcb}
          rotation={[-Math.PI / 2, 0, 0]}
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color={profile.color}
            roughness={0.47}
            clearcoat={0.28}
            clearcoatRoughness={0.43}
          />
        </mesh>
        {mounting.map(([x, , z], i) => (
          <mesh
            key={i}
            position={[x, 0.0315, z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.025, 0.043, 18]} />
            <meshStandardMaterial
              color="#dabf72"
              metalness={0.78}
              roughness={0.35}
            />
          </mesh>
        ))}
        <group
          position={[chipX, 0, chipZ]}
          rotation={[0, nano ? Math.PI / 4 : 0, 0]}
        >
          <mesh position={[0, 0.067, 0]} castShadow>
            <boxGeometry
              args={[
                uno ? 0.58 : 0.205,
                uno ? 0.07 : 0.055,
                uno ? 0.17 : 0.205,
              ]}
            />
            <meshStandardMaterial color="#202c28" roughness={0.59} />
          </mesh>
          <ChipContacts
            key={board}
            perSide={chipContacts}
            pitch={chipPitch}
            width={uno ? 0.026 : pico ? 0.009 : 0.015}
            dip={uno}
          />
        </group>
        <UsbSocket uno={uno} nano={nano} width={width} />
        {uno ? (
          <>
            <Header
              count={10}
              position={[-0.54, 0.03, -0.525]}
              female
              pitch={0.062}
            />
            <Header
              count={8}
              position={[0.13, 0.03, -0.525]}
              female
              pitch={0.062}
            />
            <Header
              count={8}
              position={[-0.49, 0.03, 0.525]}
              female
              pitch={0.062}
            />
            <Header
              count={6}
              position={[0.13, 0.03, 0.525]}
              female
              pitch={0.062}
            />
            <group position={[0.51, 0.03, 0.18]}>
              <mesh position={[0, 0.027, 0]}>
                <boxGeometry args={[0.18, 0.052, 0.115]} />
                <meshStandardMaterial color="#1a2927" roughness={0.65} />
              </mesh>
              {[-1, 0, 1].flatMap((column) =>
                [-1, 1].map((row) => (
                  <mesh
                    key={`${column}-${row}`}
                    position={[column * 0.056, 0.085, row * 0.03]}
                  >
                    <boxGeometry args={[0.017, 0.088, 0.017]} />
                    <meshStandardMaterial
                      color="#c7b775"
                      metalness={0.79}
                      roughness={0.3}
                    />
                  </mesh>
                )),
              )}
            </group>
            <mesh position={[-0.43, 0.054, -0.13]} castShadow>
              <boxGeometry args={[0.105, 0.04, 0.105]} />
              <meshStandardMaterial color="#25312b" roughness={0.58} />
            </mesh>
            <mesh position={[-0.23, 0.052, 0.29]} castShadow>
              <boxGeometry args={[0.097, 0.036, 0.047]} />
              <meshStandardMaterial
                color="#ccd2c8"
                metalness={0.8}
                roughness={0.3}
              />
            </mesh>
            {[-0.22, -0.06].map((x) => (
              <group key={x} position={[x, 0.035, 0.405]}>
                <mesh position={[0, 0.047, 0]} castShadow>
                  <cylinderGeometry args={[0.032, 0.033, 0.094, 12]} />
                  <meshStandardMaterial color="#27302a" roughness={0.62} />
                </mesh>
                <mesh position={[0, 0.095, 0]}>
                  <cylinderGeometry args={[0.029, 0.029, 0.003, 12]} />
                  <meshStandardMaterial
                    color="#c5ccbf"
                    metalness={0.82}
                    roughness={0.36}
                  />
                </mesh>
              </group>
            ))}
            <group position={[-0.64, 0.096, 0.32]}>
              <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
                <cylinderGeometry args={[0.105, 0.105, 0.22, 18]} />
                <meshStandardMaterial color="#202d29" roughness={0.5} />
              </mesh>
              <mesh position={[-0.113, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[0.057, 0.057, 0.004, 18]} />
                <meshStandardMaterial color="#101d18" roughness={0.82} />
              </mesh>
            </group>
            <mesh position={[-0.4, 0.055, -0.33]}>
              <boxGeometry args={[0.074, 0.044, 0.074]} />
              <meshStandardMaterial
                color="#b0b8a9"
                metalness={0.6}
                roughness={0.35}
              />
            </mesh>
            <mesh position={[-0.4, 0.083, -0.33]}>
              <boxGeometry args={[0.04, 0.025, 0.04]} />
              <meshStandardMaterial color="#aa584f" roughness={0.72} />
            </mesh>
            <BoardText
              position={[0.27, 0.033, -0.21]}
              size={0.115}
              color="#e5efd6"
            >
              UNO
            </BoardText>
            <BoardText
              position={[-0.25, 0.033, -0.05]}
              size={0.12}
              color="#e5efd6"
            >
              ∞
            </BoardText>
            <BoardText
              position={[0.13, 0.034, 0.405]}
              size={0.047}
              color="#e5efd6"
            >
              A0
            </BoardText>
            <BoardText
              position={[0.44, 0.034, -0.405]}
              size={0.047}
              color="#e5efd6"
            >
              D2
            </BoardText>
          </>
        ) : (
          <>
            <Header
              count={profile.pinsPerSide}
              position={[-width / 2 + 0.038, 0.025, depth / 2 - 0.022]}
              pitch={(width - 0.076) / (profile.pinsPerSide - 1)}
            />
            <Header
              count={profile.pinsPerSide}
              position={[-width / 2 + 0.038, 0.025, -depth / 2 + 0.022]}
              pitch={(width - 0.076) / (profile.pinsPerSide - 1)}
            />
            {pico && (
              <>
                <mesh position={[0.395, 0.05, 0]} castShadow>
                  <boxGeometry args={[0.26, 0.045, 0.305]} />
                  <meshStandardMaterial
                    color="#bcc5ba"
                    metalness={0.78}
                    roughness={0.35}
                  />
                </mesh>
                <BoardText
                  position={[0.395, 0.075, 0]}
                  size={0.034}
                  color="#58715b"
                >
                  Wi-Fi
                </BoardText>
              </>
            )}
            {nano && (
              <>
                <mesh position={[0.19, 0.049, 0]}>
                  <boxGeometry args={[0.083, 0.036, 0.09]} />
                  <meshStandardMaterial
                    color="#a9b8a6"
                    metalness={0.72}
                    roughness={0.36}
                  />
                </mesh>
                <mesh position={[0.19, 0.071, 0]}>
                  <boxGeometry args={[0.034, 0.017, 0.047]} />
                  <meshStandardMaterial color="#2c372d" roughness={0.68} />
                </mesh>
                <mesh position={[-0.26, 0.05, 0]}>
                  <boxGeometry args={[0.051, 0.035, 0.082]} />
                  <meshStandardMaterial
                    color="#bec6ba"
                    metalness={0.78}
                    roughness={0.3}
                  />
                </mesh>
              </>
            )}
            <BoardText
              position={[pico ? -0.12 : 0.265, 0.032, depth / 2 - 0.092]}
              size={pico ? 0.053 : 0.041}
              color="#e5efd6"
            >
              {pico ? "PICO W" : "NANO"}
            </BoardText>
            <BoardText
              position={[-0.32, 0.032, -depth / 2 + 0.092]}
              size={0.037}
              color="#e5efd6"
            >
              {pico ? "GP2" : "D2"}
            </BoardText>
            <BoardText
              position={pico ? [-0.028, 0.032, -0.127] : [-0.268, 0.032, 0.104]}
              size={0.028}
              color="#e5efd6"
            >
              {profile.sensorPin}
            </BoardText>
          </>
        )}
        {[0, 1, 2, 3].map((i) => (
          <mesh
            key={i}
            position={[-0.16 + i * 0.063, 0.043, uno ? -0.34 : -0.14]}
          >
            <boxGeometry args={[0.03, 0.019, 0.017]} />
            <meshStandardMaterial color="#c5b798" roughness={0.64} />
          </mesh>
        ))}
        <mesh position={[uno ? 0.54 : -0.22, 0.042, uno ? -0.3 : 0.113]}>
          <boxGeometry args={[0.031, 0.018, 0.022]} />
          <meshStandardMaterial
            color="#d4ea87"
            emissive="#99bd61"
            emissiveIntensity={0.25}
            roughness={0.4}
          />
        </mesh>
      </group>
    </group>
  );
}

export function LivingSoilProbe() {
  const pcb = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.084, 0.5);
    shape.lineTo(0.084, 0.5);
    shape.quadraticCurveTo(0.105, 0.5, 0.105, 0.477);
    shape.lineTo(0.105, 0.32);
    shape.lineTo(0.078, 0.285);
    shape.lineTo(0.078, -0.425);
    shape.quadraticCurveTo(0.07, -0.515, 0, -0.538);
    shape.quadraticCurveTo(-0.07, -0.515, -0.078, -0.425);
    shape.lineTo(-0.078, 0.285);
    shape.lineTo(-0.105, 0.32);
    shape.lineTo(-0.105, 0.477);
    shape.quadraticCurveTo(-0.105, 0.5, -0.084, 0.5);
    return new THREE.ExtrudeGeometry(shape, {
      depth: 0.025,
      bevelEnabled: true,
      bevelSize: 0.003,
      bevelThickness: 0.003,
      bevelSegments: 2,
      curveSegments: 10,
    });
  }, []);
  useEffect(() => () => pcb.dispose(), [pcb]);
  const electrode: V3[] = [
    [-0.053, 0.205, 0.029],
    [-0.053, -0.37, 0.029],
    [-0.035, -0.455, 0.029],
    [0.035, -0.455, 0.029],
    [0.053, -0.37, 0.029],
    [0.053, 0.205, 0.029],
    [-0.053, 0.205, 0.029],
  ];
  return (
    <group>
      <mesh geometry={pcb} position={[0, 0, -0.016]} castShadow>
        <meshPhysicalMaterial
          color="#254d39"
          roughness={0.57}
          clearcoat={0.18}
        />
      </mesh>
      <Tube points={electrode} radius={0.006} color="#a8b66e" />
      <mesh position={[0, 0.385, 0.02]}>
        <boxGeometry args={[0.2, 0.24, 0.035]} />
        <meshStandardMaterial color="#285c40" roughness={0.61} />
      </mesh>
      <mesh position={[0, 0.4, 0.052]}>
        <boxGeometry args={[0.048, 0.067, 0.027]} />
        <meshStandardMaterial color="#26312b" roughness={0.61} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.065, 0.384, 0.043]}>
          <boxGeometry args={[0.027, 0.041, 0.014]} />
          <meshStandardMaterial color="#c4bd9e" roughness={0.66} />
        </mesh>
      ))}
      <BoardText
        position={[0, 0.274, 0.036]}
        rotation={[0, 0, 0]}
        size={0.028}
        color="#d6e2bf"
      >
        AO
      </BoardText>
      <mesh position={[0, 0.519, 0.034]}>
        <boxGeometry args={[0.15, 0.069, 0.077]} />
        <meshStandardMaterial color="#f1efda" roughness={0.67} />
      </mesh>
      {[-1, 0, 1].map((offset) => (
        <mesh key={offset} position={[offset * 0.043, 0.518, 0.0735]}>
          <boxGeometry args={[0.024, 0.03, 0.002]} />
          <meshStandardMaterial color="#53634e" roughness={0.78} />
        </mesh>
      ))}
      <mesh position={[0, 0.547, 0.061]}>
        <boxGeometry args={[0.155, 0.014, 0.032]} />
        <meshStandardMaterial color="#e1e2cd" roughness={0.65} />
      </mesh>
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
