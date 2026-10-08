import { useEffect, useRef, useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import {
  Play,
  Square,
  Download,
  Copy,
  RotateCcw,
  Save,
  Maximize2,
  Terminal,
  Trash2,
  Send,
  Minimize2,
} from "lucide-react";
import { useApp } from "../lib/context";
import { download } from "../lib/api";
import { offline } from "../lib/offline";
import { Button, Notice } from "./Common";
(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
loader.config({ monaco });
monaco.editor.defineTheme("raices", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "7e8f79", fontStyle: "italic" },
    { token: "keyword", foreground: "366f59" },
    { token: "string", foreground: "b56d41" },
    { token: "number", foreground: "af7045" },
  ],
  colors: {
    "editor.background": "#fbfcf8",
    "editor.foreground": "#24483a",
    "editorLineNumber.foreground": "#a7b2a3",
    "editor.lineHighlightBackground": "#f1f5eb",
    "editor.selectionBackground": "#dde8ce",
    "editorCursor.foreground": "#376b52",
  },
});
export default function CodeWorkbench({
  lessonId,
  code,
  arduinoCode,
}: {
  lessonId: string;
  code: string;
  arduinoCode?: string;
}) {
  const app = useApp();
  const arduino = app.board !== "pico";
  const original = arduino ? arduinoCode || "" : code;
  const key = `${lessonId}.${arduino ? "arduino" : "python"}`;
  const [value, setValue] = useState(app.session?.drafts[key] ?? original),
    [full, setFull] = useState(false),
    [command, setCommand] = useState(""),
    [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null),
    terminalEl = useRef<HTMLPreElement>(null),
    latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    setValue(app.session?.drafts[key] ?? original);
    setSaved(true);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [key]);
  useEffect(() => {
    if (terminalEl.current)
      terminalEl.current.scrollTop = terminalEl.current.scrollHeight;
  }, [app.terminal]);
  const change = (v: string) => {
    setValue(v);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (app.session)
        void app
          .updateSession({ drafts: { ...app.session.drafts, [key]: v } })
          .then(() => setSaved(true))
          .catch(() =>
            app.notify(
              "No se guardó el borrador. Descárgalo para conservarlo.",
              true,
            ),
          );
    }, 800);
  };
  const restore = () => {
    change(original);
    app.notify("Código original restaurado.");
  };
  return (
    <div className={`workbench ${full ? "fullscreen" : ""}`}>
      <div className="workbench-header">
        <div>
          <span className="file-dot" />
          <strong>{arduino ? "experimento.ino" : "experimento.py"}</strong>
          <span className="code-language">
            {arduino ? "ARDUINO C++" : "MICROPYTHON"}
          </span>
        </div>
        <button
          className="icon-button"
          onClick={() => setFull(!full)}
          aria-label={full ? "Salir de pantalla completa" : "Pantalla completa"}
        >
          {full ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
        </button>
      </div>
      {arduino && !arduinoCode ? (
        <Notice tone="warning">
          Esta etapa configura Wi-Fi de Pico W. Para Uno/Nano, usa los
          experimentos USB del laboratorio.
        </Notice>
      ) : (
        <Editor
          height={full ? "calc(100vh - 340px)" : "330px"}
          language={arduino ? "cpp" : "python"}
          theme="raices"
          value={value}
          onChange={(v) => change(v || "")}
          loading={<div className="editor-loading">Abriendo editor…</div>}
          options={{
            fontSize: 13,
            fontFamily: "Cascadia Code, Consolas, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: "on",
            padding: { top: 18, bottom: 12 },
            wordWrap: "on",
            automaticLayout: true,
            tabSize: 4,
            renderLineHighlight: "line",
            accessibilitySupport: "on",
            ariaLabel: "Editor de código del experimento",
          }}
        />
      )}
      <div className="editor-toolbar">
        <div>
          <Button
            onClick={() => void app.runCode(value)}
            disabled={!app.connected || !value || (arduino && !arduinoCode)}
            loading={app.busy}
          >
            <Play size={14} />
            {arduino ? "Compilar y cargar" : "Ejecutar"}
          </Button>
          <button
            className="icon-button"
            aria-label="Detener código"
            onClick={() => void app.stopCode()}
            disabled={!app.connected || app.busy}
          >
            <Square size={16} />
          </button>
          <span className="autosave">
            {saved
              ? offline.pending()?.id === app.session?.id
                ? "Borrador local · pendiente de sincronizar"
                : "Borrador guardado"
              : "Guardando…"}
          </span>
        </div>
        <div className="editor-tools">
          <button
            className="icon-button"
            aria-label="Guardar en la placa"
            title="Guardar en la placa"
            disabled={!app.connected || app.busy}
            onClick={() => void app.saveCode(value)}
          >
            <Save size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Restaurar código original"
            title="Restaurar original"
            onClick={restore}
          >
            <RotateCcw size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Copiar código"
            title="Copiar"
            onClick={() =>
              void navigator.clipboard
                .writeText(value)
                .then(() => app.notify("Código copiado."))
                .catch(() =>
                  app.notify("No se pudo copiar. Usa descargar.", true),
                )
            }
          >
            <Copy size={16} />
          </button>
          <button
            className="icon-button"
            aria-label="Descargar código"
            title="Descargar"
            onClick={() =>
              download(arduino ? "experimento.ino" : "main.py", value)
            }
          >
            <Download size={16} />
          </button>
        </div>
      </div>
      <div className="terminal-header">
        <span>
          <Terminal size={14} />
          TERMINAL SERIAL{" "}
          <span className={app.connected ? "dot-online" : "dot-offline"} />
        </span>
        <button
          className="icon-button"
          onClick={app.clearTerminal}
          aria-label="Limpiar terminal"
        >
          <Trash2 size={14} />
        </button>
      </div>
      <pre className="serial-output" ref={terminalEl}>
        {app.terminal ||
          "La salida real de tu placa aparecerá aquí.\nConecta USB y ejecuta tu primer programa."}
      </pre>
      <form
        className="serial-command"
        onSubmit={(e) => {
          e.preventDefault();
          if (command)
            void app
              .sendSerial(command + "\r\n")
              .then(() => setCommand(""))
              .catch((err) => app.notify(err.message, true));
        }}
      >
        <span>›</span>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="Enviar comando serial…"
          aria-label="Comando serial"
          disabled={!app.connected}
        />
        <button
          className="icon-button"
          type="submit"
          aria-label="Enviar comando"
          disabled={!app.connected || !command}
        >
          <Send size={14} />
        </button>
      </form>
      {!app.connected && (
        <div className="editor-fallback">
          Chrome o Edge de escritorio + USB. También puedes descargar el archivo
          y abrirlo en {arduino ? "Arduino IDE" : "Thonny"}.
        </div>
      )}
    </div>
  );
}
