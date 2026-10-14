import { moduleBox, modulePinXY, rainPlateBox } from "./geometry";
import type { PartInstance } from "./model";
import { partDef } from "./parts";

/** The same physical footprints and connector row feed the SVG and 3D models. */
export function ModuleShape({
  part,
  unit,
}: {
  part: PartInstance;
  unit: number;
}) {
  const box = moduleBox(part);
  const px = (value: number) => value * unit;
  const above = box.y < 0;
  const edge = above ? box.y + box.h : box.y;
  const into = above ? -1 : 1;
  const cx = box.x + box.w / 2;
  const near = (distance: number) => edge + into * distance;
  const pcb = (color = "#28765a") => (
    <rect
      x={px(box.x)}
      y={px(box.y)}
      width={px(box.w)}
      height={px(box.h)}
      rx={10}
      fill={color}
      stroke="#123f30"
      strokeWidth={2}
    />
  );
  const print = (name: string, distance = 4) => (
    <text
      x={px(cx)}
      y={px(near(distance))}
      textAnchor="middle"
      fill="#f4f4da"
      fontSize={11}
      fontWeight={800}
      fontFamily="var(--font-mono)"
    >
      {name}
    </text>
  );
  const chip = (distance: number, width: number, height: number) => (
    <rect
      x={px(cx - width / 2)}
      y={px(near(distance) - height / 2)}
      width={px(width)}
      height={px(height)}
      rx={3}
      fill="#172b25"
      stroke="#9ba888"
      strokeWidth={1}
    />
  );
  if (part.type === "soil") {
    const copperTop = above ? box.y + 1.1 : box.y + 8;
    return (
      <g data-sensor-shape="soil-capacitive">
        {pcb("#203c2d")}
        <rect
          x={px(box.x + 1)}
          y={px(copperTop)}
          width={px(box.w - 2)}
          height={px(box.h - 9.1)}
          rx={px(2.5)}
          fill="none"
          stroke="#c8b987"
          strokeWidth={4}
        />
        <rect
          x={px(box.x + 1.8)}
          y={px(copperTop + 0.8)}
          width={px(box.w - 3.6)}
          height={px(box.h - 10.7)}
          rx={px(1.8)}
          fill="none"
          stroke="#c8b987"
          strokeWidth={1.5}
        />
        <line
          x1={px(box.x + 0.4)}
          x2={px(box.x + box.w - 0.4)}
          y1={px(near(8))}
          y2={px(near(8))}
          stroke="#d5e6bf"
          strokeWidth={2}
          strokeDasharray="5 5"
        />
        {chip(5.1, 2, 1.5)}
        {print("CAPACITIVA", 2.5)}
        <rect
          x={px(cx - 1.6)}
          y={px(edge) - 6}
          width={px(3.2)}
          height={12}
          rx={3}
          fill="#f4f1df"
          stroke="#b8c7a7"
          strokeWidth={1.5}
        />
      </g>
    );
  }
  if (part.type === "water") {
    const trackTop = above ? box.y + 1 : box.y + 6;
    return (
      <g data-sensor-shape="water-level">
        {pcb("#b84435")}
        {Array.from({ length: 10 }, (_, index) => (
          <rect
            key={index}
            x={px(box.x + 0.8 + index * ((box.w - 1.6) / 9)) - 2}
            y={px(trackTop)}
            width={4}
            height={px(box.h - 7)}
            rx={2}
            fill="#d9c095"
          />
        ))}
        <line
          x1={px(box.x + 0.8)}
          x2={px(box.x + box.w - 0.8)}
          y1={px(above ? box.y + 1 : box.y + box.h - 1)}
          y2={px(above ? box.y + 1 : box.y + box.h - 1)}
          stroke="#d9c095"
          strokeWidth={4}
        />
        {chip(4.6, 1.5, 1)}
        {print("NIVEL", 2.4)}
      </g>
    );
  }
  if (part.type === "ds18b20") {
    const capsuleX = box.x + 0.4;
    const capsuleY = box.y + 2;
    const leadFrom = { x: capsuleX + 13.8, y: capsuleY + 1.18 };
    return (
      <g data-sensor-shape="ds18b20-probe">
        <rect
          x={px(capsuleX)}
          y={px(capsuleY)}
          width={px(13.8)}
          height={px(2.36)}
          rx={px(1.18)}
          fill="#c8d3ca"
          stroke="#657b70"
          strokeWidth={2}
        />
        <line
          x1={px(capsuleX + 1)}
          x2={px(capsuleX + 12.8)}
          y1={px(capsuleY + 0.65)}
          y2={px(capsuleY + 0.65)}
          stroke="#edf5e8"
          strokeWidth={4}
          strokeLinecap="round"
        />
        <rect
          x={px(leadFrom.x - 0.35)}
          y={px(capsuleY + 0.5)}
          width={px(1.1)}
          height={px(1.35)}
          rx={4}
          fill="#1e352a"
        />
        {partDef(part).pins.map((pin) => {
          const target = modulePinXY(part, pin.id);
          return (
            <path
              key={pin.id}
              d={`M${px(leadFrom.x + 0.5)} ${px(leadFrom.y)} C${px(box.x + box.w)} ${px(leadFrom.y)},${px(target.x)} ${px(near(1.8))},${px(target.x)} ${px(target.y)}`}
              fill="none"
              stroke={
                pin.role === "vcc"
                  ? "#d35645"
                  : pin.role === "gnd"
                    ? "#243a2d"
                    : "#d8b23b"
              }
              strokeWidth={5}
              strokeLinecap="round"
            />
          );
        })}
        <text
          x={px(capsuleX + 6.9)}
          y={px(capsuleY + 1.5)}
          textAnchor="middle"
          fill="#315446"
          fontSize={12}
          fontWeight={800}
        >
          DS18B20
        </text>
      </g>
    );
  }
  if (part.type === "pir") {
    const cy = box.y + box.h / 2;
    const r = Math.min(4.4, box.h / 2 - 0.25);
    return (
      <g data-sensor-shape="pir-hcsr501">
        {pcb()}
        <circle
          cx={px(cx)}
          cy={px(cy)}
          r={px(r)}
          fill="#f4f2db"
          stroke="#b5c0a3"
          strokeWidth={2}
        />
        {[0.35, 0.7].map((scale) => (
          <circle
            key={scale}
            cx={px(cx)}
            cy={px(cy)}
            r={px(r * scale)}
            fill="none"
            stroke="#ced3b8"
            strokeWidth={1.2}
          />
        ))}
        {Array.from({ length: 12 }, (_, index) => {
          const angle = (index * Math.PI) / 6;
          return (
            <line
              key={index}
              x1={px(cx + Math.cos(angle) * r * 0.35)}
              y1={px(cy + Math.sin(angle) * r * 0.35)}
              x2={px(cx + Math.cos(angle) * r)}
              y2={px(cy + Math.sin(angle) * r)}
              stroke="#ced3b8"
              strokeWidth={1.2}
            />
          );
        })}
      </g>
    );
  }
  if (part.type === "rain") {
    const plate = rainPlateBox(part);
    const back = above ? box.y : box.y + box.h;
    return (
      <g data-sensor-shape="rain-fc37-lm393">
        {pcb("#286d76")}
        {chip(3.8, 2.2, 1)}
        <rect
          x={px(box.x + 1)}
          y={px(near(2.4) - 0.7)}
          width={px(2)}
          height={px(1.4)}
          rx={3}
          fill="#428cba"
          stroke="#aabfb0"
          strokeWidth={1}
        />
        <line
          x1={px(box.x + 1.4)}
          x2={px(box.x + 2.6)}
          y1={px(near(2.4))}
          y2={px(near(2.4))}
          stroke="#e3e2c6"
          strokeWidth={2}
        />
        {print("LM393", 5.1)}
        <rect
          x={px(plate.x)}
          y={px(plate.y)}
          width={px(plate.w)}
          height={px(plate.h)}
          rx={8}
          fill="#315042"
          stroke="#143c2a"
          strokeWidth={2}
        />
        {Array.from({ length: 12 }, (_, index) => (
          <line
            key={index}
            x1={px(plate.x + 1)}
            x2={px(plate.x + plate.w - 1)}
            y1={px(plate.y + 2 + index * 1)}
            y2={px(plate.y + 2 + index * 1)}
            stroke="#c6c6a2"
            strokeWidth={5}
            strokeLinecap="round"
          />
        ))}
        {[-0.5, 0.5].map((offset, index) => (
          <path
            key={index}
            d={`M${px(cx + offset)} ${px(back)} C${px(cx + offset)} ${px(back + 2)},${px(plate.x - 1)} ${px(plate.y + 3 + index)},${px(plate.x + 0.5)} ${px(plate.y + 3 + index)}`}
            fill="none"
            stroke={index ? "#b3bead" : "#37483e"}
            strokeWidth={4}
          />
        ))}
        <text
          x={px(plate.x + plate.w / 2)}
          y={px(plate.y + 1.2)}
          textAnchor="middle"
          fill="#e8edce"
          fontSize={11}
          fontWeight={800}
        >
          FC-37 · placa de gotas
        </text>
      </g>
    );
  }
  return (
    <g>
      {pcb()}
      {print(part.label, box.h / 2)}
    </g>
  );
}
