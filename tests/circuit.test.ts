import { describe, expect, it } from "vitest";
import { circuits } from "../web/circuit/layouts.ts";
import { analyze } from "../web/circuit/netlist.ts";
import { jumper, resistor, type Circuit } from "../web/circuit/model.ts";
import {
  RAIL_COLUMNS,
  describePoint,
  holesOfStrip,
  parsePoint,
  stripOf,
} from "../web/circuit/breadboard.ts";
import { PICO_PINS, picoPin, picoPinForStrip } from "../web/circuit/pico.ts";
import { clearanceProblems } from "../web/circuit/geometry.ts";

const errors = (circuit: Circuit, options = {}) =>
  analyze(circuit, options)
    .issues.filter((issue) => issue.level === "error")
    .map((issue) => `${issue.code}: ${issue.message}`);

const clone = (circuit: Circuit): Circuit => structuredClone(circuit);

describe("protoboard: geometría y tiras", () => {
  it("une a–e y f–j por número, separadas por el canal", () => {
    expect(stripOf("a4")).toBe(stripOf("e4"));
    expect(stripOf("f4")).toBe(stripOf("j4"));
    expect(stripOf("e4")).not.toBe(stripOf("f4"));
    expect(stripOf("a4")).not.toBe(stripOf("a5"));
    expect(holesOfStrip("L4")).toEqual(["a4", "b4", "c4", "d4", "e4"]);
  });

  it("los rieles tienen 50 agujeros en 10 grupos de 5 y pueden venir cortados al centro", () => {
    expect(RAIL_COLUMNS).toHaveLength(50);
    expect(RAIL_COLUMNS.slice(0, 6)).toEqual([3, 4, 5, 6, 7, 9]);
    expect(RAIL_COLUMNS.at(-1)).toBe(61);
    expect(() => parsePoint("tp:8")).toThrow();
    expect(stripOf("tn:3")).toBe(stripOf("tn:60"));
    expect(stripOf("tn:3", true)).not.toBe(stripOf("tn:60", true));
    expect(stripOf("tn:3", true)).toBe(stripOf("tn:31", true));
  });

  it("rechaza agujeros que no existen", () => {
    expect(() => parsePoint("k4")).toThrow();
    expect(() => parsePoint("a64")).toThrow();
    expect(() => parsePoint("a0")).toThrow();
    expect(describePoint("bn:27")).toContain("riel azul");
  });
});

describe("Pico W: pinout real", () => {
  // Fuente: Raspberry Pi Pico W datasheet, figura del pinout.
  const reference: Record<number, string> = {
    1: "GP0", 2: "GP1", 3: "GND", 4: "GP2", 5: "GP3", 6: "GP4", 7: "GP5", 8: "GND",
    9: "GP6", 10: "GP7", 11: "GP8", 12: "GP9", 13: "GND", 14: "GP10", 15: "GP11",
    16: "GP12", 17: "GP13", 18: "GND", 19: "GP14", 20: "GP15", 21: "GP16", 22: "GP17",
    23: "GND", 24: "GP18", 25: "GP19", 26: "GP20", 27: "GP21", 28: "GND", 29: "GP22",
    30: "RUN", 31: "GP26", 32: "GP27", 33: "AGND", 34: "GP28", 35: "ADC_VREF",
    36: "3V3", 37: "3V3_EN", 38: "GND", 39: "VSYS", 40: "VBUS",
  };

  it("cada número físico tiene el nombre de la hoja de datos", () => {
    expect(PICO_PINS).toHaveLength(40);
    for (const pin of PICO_PINS) expect(pin.name).toBe(reference[pin.physical]);
  });

  it("ubica cada pin en la protoboard con el USB a la izquierda", () => {
    expect(picoPin("GP2")).toMatchObject({ physical: 4, hole: "c4", free: ["a4", "b4"] });
    expect(picoPin("GP15")).toMatchObject({ physical: 20, hole: "c20" });
    expect(picoPin("GP16")).toMatchObject({ physical: 21, hole: "h20", free: ["j20", "i20"] });
    expect(picoPin("VBUS")).toMatchObject({ physical: 40, hole: "h1" });
    expect(picoPin("3V3")).toMatchObject({ physical: 36, hole: "h5" });
    expect(picoPin("GP26")).toMatchObject({ physical: 31, hole: "h10", adc: 0 });
    expect(picoPin("GP27")).toMatchObject({ physical: 32, hole: "h9", adc: 1 });
    expect(picoPin("GP28")).toMatchObject({ physical: 34, hole: "h7", adc: 2 });
    expect(picoPinForStrip(stripOf("a4"))?.name).toBe("GP2");
    expect(picoPinForStrip(stripOf("j1"))?.name).toBe("VBUS");
    expect(picoPinForStrip(stripOf("a21"))).toBeUndefined();
  });
});

