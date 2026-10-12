import {
  arcPath,
  circle,
  line,
  path,
  seededRandom,
  star4Path,
  type Drawing,
  type Shape,
} from "./shapes";

// Patrones locales del laboratorio: naturaleza y conexiones, sin competir con el texto.
const CREAM = "#F5F0DF";
const LEAF = "#9ED28F";
const SOFT = "#D0EF83";

export interface StarFieldOptions {
  width: number;
  height: number;
  seed?: number;
  stars?: number;
  dots?: number;
}

export function starField({
  width,
  height,
  seed = 7,
  stars = 14,
  dots = 26,
}: StarFieldOptions): Shape[] {
  const random = seededRandom(seed);
  const shapes: Shape[] = [];
  for (let index = 0; index < dots; index += 1) {
    shapes.push(
      circle(random() * width, random() * height, 0.8 + random() * 1.6, {
        fill: random() > 0.35 ? CREAM : SOFT,
        op: 0.25 + random() * 0.55,
      }),
    );
  }
  for (let index = 0; index < stars; index += 1) {
    const size = 3 + random() * 7;
    shapes.push(
      path(star4Path(random() * width, random() * height, size), {
        fill: random() > 0.4 ? CREAM : LEAF,
        op: 0.25 + random() * 0.45,
      }),
    );
  }
  return shapes;
}

export function networkMesh({
  width,
  height,
  seed = 11,
  nodes = 16,
}: {
  width: number;
  height: number;
  seed?: number;
  nodes?: number;
}): Shape[] {
  const random = seededRandom(seed);
  const points = Array.from(
    { length: nodes },
    () => [random() * width, random() * height] as const,
  );
  const shapes: Shape[] = [];
  points.forEach(([x, y], index) => {
    const nearest = points
      .map(([px, py], other) => ({
        other,
        distance: Math.hypot(px - x, py - y),
      }))
      .filter((item) => item.other !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
    nearest.forEach(({ other }) => {
      if (other > index) {
        shapes.push(
          line(x, y, points[other][0], points[other][1], {
            stroke: LEAF,
            sw: 1.2,
            op: 0.35,
          }),
        );
      }
    });
  });
  points.forEach(([x, y]) => {
    const big = random() > 0.7;
    shapes.push(
      circle(x, y, big ? 4.5 : 2.6, {
        fill: big ? CREAM : LEAF,
        op: big ? 0.8 : 0.6,
      }),
    );
  });
  return shapes;
}

export function signalRings({
  cx,
  cy,
  rings = 5,
  gap = 26,
  start = 30,
}: {
  cx: number;
  cy: number;
  rings?: number;
  gap?: number;
  start?: number;
}): Shape[] {
  const shapes: Shape[] = [];
  for (let index = 0; index < rings; index += 1) {
    const r = start + index * gap;
    shapes.push(
      path(arcPath(cx, cy, r, 200, 340), {
        fill: "none",
        stroke: LEAF,
        sw: 2.2,
        cap: "round",
        op: 0.45 - index * 0.06,
      }),
      path(arcPath(cx, cy, r, 20, 160), {
        fill: "none",
        stroke: LEAF,
        sw: 2.2,
        cap: "round",
        op: 0.3 - index * 0.04,
      }),
    );
  }
  shapes.push(circle(cx, cy, 6, { fill: CREAM, op: 0.8 }));
  return shapes;
}

// Anillos orbitales como la pantalla de bienvenida de la marca (círculos crema con puntos).
export function orbitRings({
  width,
  height,
}: {
  width: number;
  height: number;
}): Shape[] {
  const shapes: Shape[] = [];
  const corners: [number, number, number][] = [
    [width * 0.02, height * 0.12, width * 0.46],
    [width * 0.98, height * 0.9, width * 0.5],
  ];
  corners.forEach(([cx, cy, r], cornerIndex) => {
    shapes.push(
      circle(cx, cy, r, { fill: "none", stroke: CREAM, sw: 3, op: 0.35 }),
    );
    shapes.push(
      circle(cx, cy, r * 0.82, {
        fill: "none",
        stroke: LEAF,
        sw: 1.5,
        op: 0.25,
      }),
    );
    for (let index = 0; index < 9; index += 1) {
      const angle = (cornerIndex === 0 ? 10 : 190) + index * 11;
      const radians = (angle * Math.PI) / 180;
      shapes.push(
        circle(
          cx + r * 1.08 * Math.cos(radians),
          cy + r * 1.08 * Math.sin(radians),
          1.6 + (index % 3),
          { fill: CREAM, op: 0.5 },
        ),
      );
    }
  });
  return shapes;
}

/** Raíces con contactos de circuito. Vive en el borde derecho y deja libre el título. */
export function rootCircuit({
  width,
  height,
  seed = 7,
  density = 1,
}: {
  width: number;
  height: number;
  seed?: number;
  density?: number;
}): Shape[] {
  const random = seededRandom(seed);
  const count = Math.round(4 * Math.max(0.25, Math.min(2, density)));
  const shapes: Shape[] = [];
  const cx = width * 0.88;
  const cy = height * 0.45;
  shapes.push(
    path(`M${cx} ${height * -0.08}V${cy}`, {
      fill: "none",
      stroke: SOFT,
      sw: 1.3,
      op: 0.23,
      cap: "round",
    }),
    circle(cx, cy, 4, { fill: SOFT, op: 0.45 }),
  );
  for (let index = 0; index < count; index += 1) {
    const side = index % 2 === 0 ? -1 : 1;
    const bendY = cy + (index + 1) * height * 0.072;
    const endX = cx + side * width * (0.025 + random() * 0.11);
    const endY = Math.min(height * 1.06, bendY + height * (0.1 + random() * 0.14));
    const color = index === count - 1 ? CREAM : index % 2 === 0 ? LEAF : SOFT;
    shapes.push(
      path(`M${cx} ${cy}V${bendY}H${endX}V${endY}`, {
        fill: "none",
        stroke: color,
        sw: 1.4,
        op: 0.26,
        cap: "round",
        join: "round",
      }),
      circle(endX, endY, 3.6, {
        fill: "#0c302b",
        stroke: color,
        sw: 1.2,
        op: 0.6,
      }),
    );
  }
  shapes.push(
    path(`M${cx} ${cy - 24}c-28 0-44-16-44-42 28 0 44 16 44 42Z`, {
      fill: LEAF,
      op: 0.09,
    }),
    path(`M${cx + 3} ${cy - 35}c0-32 17-51 49-51 0 31-19 51-49 51Z`, {
      fill: SOFT,
      op: 0.12,
    }),
  );
  return shapes;
}

export function patternPreviews(): Record<string, Drawing> {
  const background = (w: number, h: number): Shape => ({
    t: "rect",
    x: 0,
    y: 0,
    w,
    h,
    rx: 16,
    fill: "#0C302B",
  });
  return {
    raices: {
      w: 360,
      h: 240,
      shapes: [background(360, 240), ...rootCircuit({ width: 360, height: 240 })],
    },
    estrellas: {
      w: 360,
      h: 240,
      shapes: [background(360, 240), ...starField({ width: 360, height: 240 })],
    },
    red: {
      w: 360,
      h: 240,
      shapes: [
        background(360, 240),
        ...networkMesh({ width: 360, height: 240 }),
      ],
    },
    senal: {
      w: 360,
      h: 240,
      shapes: [background(360, 240), ...signalRings({ cx: 180, cy: 150 })],
    },
    orbitas: {
      w: 360,
      h: 240,
      shapes: [
        background(360, 240),
        ...orbitRings({ width: 360, height: 240 }),
      ],
    },
  };
}
