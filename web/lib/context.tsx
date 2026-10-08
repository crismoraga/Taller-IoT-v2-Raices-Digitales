import { createContext, useContext } from "react";
import type { Session, Reading } from "./api";
export type Board = "pico" | "uno" | "nano" | "nano-old";
export type AppContextType = {
  session: Session | null;
  ready: boolean;
  route: string;
  navigate: (path: string) => void;
  notify: (message: string, error?: boolean) => void;
  createSession: (name: string, groupNumber: number) => Promise<void>;
  updateSession: (patch: Partial<Session>) => Promise<void>;
  board: Board;
  setBoard: (board: Board) => void;
  connected: boolean;
  busy: boolean;
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  runCode: (code: string) => Promise<void>;
  stopCode: () => Promise<void>;
  saveCode: (code: string) => Promise<void>;
  terminal: string;
  clearTerminal: () => void;
  localReadings: Reading[];
  lastDiagnostics: Record<string, unknown>;
  sendSerial: (text: string) => Promise<void>;
  installStation: (
    ssid: string,
    password: string,
    endpoint: string,
  ) => Promise<void>;
  revokeDevice: (deviceId: string) => Promise<void>;
  openOnboarding: () => void;
  refreshSession: () => Promise<void>;
};
export const AppContext = createContext<AppContextType>(null!);
export const useApp = () => useContext(AppContext);
