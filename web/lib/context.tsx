import { createContext, useContext } from "react";
import type { Session, Reading } from "./api";
import type { ThemePref } from "./theme";

export type Board = "pico" | "uno" | "nano" | "nano-old";
export type ToastTone = "success" | "error" | "info";

export const BOARD_NAMES: Record<Board, string> = {
  pico: "Raspberry Pi Pico W",
  uno: "Arduino Uno",
  nano: "Arduino Nano",
  "nano-old": "Arduino Nano (bootloader antiguo)",
};

/** Lo que el servidor informa sobre sí mismo en /api/health. */
export interface Health {
  ok: boolean;
  version: string;
  /** "serverless" en Vercel; "server" en el servidor local o en Docker. */
  runtime?: "serverless" | "server";
  /** Cómo se entera el navegador de datos nuevos. */
  realtime?: "sse" | "poll";
  database?: "postgres" | "sqlite";
  telegramConfigured: boolean;
  /** La compilación de Arduino solo existe en el servidor local del taller. */
  arduinoAvailable: boolean;
}

export type AppContextType = {
  /* Sesión del grupo */
  session: Session | null;
  ready: boolean;
  /** Se está usando la copia local porque el servidor no responde. */
  offline: boolean;
  createSession: (name: string, groupNumber: number) => Promise<void>;
  updateSession: (patch: Partial<Session>) => Promise<void>;
  refreshSession: () => Promise<void>;
  openOnboarding: (destination?: string) => void;

  /* Navegación */
  route: string;
  navigate: (path: string) => void;

  /* Avisos. El booleano se mantiene por compatibilidad: true = error. */
  notify: (message: string, tone?: ToastTone | boolean) => void;

  /* Placa y USB */
  board: Board;
  setBoard: (board: Board) => void;
  /** El navegador tiene Web Serial (Chrome o Edge de escritorio, en HTTPS o localhost). */
  serialSupported: boolean;
  connected: boolean;
  connecting: boolean;
  /** Hay una operación USB en curso (subir, guardar, instalar). */
  busy: boolean;
  /** Hay un programa del estudiante ejecutándose en la placa. */
  running: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  runCode: (code: string, lessonId?: string) => Promise<void>;
  stopCode: () => Promise<void>;
  saveCode: (code: string) => Promise<void>;
  terminal: string;
  clearTerminal: () => void;
  sendSerial: (text: string) => Promise<void>;
  /** Consulta MicroPython; detiene el programa y comparte el bloqueo de operaciones USB. */
  queryPico: (code: string) => Promise<string>;
  /** Lecturas recibidas por USB en esta pestaña. */
  localReadings: Reading[];
  lastDiagnostics: Record<string, unknown>;
  installStation: (
    ssid: string,
    password: string,
    endpoint: string,
  ) => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;

  /* Servidor */
  health: Health | null;

  /* Preferencias */
  theme: ThemePref;
  setTheme: (theme: ThemePref) => void;
  /** Modo guiado (una cosa a la vez) o modo libre (todo a la vista). */
  guided: boolean;
  setGuided: (guided: boolean) => void;
};

export const AppContext = createContext<AppContextType>(null!);
export const useApp = () => useContext(AppContext);
