import {
  Component,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  Canvas,
  type CanvasProps,
  useFrame,
  useThree,
} from "@react-three/fiber";
import { createRoot, type Root } from "react-dom/client";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Group, PerspectiveCamera, Vector3 } from "three";
import { useRef } from "react";

/** Screen-space labels with independent DOM ownership during Suspense/StrictMode replay. */
export function SceneHtml({
  children,
  position,
  center = false,
  zIndexRange = [3, 0],
  screenSpace = false,
}: {
  children: ReactNode;
  position: [number, number, number];
  center?: boolean;
  zIndexRange?: [number, number];
  /** Anchor an already-projected overlay to the canvas, regardless of camera framing. */
  screenSpace?: boolean;
}) {
  const group = useRef<Group>(null);
  const element = useRef<HTMLDivElement | null>(null);
  const root = useRef<Root | null>(null);
  const point = useMemo(() => new Vector3(), []);
  const { gl, camera, size, invalidate } = useThree();
  const target = gl.domElement.parentElement;

  useLayoutEffect(() => {
    if (!target) return;
    // Never reuse this container: an earlier root may still be finishing its cleanup.
    const container = document.createElement("div");
    Object.assign(container.style, {
      position: "absolute",
      top: "0",
      left: "0",
      pointerEvents: "none",
      display: "none",
    });
    const mountedRoot = createRoot(container);
    element.current = container;
    root.current = mountedRoot;
    target.appendChild(container);
    invalidate();
    return () => {
      element.current = null;
      root.current = null;
      container.remove();
      // A separate DOM root cannot synchronously unmount inside the scene's commit.
      queueMicrotask(() => mountedRoot.unmount());
    };
  }, [target, invalidate]);

  useLayoutEffect(() => {
    root.current?.render(
      <div style={{ transform: center ? "translate(-50%, -50%)" : undefined }}>
        {children}
      </div>,
    );
  });

  useFrame(() => {
    if (!group.current || !element.current) return;
    if (screenSpace) {
      Object.assign(element.current.style, {
        display: "block",
        transform: "translate3d(0, 0, 0)",
        zIndex: String(zIndexRange[0]),
      });
      return;
    }
    camera.updateMatrixWorld();
    group.current.getWorldPosition(point);
    const distance = point.distanceTo(camera.position);
    point.project(camera);
    const label = element.current;
    label.style.display = point.z >= -1 && point.z <= 1 ? "block" : "none";
    label.style.transform = `translate3d(${((point.x + 1) * size.width) / 2}px, ${((1 - point.y) * size.height) / 2}px, 0)`;
    if (camera instanceof PerspectiveCamera) {
      const slope =
        (zIndexRange[1] - zIndexRange[0]) / (camera.far - camera.near);
      label.style.zIndex = String(
        Math.round(slope * distance + zIndexRange[1] - slope * camera.far),
      );
    }
  });
  return <group ref={group} position={position} />;
}

export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(query.matches);
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  return reduced;
}

/** A classroom laptop should not render an offscreen or background scene continuously. */
export function useSceneActive(reference: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(document.visibilityState !== "hidden");
  const [intersecting, setIntersecting] = useState(true);
  useEffect(() => {
    const visibility = () => setVisible(document.visibilityState !== "hidden");
    document.addEventListener("visibilitychange", visibility);
    const observer = new IntersectionObserver(
      (entries) => setIntersecting(entries[0]?.isIntersecting ?? false),
      { rootMargin: "60px" },
    );
    if (reference.current) observer.observe(reference.current);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      observer.disconnect();
    };
  }, [reference]);
  return visible && intersecting;
}

class SceneBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function SafeCanvas({
  children,
  fallback,
  onCreated,
  ...props
}: CanvasProps & { fallback: ReactNode }) {
  const [lost, setLost] = useState(false);
  const supported = useMemo(() => {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("webgl2");
      if (!context) return false;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      return true;
    } catch {
      return false;
    }
  }, []);
  if (!supported || lost) return <>{fallback}</>;
  return (
    <SceneBoundary fallback={fallback}>
      <Canvas
        {...props}
        fallback={fallback}
        onCreated={(state) => {
          state.gl.domElement.addEventListener(
            "webglcontextlost",
            () => setLost(true),
            { once: true },
          );
          onCreated?.(state);
        }}
      >
        {children}
      </Canvas>
    </SceneBoundary>
  );
}

export type CameraAction = {
  type: "reset" | "top" | "zoom-in" | "zoom-out" | "focus";
  sequence: number;
  focusTarget?: [number, number, number];
  focusPosition?: [number, number, number];
};

export interface SceneBounds {
  min: [number, number, number];
  max: [number, number, number];
}

/** Fit every box corner in the horizontal AND vertical field of view. */
export function fittedCameraDistance(
  bounds: SceneBounds,
  target: Vector3,
  outward: Vector3,
  verticalFov: number,
  aspect: number,
) {
  // A perfectly vertical top view still needs a horizontal basis. Crossing
  // it with world-up would create zero vectors and under-fit a wide board.
  const vertical =
    Math.abs(outward.y) > 0.999 ? new Vector3(0, 0, -1) : new Vector3(0, 1, 0);
  const right = new Vector3().crossVectors(vertical, outward).normalize();
  const up = new Vector3().crossVectors(outward, right).normalize();
  const tanV = Math.tan((verticalFov * Math.PI) / 360);
  const tanH = tanV * Math.max(0.1, aspect);
  let distance = 3;
  for (const x of [bounds.min[0], bounds.max[0]])
    for (const y of [bounds.min[1], bounds.max[1]])
      for (const z of [bounds.min[2], bounds.max[2]]) {
        const point = new Vector3(x, y, z).sub(target);
        const depth = point.dot(outward);
        distance = Math.max(
          distance,
          depth + (Math.abs(point.dot(right)) * 1.14) / tanH,
          depth + (Math.abs(point.dot(up)) * 1.14) / tanV,
        );
      }
  return distance;
}

