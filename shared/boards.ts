/** MCU and compiler profiles are shared by validation, the uploader and the UI. */
export const ARDUINO_BOARDS = ["uno", "nano", "nano-old", "nano-168"] as const;
export type ArduinoBoard = (typeof ARDUINO_BOARDS)[number];
export const BOARDS = ["pico", ...ARDUINO_BOARDS] as const;
export type Board = (typeof BOARDS)[number];

export function isBoard(value: unknown): value is Board {
  return typeof value === "string" && (BOARDS as readonly string[]).includes(value);
}

export const BOARD_NAMES: Record<Board, string> = {
  pico: "Raspberry Pi Pico · MicroPython",
  uno: "Arduino Uno",
  nano: "Arduino Nano",
  "nano-old": "Arduino Nano (bootloader antiguo)",
  "nano-168": "Arduino Nano · ATmega168",
};

export interface AVRBoardProfile {
  label: string;
  fqbn: string;
  signature: readonly [number, number, number];
  bootSpeeds: readonly number[];
  maxFlash: number;
  maxRam: number;
  clockHz: number;
}

/** Values from the official Arduino AVR core boards.txt; no guessed MCU aliases. */
export const AVR_BOARD_PROFILES: Record<ArduinoBoard, AVRBoardProfile> = {
  uno: {
    label: "Arduino Uno · ATmega328P",
    fqbn: "arduino:avr:uno",
    signature: [0x1e, 0x95, 0x0f],
    bootSpeeds: [115200, 57600],
    maxFlash: 32256,
    maxRam: 2048,
    clockHz: 16000000,
  },
  nano: {
    label: "Arduino Nano · ATmega328P",
    fqbn: "arduino:avr:nano:cpu=atmega328",
    signature: [0x1e, 0x95, 0x0f],
    bootSpeeds: [115200, 57600],
    maxFlash: 30720,
    maxRam: 2048,
    clockHz: 16000000,
  },
  "nano-old": {
    label: "Arduino Nano · ATmega328P · bootloader antiguo",
    fqbn: "arduino:avr:nano:cpu=atmega328old",
    signature: [0x1e, 0x95, 0x0f],
    bootSpeeds: [57600, 115200],
    maxFlash: 30720,
    maxRam: 2048,
    clockHz: 16000000,
  },
  "nano-168": {
    label: "Arduino Nano · ATmega168",
    fqbn: "arduino:avr:nano:cpu=atmega168",
    signature: [0x1e, 0x94, 0x06],
    bootSpeeds: [19200],
    maxFlash: 14336,
    maxRam: 1024,
    clockHz: 16000000,
  },
};

/** A USB bridge cannot distinguish a Nano's MCU or its installed bootloader. */
export function nanoUSBChoice(selected: Board): ArduinoBoard {
  return selected === "nano-old" || selected === "nano-168" ? selected : "nano";
}