describe("revisión eléctrica de cada montaje del taller", () => {
  for (const [id, circuit] of Object.entries(circuits)) {
    it(`${id}: sin errores, incluso con rieles cortados y USB a 5,25 V`, () => {
      expect(errors(circuit, { splitRails: true, vbus: 5.25 })).toEqual([]);
      expect(errors(circuit)).toEqual([]);
    });

    it(`${id}: los pasos colocan cada pieza y cable una sola vez y explican qué hacer`, () => {
      const placed = circuit.steps.flatMap((step) => [
        ...(step.parts ?? []),
        ...(step.wires ?? []),
      ]);
      expect(new Set(placed).size).toBe(placed.length);
      expect(placed.length).toBe(circuit.parts.length + circuit.wires.length);
      for (const step of circuit.steps) {
        expect(step.title.length).toBeGreaterThan(8);
        expect(step.detail.length).toBeGreaterThan(12);
      }
    });
  }

  for (const [id, circuit] of Object.entries(circuits)) {
    it(`${id}: ningún cable ni pata queda bajo el cuerpo de otra pieza`, () => {
      expect(clearanceProblems(circuit)).toEqual([]);
    });
  }

  it("mapa canónico de la estación: cada sensor llega a su pin", () => {
    const { netOf } = analyze(circuits.station);
    const same = (a: string, b: string) => {
      expect(netOf(a), `${a} sin conectar`).toBeDefined();
      expect(netOf(a), `${a} ↔ ${b}`).toBe(netOf(b));
    };
    same("soil.AOUT", "pico:GP26");
    same("ldr.b", "pico:GP27");
    same("water.S", "pico:GP28");
    same("rain.DO", "pico:GP14");
    same("dht.DATA", "pico:GP15");
    same("ds.DATA", "pico:GP16");
    same("hc.TRIG", "pico:GP17");
    same("r_echo2.b", "pico:GP18");
    same("pir.OUT", "pico:GP19");
    same("r_led.a", "pico:GP2");
    same("r_buz.a", "pico:GP3");
    // Solo los dos módulos de 5 V tocan VBUS; todo lo demás va a 3V3.
    same("hc.VCC", "pico:VBUS");
    same("pir.VCC", "pico:VBUS");
    for (const terminal of ["soil.VCC", "water.VCC", "rain.VCC", "dht.VCC", "ds.VDD", "ldr.a"])
      same(terminal, "pico:3V3");
  });

  it("ningún pin GP de la estación supera 3,3 V; ECHO llega a 3,0 V por el divisor", () => {
    const nominal = analyze(circuits.station);
    expect(nominal.gpioVolts.GP18).toBeCloseTo(3.0, 2);
    const worst = analyze(circuits.station, { vbus: 5.25 });
    expect(worst.gpioVolts.GP18).toBeCloseTo(3.15, 2);
    for (const [pin, volts] of Object.entries(worst.gpioVolts))
      expect(volts, pin).toBeLessThanOrEqual(3.3);
  });

  it("el divisor sigue siendo seguro con resistencias al 5 % de tolerancia", () => {
    const circuit = clone(circuits.hcsr04);
    for (const part of circuit.parts) {
      if (part.id === "r_echo1" || part.id === "r_echo2") part.props!.ohms = 950;
      if (/r_echo[345]/.test(part.id)) part.props!.ohms = 1050;
    }
    const { gpioVolts } = analyze(circuit, { vbus: 5.25 });
    expect(gpioVolts.GP18).toBeLessThan(3.35);
  });

  it("el LED recibe una corriente segura para el pin", () => {
    const { ledMilliamps } = analyze(circuits.led);
    expect(ledMilliamps.led).toBeGreaterThan(4);
    expect(ledMilliamps.led).toBeLessThan(8);
  });

  it("la estación cabe en las resistencias del kit: 5×220 Ω, 5×1 kΩ, 5×10 kΩ", () => {
    const count = (ohms: number) =>
      circuits.station.parts.filter(
        (part) => part.type === "resistor" && part.props?.ohms === ohms,
      ).length;
    expect(count(220)).toBeLessThanOrEqual(5);
    expect(count(1000)).toBeLessThanOrEqual(5);
    expect(count(10000)).toBeLessThanOrEqual(5);
  });

  it("los 5 V nunca llegan a un riel", () => {
    for (const circuit of Object.values(circuits)) {
      const { netOf } = analyze(circuit);
      const vbus = netOf("pico:VBUS");
      for (const wire of circuit.wires)
        for (const end of [wire.from, wire.to])
          if (/^(tp|tn|bp|bn):/.test(end)) {
            const other = end === wire.from ? wire.to : wire.from;
            if (other.includes(".")) expect(netOf(other)).not.toBe(vbus);
          }
    }
  });
});

