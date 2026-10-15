import type { Stage } from "./types";

/**
 * La ruta del taller: las Etapas 0 a 10 del contexto maestro más la Zona Explora.
 * Las actividades marcadas como `essential` forman el recorrido recomendado.
 */
export const stages: Stage[] = [
  {
    id: 0,
    label: "Etapa 0",
    title: "Entiende las conexiones",
    summary: "Descubre qué agujeros están unidos y cómo llega una señal desde Arduino.",
    icon: "rocket",
    glyph: "rocket",
    lessons: ["welcome"],
  },
  {
    id: 1,
    label: "Etapa 1",
    title: "Salidas digitales",
    summary: "Enciende un LED y cambia su ritmo desde el código.",
    icon: "lightbulb",
    glyph: "bulb",
    lessons: ["led_onboard", "led", "blink"],
  },
  {
    id: 2,
    label: "Etapa 2",
    title: "Entradas y actuadores",
    summary: "Lee un pulsador y haz sonar un buzzer.",
    icon: "tap",
    glyph: "bolt",
    lessons: ["button", "button_led", "buzzer", "active_buzzer"],
  },
  {
    id: 3,
    label: "Etapa 3",
    title: "Sensores básicos",
    summary: "Mide luz y temperatura con entradas analógicas.",
    icon: "wave",
    glyph: "wave",
    lessons: ["ldr", "lm35"],
  },
  {
    id: 4,
    label: "Etapa 4",
    title: "Sensores ambientales",
    summary: "Temperatura y humedad del aire con el DHT11.",
    icon: "thermometer",
    glyph: "globe",
    lessons: ["dht11"],
  },
  {
    id: 5,
    label: "Etapa 5",
    title: "La planta",
    summary: "Humedad y temperatura del suelo, con calibración.",
    icon: "sprout",
    glyph: "heart",
    lessons: ["soil", "calibration", "ds18b20"],
  },
  {
    id: 6,
    label: "Etapa 6",
    title: "Agua y entorno",
    summary: "Lluvia, nivel de agua, distancia y movimiento.",
    icon: "drop",
    glyph: "signal",
    lessons: ["rain", "water_level", "distance", "motion"],
  },
  {
    id: 7,
    label: "Etapa 7",
    title: "Estación integrada",
    summary: "Empieza con luz y aire; añade sensores a tu maceta de uno en uno.",
    icon: "board",
    glyph: "chip",
    lessons: ["station"],
  },
  {
    id: 8,
    label: "Etapa 8",
    title: "IoT",
    summary: "Envía telemetría por USB desde tu PC o por Wi-Fi en una Pico W.",
    icon: "wifi",
    glyph: "wifi",
    lessons: ["cloud"],
  },
  {
    id: 9,
    label: "Etapa 9",
    title: "Dashboard",
    summary: "Lee tu planta en vivo: datos, históricos y estados.",
    icon: "chart",
    glyph: "database",
    lessons: ["dashboard"],
  },
  {
    id: 10,
    label: "Etapa 10",
    title: "Automatización",
    summary: "Reglas, alarmas y avisos por Telegram.",
    icon: "bell",
    glyph: "megaphone",
    lessons: ["alerts"],
  },
  {
    id: "explora",
    label: "Zona Explora",
    title: "Todo lo demás de tu kit",
    summary: "Pantallas, motores y sensores extra para seguir experimentando.",
    icon: "flask",
    glyph: "star",
    lessons: [
      "potentiometer",
      "tilt",
      "flame",
      "infrared",
      "shift_register",
      "seven_segment",
      "four_digit",
      "matrix",
      "lcd",
      "stepper",
      "servo",
    ],
  },
];

/** Un recorrido incremental: conexiones, LED, dos sensores y una estación que crece. */
export const expressRoute = [
  "welcome",
  "led",
  "blink",
  "button_led",
  "ldr",
  "dht11",
  "station",
  "soil",
  "calibration",
  "dashboard",
];

/** Nombres concretos para reconocer cada paso sin aprender todo el catálogo. */
export const guidedRouteCopy: Record<
  string,
  { title: string; summary: string }
> = {
  welcome: {
    title: "Entiende las conexiones",
    summary: "Toca la protoboard y descubre cómo conectar un pin, una fila y GND.",
  },
  led: {
    title: "Enciende un LED",
    summary: "Conecta el LED, carga el programa y comprueba que se enciende.",
  },
  blink: {
    title: "Hazlo parpadear",
    summary: "Conserva los cables y cambia el ritmo desde el programa.",
  },
  button_led: {
    title: "Controla el LED",
    summary: "Añade un pulsador: aprieta para encender y suelta para apagar.",
  },
  ldr: {
    title: "Mide la luz",
    summary: "Añade la LDR y mira cómo cambia la lectura al taparla.",
  },
  dht11: {
    title: "Mide temperatura y humedad",
    summary: "Conecta el DHT11 y recibe las dos medidas del aire.",
  },
  station: {
    title: "Empieza tu estación",
    summary: "Lleva luz y aire a tu maceta y mira sus primeras lecturas juntas.",
  },
  soil: {
    title: "Añade la sonda de suelo",
    summary: "Amplía tu estación con la sonda capacitiva y prueba cómo responde.",
  },
  calibration: {
    title: "Calibra tu sonda",
    summary:
      "Guarda tus dos referencias para interpretar la humedad del suelo.",
  },
  dashboard: {
    title: "Monitorea tu planta",
    summary:
      "Observa tus lecturas reales y descubre cómo cambian con el tiempo.",
  },
};

/** Identificadores antiguos que siguen apareciendo en progresos guardados. */
export const legacyLessonIds: Record<string, string> = { sensors: "soil" };
