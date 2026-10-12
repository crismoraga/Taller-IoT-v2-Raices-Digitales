import { describe, expect, it } from "vitest";
import { circuits } from "../web/circuit/layouts";
import type { Circuit } from "../web/circuit/model";
import { analyze } from "../web/circuit/netlist";
import { circuitForBoard } from "../web/circuit/boards";
import {
  circuitProgressSignature,
  assemblyEndpointLabel,
  assemblyPartPins,
  endpointInfo,
  normalizeCircuitSteps,
  normalizePinRows,
  firstAssemblyAction,
  identifyAssemblyPart,
  restoreAssemblyAction,
  restoreAssemblyPinIndex,
  restoreAssemblyProgress,
  wireItemInfo,
} from "../web/lesson/assembly";

describe("montaje: una acción física por paso", () => {
  for (const [id, original] of Object.entries(circuits)) {
    it(`${id}: conserva cada cable, pieza y revisión eléctrica al separar acciones`, () => {
      const before = structuredClone(original);
      const circuit = normalizeCircuitSteps(original);
      expect(original).toEqual(before);
      expect(circuit.parts).toBe(original.parts);
      expect(circuit.wires).toBe(original.wires);
      expect(circuit.nets).toBe(original.nets);
      expect(circuit.steps.flatMap((step) => step.parts ?? [])).toEqual(
        original.steps.flatMap((step) => step.parts ?? []),
      );
      expect(circuit.steps.flatMap((step) => step.wires ?? [])).toEqual(
        original.steps.flatMap((step) => step.wires ?? []),
      );
      expect(new Set(circuit.steps.map((step) => step.id)).size).toBe(
        circuit.steps.length,
      );
      for (const step of circuit.steps)
        expect(
          (step.parts?.length ?? 0) + (step.wires?.length ?? 0),
        ).toBeLessThanOrEqual(1);
      expect(normalizeCircuitSteps(circuit)).toEqual(circuit);
      const options = { splitRails: true, vbus: 5.25 };
      expect(analyze(circuit, options).issues).toEqual(
        analyze(original, options).issues,
      );
    });
  }

  it("prepara un sensor antes de conectar su cable y mantiene la advertencia y revisión", () => {
    const original = circuits.ds18b20;
    const combined = original.steps.find(
      (step) => (step.parts?.length ?? 0) + (step.wires?.length ?? 0) > 1,
    )!;
    const separated = normalizeCircuitSteps(original).steps.filter((step) =>
      step.id.startsWith(`${combined.id}:`),
    );
    expect(separated.map((step) => step.kind)).toEqual(["place", "wire"]);
    expect(separated[0].wires).toBeUndefined();
    expect(separated[1].parts).toBeUndefined();
    expect(separated.at(-1)?.verify).toBe(combined.verify);
    expect(separated[0].verify).toBeUndefined();
    for (const step of separated) expect(step.warning).toBe(combined.warning);
  });

  it("distingue un ID de pieza de un ID de cable aunque sus nombres coincidan", () => {
    const fixture: Circuit = {
      id: "same-id",
      title: "Montaje",
      parts: [{ id: "same", type: "generic", label: "Sensor", pins: ["GND"] }],
      wires: [
        {
          id: "same",
          from: "same.GND",
          to: "a3",
          color: "negro",
          carries: "GND",
          kind: "cable",
        },
      ],
      steps: [
        {
          id: "prepare",
          kind: "place",
          title: "Prepara el sensor",
          detail: "Identifica el terminal y conéctalo a GND.",
          parts: ["same"],
          wires: ["same"],
        },
      ],
      nets: [],
    };
    const circuit = normalizeCircuitSteps(fixture);
    expect(circuit.steps[0].title).toBe("Toma Sensor");
    expect(circuit.steps[1].title).toBe("Conecta un cable negro");
  });

  it("nombra letra, número y riel con coordenadas concretas", () => {
    expect(endpointInfo(circuits.led, "a4")).toEqual({
      label: "a4",
      sub: "Letra a, número 4 · lado inferior (a–e) · GP2 (pin 4)",
    });
    expect(endpointInfo(circuits.led, "bn:27")).toEqual({
      label: "− · 27",
      sub: "Riel azul de abajo, frente al número 27",
    });
    expect(endpointInfo(circuits.led, "led.anodo")).toMatchObject({
      sub: "LED rojo · también marcado pata larga. Busca esta marca en tu pieza.",
    });
  });

  it("los agujeros Arduino no muestran etiquetas ni números de pines Pico", () => {
    const arduino = circuitForBoard(circuits.led, "uno");
    expect(endpointInfo(arduino, "a4")).toEqual({
      label: "a4",
      sub: "Letra a, número 4 · lado inferior (a–e)",
    });
    expect(endpointInfo(arduino, "controller.D2")).toEqual({
      label: "D2",
      sub: "Pin D2 de Arduino Uno",
    });
    expect(
      endpointInfo(circuitForBoard(circuits.led, "nano"), "controller.GND"),
    ).toEqual({ label: "GND", sub: "Pin GND de Arduino Nano" });
  });
});

