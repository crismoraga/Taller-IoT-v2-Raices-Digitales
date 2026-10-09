import type { Stage } from "./types";

/**
 * La ruta del taller: las Etapas 0 a 10 del contexto maestro más la Zona Explora.
 * Las actividades marcadas como `essential` forman la ruta exprés de 60 minutos.
 */
export const stages: Stage[] = [
  {
    id: 0,
    label: "Etapa 0",
    title: "Bienvenida",
    summary: "Qué es IoT, qué vas a construir y cómo trabajar con seguridad.",
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
    summary: "Todos los sensores funcionando a la vez.",
    icon: "board",
    glyph: "chip",
    lessons: ["station"],
  },
  {
    id: 8,
    label: "Etapa 8",
    title: "IoT",
    summary: "Conecta la Pico W al Wi-Fi y envía telemetría.",
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

/** Ruta exprés: de cero a una planta conectada en 60 minutos. */
export const expressRoute = [
  "welcome",
  "led",
  "blink",
  "soil",
  "calibration",
  "cloud",
];

/** Identificadores antiguos que siguen apareciendo en progresos guardados. */
export const legacyLessonIds: Record<string, string> = { sensors: "soil" };