export function SceneCamera({
  action,
  home,
  target,
  maxDistance = 18,
  bounds,
  enablePan = false,
}: {
  action: CameraAction;
  home: [number, number, number];
  target: [number, number, number];
  maxDistance?: number;
  bounds?: SceneBounds;
  enablePan?: boolean;
}) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate, size } = useThree();
  const reduced = useReducedMotion();
  const initialized = useRef(false);
  const transition = useRef<{
    fromPosition: Vector3;
    toPosition: Vector3;
    fromTarget: Vector3;
    toTarget: Vector3;
    elapsed: number;
  } | null>(null);
  const lastSize = useRef("");
  const lastAction = useRef("");
  const orientation = useRef<"reset" | "top">("reset");
  const targetKey = target.join(",");
  const homeKey = home.join(",");
  const boundsKey = bounds ? [...bounds.min, ...bounds.max].join(",") : "";
  const focusKey = [
    ...(action.focusTarget ?? []),
    ...(action.focusPosition ?? []),
  ].join(",");
  useEffect(() => {
    if (!controls.current) return;
    const destination =
      action.type === "focus" && action.focusTarget
        ? new Vector3(...action.focusTarget)
        : action.type === "zoom-in" || action.type === "zoom-out"
          ? controls.current.target.clone()
          : new Vector3(...target);
    const nextPosition = camera.position.clone();
    const sizeKey = `${size.width}:${size.height}`;
    const resized = lastSize.current !== sizeKey;
    lastSize.current = sizeKey;
    const actionKey = `${action.type}:${action.sequence}:${focusKey}`;
    const resizedOnly =
      resized && initialized.current && lastAction.current === actionKey;
    lastAction.current = actionKey;
    const overview = action.type === "reset" || action.type === "top";
    if (resizedOnly && !overview) destination.copy(controls.current.target);
    if (action.type === "reset" || action.type === "top")
      orientation.current = action.type;
    if (bounds && camera instanceof PerspectiveCamera && overview) {
      const outward =
        orientation.current === "top"
          ? new Vector3(0, 1, 0.001).normalize()
          : new Vector3(...home).sub(destination).normalize();
      const distance = fittedCameraDistance(
        bounds,
        destination,
        outward,
        camera.fov,
        size.width / Math.max(1, size.height),
      );
      nextPosition.copy(
        destination.clone().add(outward.multiplyScalar(distance)),
      );
    } else if (action.type === "focus" && action.focusPosition && !resizedOnly)
      nextPosition.set(...action.focusPosition);
    else if (action.type === "reset") nextPosition.set(...home);
    else if (action.type === "top")
      nextPosition.set(target[0], target[1] + 9, target[2] + 0.01);
    if (!resized && (action.type === "zoom-in" || action.type === "zoom-out")) {
      const offset = camera.position.clone().sub(destination);
      const factor = action.type === "zoom-in" ? 0.8 : 1.25;
      const nextLength = Math.max(
        3,
        Math.min(maxDistance, offset.length() * factor),
      );
      nextPosition.copy(destination.clone().add(offset.setLength(nextLength)));
    }
    if (initialized.current && !reduced && !resized) {
      transition.current = {
        fromPosition: camera.position.clone(),
        toPosition: nextPosition,
        fromTarget: controls.current.target.clone(),
        toTarget: destination,
        elapsed: 0,
      };
    } else {
      transition.current = null;
      camera.position.copy(nextPosition);
      controls.current.target.copy(destination);
    }
    initialized.current = true;
    controls.current.update();
    camera.updateMatrixWorld();
    invalidate();
    // Array values, not unstable array identities, determine the framing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    action.sequence,
    action.type,
    targetKey,
    homeKey,
    camera,
    invalidate,
    maxDistance,
    boundsKey,
    focusKey,
    reduced,
    size.width,
    size.height,
  ]);
  useFrame((_, delta) => {
    const movement = transition.current;
    if (!movement || !controls.current) return;
    movement.elapsed += Math.min(delta, 0.05);
    const progress = Math.min(1, movement.elapsed / 0.48);
    const eased = progress * progress * (3 - 2 * progress);
    camera.position.lerpVectors(
      movement.fromPosition,
      movement.toPosition,
      eased,
    );
    controls.current.target.lerpVectors(
      movement.fromTarget,
      movement.toTarget,
      eased,
    );
    controls.current.update();
    camera.updateMatrixWorld();
    if (progress >= 1) transition.current = null;
    else invalidate();
  }, -2);
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      minDistance={3}
      maxDistance={maxDistance}
      minPolarAngle={0.001}
      maxPolarAngle={Math.PI / 2.05}
      enablePan={enablePan}
      onStart={() => {
        transition.current = null;
      }}
    />
  );
}