describe("montaje por pines: expandir sin inventar coordenadas", () => {
  it("separa cada par de señales manteniendo la advertencia del componente", () => {
    const warning = "Verifica el módulo antes de dar energía.";
    expect(
      normalizePinRows([
        { from: "IN1 / IN2 / IN3 / IN4", to: "D4 / D5 / D6 / D7", warning },
      ]),
    ).toEqual([
      { from: "IN1", to: "D4", warning },
      { from: "IN2", to: "D5", warning },
      { from: "IN3", to: "D6", warning },
      { from: "IN4", to: "D7", warning },
    ]);
  });

  it("mantiene la resistencia y las tres conexiones de una cadena LED completa", () => {
    const rows = normalizePinRows([{ from: "Q0 15", to: "220 Ω → LED → GND" }]);
    expect(rows.map(({ from, to }) => [from, to])).toEqual([
      ["Q0 15", "Resistencia de 220 Ω: pata 1"],
      ["Resistencia de 220 Ω: pata 2", "Ánodo del LED (pata larga)"],
      ["Cátodo del LED (pata corta)", "GND"],
    ]);
    expect(rows[0].note).toContain("no la reemplaces por un cable");
  });

  it("respeta condiciones de alimentación al dividir un pull-up", () => {
    const rows = normalizePinRows([
      {
        from: "DATA si no hay pull-up integrado",
        to: "10 kΩ → 5V",
        note: "Solo si la ficha admite 5 V.",
      },
    ]);
    expect(rows).toHaveLength(2);
    for (const row of rows)
      expect(row.note).toContain("Solo si la ficha admite 5 V.");
  });

  it("distingue las dos resistencias paralelas y cada una de sus patas", () => {
    const rows = normalizePinRows([
      {
        from: "DATA",
        to: "3V3 mediante dos resistencias de 10 kΩ en paralelo",
      },
    ]);
    expect(rows.map(({ from, to }) => [from, to])).toEqual([
      ["Resistencia 1 de 10 kΩ: pata 1", "DATA"],
      ["Resistencia 1 de 10 kΩ: pata 2", "3V3"],
      ["Resistencia 2 de 10 kΩ: pata 1", "DATA"],
      ["Resistencia 2 de 10 kΩ: pata 2", "3V3"],
    ]);
  });

  it("divide también la resistencia nombrada en el origen del display", () => {
    expect(
      normalizePinRows([
        { from: "Común D1 mediante su resistencia de 1 kΩ", to: "A0" },
      ]).map(({ from, to }) => [from, to]),
    ).toEqual([
      ["A0", "Resistencia de 1 kΩ: pata 1"],
      ["Resistencia de 1 kΩ: pata 2", "Común D1"],
    ]);
  });

  it("conserva conectores ambiguos para seguir la ficha, sin asumir terminales", () => {
    const row = {
      from: "Bobinas o conector del motor",
      to: "OUT1 / OUT2 / OUT3 / OUT4 del módulo",
    };
    expect(normalizePinRows([row])).toEqual([row]);
  });
});

