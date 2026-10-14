export type PiSensor =
  | "dht11"
  | "ds18b20"
  | "distance"
  | "motion"
  | "rain"
  | "soil"
  | "light"
  | "water_level";

export const PI_SENSORS: Record<
  PiSensor,
  { label: string; connections: string[]; adc?: true; note?: string }
> = {
  dht11: {
    label: "DHT11 · temperatura y humedad",
    connections: [
      "VCC → 3V3 · pin físico 1",
      "DATA / S → BCM22 · pin físico 15",
      "GND / − → GND · pin físico 6",
    ],
    note: "Sigue las marcas de tu módulo. Usa una variante que funcione a 3,3 V; DATA también queda a 3,3 V. Si el módulo no incorpora pull-up, conecta 10 kΩ entre DATA y 3V3.",
  },
  ds18b20: {
    label: "DS18B20 · temperatura de la sonda",
    connections: [
      "VDD → 3V3 · pin físico 1",
      "DATA → BCM4 · pin físico 7",
      "GND → GND · pin físico 6",
      "Dos resistencias de 10 kΩ en paralelo entre DATA y 3V3",
    ],
    note: "Activa 1-Wire en Raspberry Pi OS. El comprobador lee el bus del sistema y verifica el CRC del sensor.",
  },
  distance: {
    label: "HC-SR04 · distancia",
    connections: [
      "VCC → 5V · pin físico 2",
      "TRIG → BCM23 · pin físico 16",
      "ECHO → divisor resistivo → BCM24 · pin físico 18",
      "GND → GND · pin físico 6",
    ],
    note: "ECHO sale a 5 V. Dos resistencias de 1 kΩ en serie desde ECHO hasta BCM24 y tres de 1 kΩ en serie desde BCM24 hasta GND convierten la señal a unos 3 V.",
  },
  motion: {
    label: "HC-SR501 · movimiento",
    connections: [
      "VCC → 5V · pin físico 2",
      "OUT → BCM26 · pin físico 37",
      "GND → GND · pin físico 6",
    ],
    note: "Dale unos 60 segundos para estabilizarse. El nivel de OUT cambia cuando detecta movimiento.",
  },
  rain: {
    label: "FC-37 + LM393 · lluvia",
    connections: [
      "Placa de lluvia → los dos contactos de su módulo LM393",
      "VCC del LM393 → 3V3 · pin físico 1",
      "DO del LM393 → BCM17 · pin físico 11",
      "GND del LM393 → GND · pin físico 6",
    ],
    note: "Usa DO. En el módulo habitual, 1 significa mojado después de invertir su salida activa baja; ajusta el potenciómetro y observa cómo cambia.",
  },
  soil: {
    label: "Suelo capacitivo v1.2 · necesita ADC externo",
    adc: true,
    connections: [
      "VCC → 3V3 · pin físico 1",
      "GND → GND · pin físico 6",
      "AOUT → CH0 del MCP3008",
    ],
  },
  light: {
    label: "LDR · necesita ADC externo",
    adc: true,
    connections: [
      "3V3 → LDR → nodo CH1 del MCP3008",
      "Nodo CH1 → resistencia de 10 kΩ → GND",
    ],
  },
  water_level: {
    label: "Nivel de agua · necesita ADC externo",
    adc: true,
    connections: [
      "+ → 3V3 · pin físico 1",
      "− → GND · pin físico 6",
      "S → CH2 del MCP3008",
    ],
  },
};

const shellQuote = (value: string) => `'${value.replaceAll("'", "'\\''")}'`;

export function piCheckCommand(sensor: PiSensor) {
  if (!Object.hasOwn(PI_SENSORS, sensor))
    throw new Error("Elige un sensor para comprobar.");
  return `${sensor === "dht11" ? ".venv/bin/python" : "python3"} check_sensors.py --sensor ${sensor}${PI_SENSORS[sensor].adc ? " --adc mcp3008" : ""}`;
}

export function piBridgeCommand(origin: string, code: string, port: string) {
  const url = new URL(origin);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    !/^[a-fA-F0-9]{12}$/.test(code) ||
    !/^\/dev\/[A-Za-z0-9_./-]+$/.test(port)
  )
    throw new Error(
      "Revisa la dirección HTTPS, el código y el puerto de la Pi.",
    );
  return `python3 raspberry-pi-bridge.py --server ${shellQuote(url.origin)} --pair ${shellQuote(code.toUpperCase())} --port ${shellQuote(port)}`;
}
