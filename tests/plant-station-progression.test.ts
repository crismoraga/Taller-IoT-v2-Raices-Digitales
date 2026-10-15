import { describe, expect, it } from "vitest";
import { sensors } from "../shared/telemetry";
import { circuitForBoard } from "../web/circuit/boards";
import { isPoint, parsePoint } from "../web/circuit/breadboard";
import { clearanceProblems } from "../web/circuit/geometry";
import { plantStationCircuit } from "../web/circuit/layouts";
import { analyze } from "../web/circuit/netlist";
import {
  FIRST_PLANT_SENSORS,
  initialPlantSensors,
  normalizePlantSensors,
  PLANT_SENSORS,
  plantSensorFlags,
  type PlantSensorId,
} from "../web/circuit/plantStation";
import { lessonById } from "../web/content";
import {
  configureDhtPinOrder,
  DHT_PIN_ORDERS,
  normalizeCircuitSteps,
  type DhtPinOrder,
} from "../web/lesson/assembly";

describe("incremental physical plant station", () => {
  it("starts after the first two sensors without claiming soil has already been connected", () => {
    expect(initialPlantSensors(undefined)).toEqual(["light", "climate"]);
    expect(plantSensorFlags(FIRST_PLANT_SENSORS)).toEqual({
      soil: false,
      soil_temperature: false,
      air_temperature: true,
      air_humidity: true,
      light: true,
      rain: false,
      water_level: false,
      distance: false,
      motion: false,
    });
    expect(
      plantStationCircuit(FIRST_PLANT_SENSORS)
        .parts.map((part) => part.id)
        .sort(),
    ).toEqual(["dht", "ldr", "led", "r_ldr", "r_led"]);
  });

  it("restores explicit empty profiles and ignores unknown or malformed storage", () => {
    expect(initialPlantSensors([], { soil: true })).toEqual([]);
    expect(initialPlantSensors(null, { soil: true })).toEqual(["soil"]);
    expect(initialPlantSensors({ light: true })).toEqual(FIRST_PLANT_SENSORS);
    expect(normalizePlantSensors(["soil", "light", "soil", "made_up"])).toEqual(
      ["light", "soil"],
    );
    expect(normalizePlantSensors("soil")).toBeUndefined();
  });

  it("every physical sensor links to its real lesson and uses only known reading flags", () => {
    for (const sensor of PLANT_SENSORS) {
      expect(lessonById(sensor.lesson)).toBeDefined();
      expect(sensor.placement.length).toBeGreaterThan(30);
      const flags = plantSensorFlags([sensor.id]);
      expect(Object.keys(flags).sort()).toEqual([...sensors].sort());
      expect(
        Object.entries(flags)
          .filter(([, enabled]) => enabled)
          .map(([id]) => id)
          .sort(),
      ).toEqual([...sensor.readings].sort());
      expect(
        plantStationCircuit([sensor.id]).parts.some(
          (part) => part.id === sensor.part,
        ),
      ).toBe(true);
    }
  });

  it("Arduino Uno supports all 256 physical sensor combinations without a pin or rail conflict", () => {
    for (let mask = 0; mask < 2 ** PLANT_SENSORS.length; mask++) {
      const selected = PLANT_SENSORS.filter(
        (_, index) => mask & (1 << index),
      ).map((sensor) => sensor.id);
      const circuit = circuitForBoard(plantStationCircuit(selected), "uno");
      expect(
        analyze(circuit, { splitRails: true, vbus: 5.25 }).issues.filter(
          (issue) => issue.level === "error",
        ),
        selected.join(","),
      ).toEqual([]);
      expect(clearanceProblems(circuit), selected.join(",")).toEqual([]);
    }
  });

  const profiles: PlantSensorId[][] = [
    [],
    ...PLANT_SENSORS.map((sensor) => [sensor.id]),
    ...PLANT_SENSORS.filter(
      (sensor) => !FIRST_PLANT_SENSORS.includes(sensor.id),
    ).map((sensor) => [...FIRST_PLANT_SENSORS, sensor.id]),
    PLANT_SENSORS.map((sensor) => sensor.id),
  ];
  for (const board of ["pico", "uno", "nano", "nano-old", "nano-168"] as const)
    for (const order of Object.keys(DHT_PIN_ORDERS) as DhtPinOrder[])
      it(`${board}/${order}: every incremental profile keeps exact real electrical connections`, () => {
        for (const profile of profiles) {
          const circuit = normalizeCircuitSteps(
            configureDhtPinOrder(
              circuitForBoard(plantStationCircuit(profile), board),
              order,
            ),
          );
          const result = analyze(circuit, { splitRails: true, vbus: 5.25 });
          expect(
            result.issues.filter((issue) => issue.level === "error"),
            profile.join(","),
          ).toEqual([]);
          expect(clearanceProblems(circuit), profile.join(",")).toEqual([]);
          const visibleHoles = [
            ...circuit.parts.flatMap((part) => Object.values(part.holes ?? {})),
            ...circuit.wires
              .flatMap((wire) => [wire.from, wire.to])
              .filter(isPoint),
            ...circuit.steps.flatMap((step) => step.focus ?? []),
          ];
          expect(
            Math.max(...visibleHoles.map((hole) => parsePoint(hole).column)),
          ).toBeLessThanOrEqual(circuit.view!.to);
          for (const sensor of PLANT_SENSORS)
            expect(
              circuit.parts.some((part) => part.id === sensor.part),
              `${profile}: ${sensor.id}`,
            ).toBe(profile.includes(sensor.id));
          const actions = circuit.steps.flatMap((step) => [
            ...(step.parts ?? []),
            ...(step.wires ?? []),
          ]);
          expect(new Set(actions).size).toBe(
            circuit.parts.length + circuit.wires.length,
          );
          expect(actions.length).toBe(
            circuit.parts.length + circuit.wires.length,
          );
          if (board !== "pico" && profile.includes("climate")) {
            expect(result.netOf("dht.VCC")).toBe(result.netOf("controller:5V"));
            expect(
              circuit.wires
                .flatMap((wire) => [wire.from, wire.to])
                .filter((end) => end === "controller.5V"),
            ).toHaveLength(1);
          }
        }
      });
});
