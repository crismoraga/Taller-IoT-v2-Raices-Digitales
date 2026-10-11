import { describe, expect, it } from "vitest";
import { layoutCallouts, type CalloutBox } from "../web/circuit/calloutLayout";

const intersect = (a: CalloutBox, b: CalloutBox) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

describe("readable breadboard endpoint labels", () => {
  it("keeps nearby cable ends separate on a narrow phone", () => {
    const boxes = layoutCallouts(
      [
        { x: 140, y: 132, width: 145, height: 40, side: -1 },
        { x: 149, y: 140, width: 145, height: 40, side: -1 },
      ],
      265,
      260,
    );
    expect(intersect(boxes[0], boxes[1])).toBe(false);
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(10);
      expect(box.y).toBeGreaterThanOrEqual(10);
      expect(box.x + box.width).toBeLessThanOrEqual(255);
      expect(box.y + box.height).toBeLessThanOrEqual(250);
    }
  });

  it("separates six tightly packed sensor terminals without covering pins", () => {
    const anchors = Array.from({ length: 6 }, (_, index) => ({
      x: 155 + index * 3,
      y: 170,
      width: 100,
      height: 40,
      side: -1 as const,
    }));
    const boxes = layoutCallouts(anchors, 390, 350);
    boxes.forEach((box, index) => {
      expect(boxes.slice(0, index).some((other) => intersect(box, other))).toBe(
        false,
      );
      expect(
        anchors.some(
          (point) =>
            point.x > box.x &&
            point.x < box.x + box.width &&
            point.y > box.y &&
            point.y < box.y + box.height,
        ),
      ).toBe(false);
    });
    expect(layoutCallouts(anchors, 390, 350)).toEqual(boxes);
  });

  it("clamps oversized labels and anchors outside the visible board", () => {
    const boxes = layoutCallouts(
      [
        { x: -10, y: -20, width: 400, height: 40, side: -1 },
        { x: 320, y: 390, width: 100, height: 40, side: 1 },
      ],
      265,
      260,
    );
    for (const box of boxes) {
      expect(box.x).toBeGreaterThanOrEqual(10);
      expect(box.y).toBeGreaterThanOrEqual(10);
      expect(box.x + box.width).toBeLessThanOrEqual(255);
      expect(box.y + box.height).toBeLessThanOrEqual(250);
    }
  });
});
