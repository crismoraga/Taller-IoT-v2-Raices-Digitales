import type { IconName } from "../brand/Graphics";
import type { MedallionGlyph } from "../brand/graphics/medallions";
import type { CircuitId } from "../circuit/layouts";
import type { WireColor } from "../circuit/model";

/**
 * Contenido del taller. Cada actividad cubre las 14 partes que exige el contexto maestro:
 *  1 Objetivo · 2 Qué necesitas · 3 Qué hace el componente · 4 Conexión paso a paso ·
 *  5 Por qué se conecta así · 6 Diagrama interactivo · 7 Código base · 8 Ejecutar ·
 *  9 Ver resultado · 10 Modificar · 11 Experimentar · 12 Desafío · 13 Checkpoint ·
 *  14 Problemas comunes.
 *
 * Voz: español de Chile, tuteando. Frases cortas, una idea por frase. Términos técnicos
 * precisos y siempre explicados la primera vez. Sin emoji. Decimales con coma (3,3 V).
 * Cada instrucción nombra la placa por separado: nunca Pico y Arduino en la misma frase.
 */

export type StageId = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | "explora";

export interface Stage {
  id: StageId;
  /** "Etapa 1" o "Zona Explora". */
  label: string;
  title: string;
  /** Una frase: qué se logra en la etapa. */
  summary: string;
  icon: IconName;
  /** Medalla que se gana al completar la etapa. */
  glyph: MedallionGlyph;
  lessons: string[];
}

export interface Material {
  name: string;
  qty?: number;
  /** Cómo reconocerlo: "bandas rojo, rojo, café", "base sellada con resina negra". */
  note?: string;
}

export interface Concept {
  /** Pregunta o frase corta: "¿Qué es un LED?". */
  title: string;
  /** 2 a 4 párrafos cortos. Primero la idea con una analogía cotidiana; después el dato técnico. */
  body: string[];
  /** Datos duros en formato etiqueta → valor: "Voltaje" → "3,3 V". */
  facts?: { label: string; value: string }[];
}

/** Un cambio guiado al código: qué línea tocar y qué observar después. */
export interface ModifyTask {
  title: string;
  instruction: string;
  /** Fragmento exacto del código base que se cambia (debe existir tal cual en `code`). */
  find?: string;
  /** Por qué reemplazarlo. */
  replace?: string;
  /** Qué debería pasar en el mundo físico o en la terminal. */
  observe: string;
  /** Cambio equivalente en el sketch, con su fragmento C++ exacto cuando corresponde. */
  arduino?: {
    instruction: string;
    find?: string;
    replace?: string;
    observe?: string;
  };
}

export interface QuizQuestion {
  question: string;
  /** 3 o 4 alternativas plausibles; una sola correcta. */
  options: string[];
  /** Índice de la correcta. */
  answer: number;
  /** Microlección de una o dos frases que se muestra al responder, acierte o no. */
  explain: string;
}

/** Un síntoma observable y qué revisar, del más probable al menos probable. */
export interface Trouble {
  symptom: string;
  checks: string[];
}

/** Fila de la guía de pines para montajes sin plano de protoboard (Explora y Arduino). */
export interface PinRow {
  /** Terminal de la pieza: "LCD pin 4 (RS)". */
  from: string;
  /** Destino en la placa: "GP5", "3V3", "GND", "VBUS" (Pico) o "D5", "5V", "GND" (Arduino). */
  to: string;
  color?: WireColor;
  /** Componente en serie o aclaración: "con resistencia de 1 kΩ en serie". */
  note?: string;
  /** Advertencia eléctrica de esta conexión. */
  warning?: string;
}

export interface Lesson {
  id: string;
  stage: StageId;
  /** Parte de la ruta exprés de 60 minutos. */
  essential?: boolean;
  /** Título en oración, sin punto final: "Tu primera señal". */
  title: string;
  /** Una línea para tarjetas y listas. */
  summary: string;
  /** Minutos estimados. */
  duration: number;
  icon: IconName;

  /** 1. Objetivo: qué sabrá hacer el grupo al terminar. Una frase. */
  objective: string;
  /** 2. Qué necesitas. */
  materials: Material[];
  /** 3. Qué hace el componente. */
  concept: Concept;
  /** Reglas de seguridad que se muestran antes de cablear. */
  safety?: string[];

  /** 4 y 6. Montaje en protoboard para la Pico W, con pasos y diagrama (web/circuit/layouts.ts). */
  circuit?: CircuitId;
  /** Alternativa cuando no hay plano de protoboard: guía de pines para la Pico W. */
  pins?: { part: string; rows: PinRow[]; notes?: string[] };
  /** Guía de pines para Arduino Uno/Nano (misma actividad con placa de 5 V). */
  arduino?: { rows: PinRow[]; notes?: string[] };
  /** 5. Por qué se conecta así. */
  why: string;

  /** 7. Código base en MicroPython para la Pico W. */
  code?: string;
  /** Código equivalente para Arduino Uno/Nano. */
  arduinoCode?: string;
  /** Explicación línea a línea de las partes clave del código. */
  codeNotes?: { line: string; note: string }[];
  /** 8 y 9. Qué debe pasar al ejecutar, y un ejemplo de lo que imprime la terminal. */
  expected: string;
  sampleOutput?: string;

  /** 10. Modificar: cambios guiados, de menor a mayor. */
  modify: ModifyTask[];
  /** 11. Experimentar: preguntas abiertas para probar con las manos. */
  experiment: string[];
  /** 12. Desafío, con pistas graduales (de la más vaga a la más directa). */
  challenge: {
    prompt: string;
    hints: string[];
    solution?: string;
    arduino?: { prompt?: string; hints: string[]; solution?: string };
  };
  /** 13. Checkpoint: 2 o 3 preguntas de comprensión. */
  checkpoint: QuizQuestion[];
  /** 14. Problemas comunes. */
  troubleshooting: Trouble[];

  /** Sensor de telemetría asociado (para mostrar su lectura en vivo). */
  sensor?: string;
  /** Herramienta integrada que la actividad usa en vez de (o además de) código. */
  tool?: "calibration" | "station" | "dashboard" | "alerts";
}
