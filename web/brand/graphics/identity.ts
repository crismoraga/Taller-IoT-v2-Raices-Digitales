import { circle, path, rect, type Drawing, type Shape } from "./shapes";

/** Emblema original: dos hojas, una semilla y tres raíces que terminan en contactos. */
export const RAICES_GLYPH = {
  leftLeaf: "M31 33C21 33 16 27 16 19c10 0 16 6 15 14Z",
  rightLeaf: "M33 28c0-10 6-16 16-16 0 10-6 16-16 16Z",
  stem: "M32 31v12m0 0H20v8m12-8h12v8m-12-8v12",
  veins: "m21 24 9 8m13-14-8 8",
  signal: "M42 6a16 16 0 0 1 15 15",
} as const;

export function raicesMarkDrawing({
  tile = true,
  monochrome = false,
}: {
  tile?: boolean;
  monochrome?: boolean;
} = {}): Drawing {
  const ink = monochrome ? "currentColor" : "#d0ef83";
  const shapes: Shape[] = [];
  if (tile) {
    shapes.push(
      rect(1, 1, 62, 62, 18, {
        fill: monochrome ? "none" : "url(#rd-forest)",
      }),
      rect(1.5, 1.5, 61, 61, 17.5, {
        fill: "none",
        stroke: monochrome ? "currentColor" : "#d0ef83",
        sop: monochrome ? 0.5 : 0.24,
      }),
      path("M18 4h27a15 15 0 0 1 15 15", {
        fill: "none",
        stroke: monochrome ? "currentColor" : "#fff9e9",
        sop: monochrome ? 0 : 0.12,
        cap: "round",
      }),
    );
  }
  if (!monochrome) {
    shapes.push(circle(44, 18, 11, { fill: "#f3d56a", fop: 0.08 }));
  }
  shapes.push(
    path(RAICES_GLYPH.signal, {
      fill: "none",
      stroke: ink,
      sw: 2.1,
      sop: monochrome ? 1 : 0.55,
      cap: "round",
    }),
    path(RAICES_GLYPH.stem, {
      fill: "none",
      stroke: ink,
      sw: 3.1,
      cap: "round",
      join: "round",
    }),
    path(RAICES_GLYPH.leftLeaf, {
      fill: monochrome ? ink : "url(#rd-sprout)",
    }),
    path(RAICES_GLYPH.rightLeaf, {
      fill: monochrome ? ink : "url(#rd-leaf)",
    }),
  );
  if (!monochrome) {
    shapes.push(
      path(RAICES_GLYPH.veins, {
        fill: "none",
        stroke: "#25553a",
        sw: 1.2,
        sop: 0.42,
        cap: "round",
      }),
    );
  }
  shapes.push(
    circle(20, 51, 3.1, { fill: monochrome ? ink : "#9cd59a" }),
    circle(44, 51, 3.1, { fill: monochrome ? ink : "#f3d56a" }),
    circle(32, 55, 2.8, { fill: monochrome ? ink : "#d0ef83" }),
    circle(32, 43, 2.8, { fill: monochrome ? ink : "#f5f0df" }),
  );
  return {
    w: 64,
    h: 64,
    gradients: monochrome
      ? []
      : [
          {
            id: "rd-forest",
            kind: "linear",
            x1: 0,
            y1: 0,
            x2: 1,
            y2: 1,
            stops: [
              { offset: 0, color: "#276048" },
              { offset: 1, color: "#0c302b" },
            ],
          },
          {
            id: "rd-leaf",
            kind: "linear",
            x1: 0,
            y1: 0,
            x2: 0.8,
            y2: 1,
            stops: [
              { offset: 0, color: "#e1f4a0" },
              { offset: 1, color: "#b5dc7d" },
            ],
          },
          {
            id: "rd-sprout",
            kind: "linear",
            x1: 0,
            y1: 0,
            x2: 1,
            y2: 1,
            stops: [
              { offset: 0, color: "#aadba4" },
              { offset: 1, color: "#79b990" },
            ],
          },
        ],
    shapes,
  };
}
