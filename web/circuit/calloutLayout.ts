/** Places readable screen-sized labels without covering one another. */
export interface CalloutAnchor {
  x: number;
  y: number;
  width: number;
  height: number;
  side: -1 | 1;
}
export interface CalloutBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function layoutCallouts(
  anchors: CalloutAnchor[],
  width: number,
  height: number,
): CalloutBox[] {
  const placed: CalloutBox[] = [];
  const margin = Math.min(10, Math.max(0, width / 4), Math.max(0, height / 4));
  const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(value, max));
  for (const anchor of anchors) {
    const w = Math.min(anchor.width, Math.max(0, width - margin * 2));
    const h = Math.min(anchor.height, Math.max(0, height - margin * 2));
    const candidates: CalloutBox[] = [];
    const add = (x: number, y: number) =>
      candidates.push({
        x: clamp(x, margin, width - margin - w),
        y: clamp(y, margin, height - margin - h),
        width: w,
        height: h,
      });
    for (const side of [anchor.side, -anchor.side]) {
      for (let lane = 0; lane < anchors.length + 1; lane++) {
        const y = anchor.y + side * (24 + lane * (h + 8)) - (side < 0 ? h : 0);
        add(anchor.x - w / 2, y);
        add(anchor.x - w - 18, y);
        add(anchor.x + 18, y);
      }
    }
    // Edge lanes offer room when several neighbouring sensor pins have labels.
    for (let y = margin; y <= height - margin - h; y += h + 8) {
      add(margin, y);
      add(width - margin - w, y);
    }
    const overlap = (a: CalloutBox, b: CalloutBox) =>
      Math.max(
        0,
        Math.min(a.x + a.width + 5, b.x + b.width) - Math.max(a.x - 5, b.x),
      ) *
      Math.max(
        0,
        Math.min(a.y + a.height + 5, b.y + b.height) - Math.max(a.y - 5, b.y),
      );
    const score = (box: CalloutBox) => {
      const occupied = placed.reduce(
        (sum, other) => sum + overlap(box, other),
        0,
      );
      const coversPin = anchors.some(
        (point) =>
          point.x >= box.x - 8 &&
          point.x <= box.x + box.width + 8 &&
          point.y >= box.y - 8 &&
          point.y <= box.y + box.height + 8,
      );
      const distance = Math.hypot(
        box.x + w / 2 - anchor.x,
        box.y + h / 2 - anchor.y,
      );
      const oppositeSide =
        anchor.side < 0 ? box.y + h / 2 > anchor.y : box.y + h / 2 < anchor.y;
      return (
        occupied * 1_000_000 +
        Number(coversPin) * 10_000 +
        distance +
        Number(oppositeSide) * 12
      );
    };
    candidates.sort((a, b) => score(a) - score(b));
    placed.push(candidates[0]);
  }
  return placed;
}