describe("avance guardado: reanudar sin saltarse comprobaciones", () => {
  const steps = [
    { id: "first", verify: "Revisé el primer cable" },
    { id: "second" },
    { id: "third", verify: "Revisé el tercer cable" },
  ];
  const saved = (extra: Record<string, unknown> = {}) => ({
    version: 2,
    signature: "current",
    position: 3,
    completed: { first: true, second: true, third: true },
    verified: { first: true, third: true },
    ...extra,
  });

  it.each([
    null,
    true,
    [],
    "value",
    saved({ version: 1 }),
    saved({ signature: "another-board" }),
  ])("rechaza datos incompatibles o malformados %j", (value) => {
    expect(restoreAssemblyProgress(value, "current", steps)).toEqual({
      position: -1,
      completed: {},
      verified: {},
    });
  });

  it("reanuda el montaje terminado conservando su revisión manual", () => {
    expect(restoreAssemblyProgress(saved(), "current", steps)).toEqual({
      position: 3,
      completed: { first: true, second: true, third: true },
      verified: { first: true, third: true },
    });
  });

  it("descarta marcas futuras detrás de una comprobación pendiente", () => {
    expect(
      restoreAssemblyProgress(
        saved({ verified: { third: true } }),
        "current",
        steps,
      ),
    ).toEqual({ position: 0, completed: {}, verified: {} });
  });

  it("permite una casilla actual marcada antes de pulsar Siguiente, sin aprobar las futuras", () => {
    expect(
      restoreAssemblyProgress(
        saved({ completed: { first: false, third: true } }),
        "current",
        steps,
      ),
    ).toEqual({ position: 0, completed: {}, verified: { first: true } });
  });

  it("solo acepta booleanos explícitos e IDs de pasos vigentes", () => {
    expect(
      restoreAssemblyProgress(
        saved({
          completed: { first: "true", second: 1, third: true, unknown: true },
          verified: { first: 1, third: true, unknown: true },
        }),
        "current",
        steps,
      ),
    ).toEqual({ position: 0, completed: {}, verified: {} });
  });

  it.each([1.8, -300, 400, Number.NaN, Infinity, "2", undefined, null])(
    "descarta una posición malformada %j y sus aprobaciones",
    (position) => {
      expect(
        restoreAssemblyProgress(saved({ position }), "current", steps),
      ).toEqual({ position: -1, completed: {}, verified: {} });
    },
  );

  it("cambia la firma cuando cambia placa, cableado o comprobación", () => {
    const circuit = normalizeCircuitSteps(circuits.led);
    const signature = circuitProgressSignature("pico", circuit);
    expect(circuitProgressSignature("arduino", circuit)).not.toBe(signature);
    const changed = structuredClone(circuit);
    changed.wires[0].to = "a5";
    expect(circuitProgressSignature("pico", changed)).not.toBe(signature);
    const changedCheck = structuredClone(circuit);
    changedCheck.steps[0].verify = "Una comprobación distinta";
    expect(circuitProgressSignature("pico", changedCheck)).not.toBe(signature);
  });

  it("mantiene el avance de la frontera al recargar mientras se repasa un paso anterior", () => {
    expect(
      restoreAssemblyProgress(saved({ position: 0 }), "current", steps),
    ).toEqual({
      position: 0,
      completed: { first: true, second: true, third: true },
      verified: { first: true, third: true },
    });
    expect(
      restoreAssemblyProgress(
        saved({
          position: 0,
          completed: { first: true, second: true },
          verified: { first: true },
        }),
        "current",
        steps,
      ),
    ).toEqual({
      position: 0,
      completed: { first: true, second: true },
      verified: { first: true },
    });
  });
});

describe("microacciones guardadas: retomar el extremo actual", () => {
  const wire = { id: "wire-1", wires: ["red"] };
  const part = { id: "part-1", parts: ["led"] };
  const save = (stepId: string, action: unknown, signature = "current") => ({
    version: 2,
    signature,
    journey: { stepId, action },
  });

  it("comienza directamente tomando una pieza o un cable", () => {
    expect(firstAssemblyAction(wire)).toBe("take");
    expect(firstAssemblyAction(part)).toBe("take");
    expect(firstAssemblyAction({})).toBe("place");
  });

  it("mantiene el extremo B pendiente después de conectar A y recargar", () => {
    expect(restoreAssemblyAction(save(wire.id, "b"), "current", wire)).toBe(
      "b",
    );
    expect(restoreAssemblyAction(save(wire.id, "done"), "current", wire)).toBe(
      "done",
    );
  });

  it("no usa el gesto de otro cable ni otra placa", () => {
    expect(
      restoreAssemblyAction(save("future-wire", "done"), "current", wire),
    ).toBe("take");
    expect(
      restoreAssemblyAction(
        save(wire.id, "done", "another-board"),
        "current",
        wire,
      ),
    ).toBe("take");
  });

  it.each([null, [], true, 20, "later", { invalid: true }])(
    "rechaza una microacción malformada %j",
    (action) => {
      expect(
        restoreAssemblyAction(save(wire.id, action), "current", wire),
      ).toBe("take");
    },
  );

  it("un componente conserva su colocación y nunca hereda los extremos de un cable", () => {
    expect(restoreAssemblyAction(save(part.id, "place"), "current", part)).toBe(
      "place",
    );
    expect(restoreAssemblyAction(save(part.id, "a"), "current", part)).toBe(
      "take",
    );
    expect(restoreAssemblyAction(save(wire.id, "place"), "current", wire)).toBe(
      "take",
    );
    expect(
      restoreAssemblyAction(save(part.id, "insert"), "current", part),
    ).toBe("insert");
    expect(
      restoreAssemblyAction(save(wire.id, "insert"), "current", wire),
    ).toBe("take");
  });
});