describe("la revisión detecta los errores típicos de un principiante", () => {
  it("5 V directo a un pin GP (ECHO sin divisor)", () => {
    const circuit = clone(circuits.hcsr04);
    circuit.wires = circuit.wires.map((wire) =>
      wire.id === "w_hc_echo" ? { ...wire, from: "c59" } : wire,
    );
    expect(errors(circuit).join("\n")).toMatch(/gpio-overvoltage/);
  });

  it("divisor sin su cable a GND", () => {
    const circuit = clone(circuits.hcsr04);
    circuit.wires = circuit.wires.filter((wire) => wire.id !== "w_hc_div_gnd");
    circuit.steps = circuit.steps.filter((step) => step.id !== "hc-div-gnd");
    expect(errors(circuit).join("\n")).toMatch(/gpio-overvoltage/);
  });

  it("LED sin resistencia", () => {
    const circuit = clone(circuits.led);
    circuit.parts = circuit.parts.filter((part) => part.id !== "r_led");
    circuit.steps = circuit.steps.filter((step) => step.id !== "led-resistor");
    circuit.wires = circuit.wires.map((wire) =>
      wire.id === "w_led_sig" ? { ...wire, to: "a26" } : wire,
    );
    circuit.nets = [
      ["pico:GP2", "led.anodo"],
      ["led.catodo", "pico:GND"],
    ];
    expect(errors(circuit).join("\n")).toMatch(/led-no-resistor/);
  });

  it("cortocircuito entre 3V3 y GND", () => {
    const circuit = clone(circuits.ldr);
    circuit.wires.push(jumper("oops", "tp:15", "tn:15", "rojo", "error"));
    circuit.steps.push({
      id: "oops",
      kind: "wire",
      title: "Cable equivocado",
      detail: "Une el riel rojo con el azul.",
      wires: ["oops"],
    });
    expect(errors(circuit).join("\n")).toMatch(/short/);
  });

  it("sensor de 3,3 V alimentado con 5 V", () => {
    const circuit = clone(circuits.soil);
    circuit.wires = circuit.wires.map((wire) =>
      wire.id === "c_soil_3v3" ? { ...wire, to: "j1" } : wire,
    );
    const found = errors(circuit).join("\n");
    expect(found).toMatch(/gpio-overvoltage/);
  });

  it("HC-SR04 alimentado con 3,3 V", () => {
    const circuit = clone(circuits.hcsr04);
    circuit.wires = circuit.wires.map((wire) =>
      wire.id === "w_hc_5v" ? { ...wire, to: "j5" } : wire,
    );
    expect(errors(circuit).join("\n")).toMatch(/module-supply/);
  });

  it("una pata en un agujero tapado por la Pico o sobre uno de sus pines", () => {
    const under = clone(circuits.led);
    under.wires = under.wires.map((wire) =>
      wire.id === "w_led_sig" ? { ...wire, from: "d4" } : wire,
    );
    expect(errors(under).join("\n")).toMatch(/under-pico/);
    const onPin = clone(circuits.led);
    onPin.wires = onPin.wires.map((wire) =>
      wire.id === "w_led_sig" ? { ...wire, from: "c4" } : wire,
    );
    expect(errors(onPin).join("\n")).toMatch(/pico-pin/);
  });

  it("cable en el pin vecino equivocado", () => {
    const circuit = clone(circuits.led);
    circuit.wires = circuit.wires.map((wire) =>
      wire.id === "w_led_sig" ? { ...wire, from: "a5" } : wire,
    );
    const found = errors(circuit).join("\n");
    expect(found).toMatch(/net-open/);
    expect(found).toMatch(/net-bridge/);
  });

  it("dos piezas en el mismo agujero", () => {
    const circuit = clone(circuits.led);
    circuit.parts.push(resistor("extra", 220, "c22", "c30"));
    circuit.steps.push({
      id: "extra",
      kind: "place",
      title: "Resistencia repetida",
      detail: "Ocupa un agujero que ya estaba en uso.",
      parts: ["extra"],
    });
    expect(errors(circuit).join("\n")).toMatch(/hole-in-use/);
  });

  it("LED con las dos patas en la misma tira", () => {
    const circuit = clone(circuits.led);
    circuit.parts = circuit.parts.map((part) =>
      part.id === "led" ? { ...part, holes: { anodo: "d26", catodo: "e26" } } : part,
    );
    expect(errors(circuit).join("\n")).toMatch(/shorted-part/);
  });

  it("riel cortado al centro sin puente", () => {
    const circuit = clone(circuits.hcsr04);
    circuit.wires = circuit.wires.filter((wire) => !wire.id.startsWith("w_bridge"));
    circuit.steps = circuit.steps.filter((step) => !step.id.startsWith("bridge"));
    expect(errors(circuit)).toEqual([]);
    expect(errors(circuit, { splitRails: true }).join("\n")).toMatch(/module-gnd|net-open/);
  });

  it("pulsador entre 3V3 y GND", () => {
    const circuit = clone(circuits.button);
    circuit.wires = circuit.wires.map((wire) =>
      wire.id === "w_btn_sig" ? { ...wire, from: "j5" } : wire,
    );
    expect(errors(circuit).join("\n")).toMatch(/net-/);
  });
});
