import { BOARD, pointXY } from "../circuit/breadboard";
import { bodyOutline, moduleBounds, type XY } from "../circuit/geometry";
import type { PartInstance } from "../circuit/model";
import type { SceneBounds } from "./SceneSupport";

/** A close view frames the selected hardware, including its own leads or
 * separate sensing plate, rather than fitting the entire workshop table. */
export function partSceneBounds(part: PartInstance, unit = 0.13): SceneBounds {
  const points: XY[] = Object.values(part.holes ?? {}).map(pointXY);
  if (!points.length) {
    const box = moduleBounds(part);
    points.push({ x: box.x, y: box.y }, { x: box.x + box.w, y: box.y + box.h });
  }
  for (const outline of bodyOutline(part)) {
    if (outline.kind === "circle")
      points.push(
        { x: outline.cx - outline.r, y: outline.cy - outline.r },
        { x: outline.cx + outline.r, y: outline.cy + outline.r },
      );
    else
      points.push(
        { x: outline.x, y: outline.y },
        { x: outline.x + outline.w, y: outline.y + outline.h },
      );
  }
  const height =
    part.type === "dht11"
      ? 1.75
      : part.type === "hcsr04"
        ? 1.55
        : part.type === "pir"
          ? 0.95
          : 0.85;
  const x = points.map((point) => (point.x - BOARD.width / 2) * unit);
  const z = points.map((point) => (point.y - 8.5) * unit);
  return {
    min: [Math.min(...x) - unit * 0.7, 0.04, Math.min(...z) - unit * 0.7],
    max: [
      Math.max(...x) + unit * 0.7,
      height * (unit / 0.13),
      Math.max(...z) + unit * 0.7,
    ],
  };
}