describe("alineación de patas y mapa replicable", () => {
  const led = circuits.led.parts.find((part) => part.id === "led")!;
  const step = { id: "led-place", parts: ["led"] };
  const saved = (pinIndex: unknown, extra: Record<string, unknown> = {}) => ({
    version: 2,
    signature: "current",
    journey: { stepId: step.id, action: "place", pinIndex },
    ...extra,
  });

  it("alinea las patas del LED según su polaridad y agujeros exactos", () => {
    expect(
      assemblyPartPins(led).map(({ id, label, hole }) => ({ id, label, hole })),
    ).toEqual([
      { id: "anodo", label: "pata larga (+)", hole: "d26" },
      { id: "catodo", label: "pata corta (−)", hole: "d27" },
    ]);
    expect(identifyAssemblyPart(led)).toContain("lado plano");
  });

  it("identifica los 220 Ω por sus bandas y conserva ambos agujeros sin polaridad", () => {
    const part = circuits.led.parts.find((part) => part.id === "r_led")!;
    expect(identifyAssemblyPart(part)).toBe(
      "Bandas: rojo, rojo, café y dorado. Sus dos patas se pueden intercambiar.",
    );
    expect(assemblyPartPins(part).map((pin) => pin.hole)).toEqual([
      "c22",
      "c26",
    ]);
  });

  it("respeta todas las patas del sensor rígido y deja los módulos externos fuera de la protoboard", () => {
    const lm35 = circuits.lm35.parts.find((part) => part.id === "lm35")!;
    expect(assemblyPartPins(lm35).map(({ id, hole }) => [id, hole])).toEqual([
      ["vs", "f33"],
      ["vout", "f34"],
      ["gnd", "f35"],
    ]);
    const soil = circuits.soil.parts.find((part) => part.id === "soil")!;
    expect(assemblyPartPins(soil)).toEqual([]);
    expect(identifyAssemblyPart(soil)).toContain("GND, VCC, AOUT");
  });

  it("recuerda la segunda pata pendiente sin saltarse la colocación de la pieza completa", () => {
    expect(restoreAssemblyPinIndex(saved(1), "current", step, 2)).toBe(1);
    expect(restoreAssemblyAction(saved(1), "current", step)).toBe("place");
  });

  it.each([-1, 2, 1.5, Number.NaN, Infinity, "1", null, undefined])(
    "rechaza un índice de pata inválido %j",
    (index) => {
      expect(restoreAssemblyPinIndex(saved(index), "current", step, 2)).toBe(0);
    },
  );

  it("no aplica la pata guardada a otra placa, otro componente ni la acción de inserción", () => {
    expect(restoreAssemblyPinIndex(saved(1), "other-board", step, 2)).toBe(0);
    expect(
      restoreAssemblyPinIndex(
        saved(1),
        "current",
        { id: "other", parts: ["sensor"] },
        2,
      ),
    ).toBe(0);
    expect(
      restoreAssemblyPinIndex(
        saved(1, {
          journey: { stepId: step.id, action: "insert", pinIndex: 1 },
        }),
        "current",
        step,
        2,
      ),
    ).toBe(0);
  });

  it("distingue los conectores reales de Uno, Nano, módulos y los hilos del termómetro", () => {
    const uno = circuitForBoard(circuits.led, "uno");
    const nano = circuitForBoard(circuits.led, "nano");
    const unoWire = uno.wires.find((wire) => wire.id === "w_led_sig")!;
    const nanoWire = nano.wires.find((wire) => wire.id === "w_led_sig")!;
    expect(wireItemInfo(uno, unoWire)).toMatchObject({
      connector: "macho-macho",
      a: "macho",
      b: "macho",
      ownLead: false,
    });
    expect(wireItemInfo(nano, nanoWire)).toMatchObject({
      connector: "hembra-macho",
      a: "hembra",
      b: "macho",
      ownLead: false,
    });
    expect(
      wireItemInfo(
        circuits.soil,
        circuits.soil.wires.find((wire) => wire.from === "soil.VCC")!,
      ),
    ).toMatchObject({ a: "hembra", b: "macho", ownLead: false });
    expect(
      wireItemInfo(
        circuits.ds18b20,
        circuits.ds18b20.wires.find((wire) => wire.id === "c_ds_3v3")!,
      ),
    ).toMatchObject({
      a: "hilo del sensor",
      b: "macho",
      ownLead: true,
      label: "Un solo hilo rojo del sensor.",
    });
  });

  it("el mapa compacto distingue riel superior/inferior y la placa y módulo de cada pin", () => {
    expect(assemblyEndpointLabel(circuits.led, "bn:27")).toBe(
      "riel azul (−) de abajo · 27",
    );
    expect(assemblyEndpointLabel(circuits.soil, "soil.VCC")).toBe(
      "Sonda de humedad de suelo · VCC",
    );
    expect(
      assemblyEndpointLabel(
        circuitForBoard(circuits.led, "nano"),
        "controller.D2",
      ),
    ).toBe("Arduino Nano · D2");
  });
});
