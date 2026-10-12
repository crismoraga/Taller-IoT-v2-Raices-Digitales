import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import Editor, { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api";
import "monaco-editor/esm/vs/basic-languages/python/python.contribution";
import "monaco-editor/esm/vs/basic-languages/cpp/cpp.contribution";
import "monaco-editor/esm/vs/editor/contrib/find/browser/findController";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import { Icon } from "../brand/Graphics";
import { download } from "../lib/api";
import { useApp } from "../lib/context";
import { offline } from "../lib/offline";
import { resolveTheme, watchSystemTheme } from "../lib/theme";
import { ConnectButton } from "../shell/ConnectButton";
import { Button, IconButton } from "../ui/Button";
import { Tag } from "../ui/Card";
import { Callout } from "../ui/Feedback";
import { ConfirmDialog } from "../ui/Overlay";
import { ProgressBar } from "../ui/Progress";
import { cx } from "../ui/cx";

(self as unknown as { MonacoEnvironment: unknown }).MonacoEnvironment = {
  getWorker: () => new EditorWorker(),
};
loader.config({ monaco });

monaco.editor.defineTheme("tel-light", {
  base: "vs",
  inherit: true,
  rules: [
    { token: "comment", foreground: "536559", fontStyle: "italic" },
    { token: "keyword", foreground: "266448", fontStyle: "bold" },
    { token: "string", foreground: "33661b" },
    { token: "number", foreground: "7f5315" },
    { token: "type", foreground: "963c33" },
    { token: "delimiter", foreground: "536559" },
  ],
  colors: {
    "editor.background": "#fffef8",
    "editor.foreground": "#143c32",
    "editorLineNumber.foreground": "#657564",
    "editorLineNumber.activeForeground": "#266448",
    "editor.lineHighlightBackground": "#f0f3e8",
    "editor.selectionBackground": "#d4e8bd",
    "editor.inactiveSelectionBackground": "#e2edcc",
    "editorCursor.foreground": "#266448",
    "editorIndentGuide.background1": "#d3dacd",
    "editorIndentGuide.activeBackground1": "#aebdac",
    "editorWidget.background": "#fffef8",
    "editorWidget.foreground": "#143c32",
    "editorWidget.border": "#d3dacd",
    "editor.findMatchBackground": "#f3d56a66",
    "editor.findMatchBorder": "#7f5315",
    "editor.findMatchHighlightBackground": "#e2edcc",
    "editorSuggestWidget.selectedBackground": "#e2edcc",
    "editorSuggestWidget.highlightForeground": "#266448",
  },
});
monaco.editor.defineTheme("tel-dark", {
  base: "vs-dark",
  inherit: true,
  rules: [
    { token: "comment", foreground: "b6c5b8", fontStyle: "italic" },
    { token: "keyword", foreground: "d0ef83", fontStyle: "bold" },
    { token: "string", foreground: "9cd59a" },
    { token: "number", foreground: "f3d56a" },
    { token: "type", foreground: "dc916e" },
    { token: "delimiter", foreground: "b6c5b8" },
  ],
  colors: {
    "editor.background": "#102a23",
    "editor.foreground": "#f0f1df",
    "editorLineNumber.foreground": "#98b29c",
    "editorLineNumber.activeForeground": "#d0ef83",
    "editor.lineHighlightBackground": "#18382d",
    "editor.selectionBackground": "#1b3e2c",
    "editor.inactiveSelectionBackground": "#18382d",
    "editorCursor.foreground": "#d0ef83",
    "editorIndentGuide.background1": "#2b4c3e",
    "editorIndentGuide.activeBackground1": "#4c725b",
    "editorWidget.background": "#102a23",
    "editorWidget.foreground": "#f0f1df",
    "editorWidget.border": "#4c725b",
    "editor.findMatchBackground": "#f3d56a1a",
    "editor.findMatchBorder": "#f3d56a",
    "editor.findMatchHighlightBackground": "#1b3e2c",
    "editorSuggestWidget.selectedBackground": "#1b3e2c",
    "editorSuggestWidget.highlightForeground": "#d0ef83",
  },
});

export interface WorkbenchHandle {
  /** Aplica un cambio guiado, conservando deshacer y el borrador del estudiante. */
  applyChange: (find: string, replacement: string) => boolean;
  /** Selecciona y muestra un fragmento del código (para los cambios guiados). */
  reveal: (text: string) => boolean;
  /** Reemplaza todo el código (por ejemplo, con la solución del desafío). */
  load: (code: string) => void;
}

interface Props {
  lessonId: string;
  code: string;
  arduinoCode?: string;
  /** Alto del editor en píxeles fuera de pantalla completa. */
  editorHeight?: number;
  className?: string;
  onReady?: (ready: boolean) => void;
}

/**
 * Editor + ejecución + terminal. El código corre en la placa real por USB:
 * Ejecutar, Detener, Guardar en la placa, Restaurar, Copiar, Descargar, pantalla completa,
 * terminal serial y autoguardado del borrador por grupo.
 */
export const CodeWorkbench = forwardRef<WorkbenchHandle, Props>(
  function CodeWorkbench(
    { lessonId, code, arduinoCode, editorHeight = 340, className, onReady },
    ref,
  ) {
    const app = useApp();
    const arduino = app.board !== "pico";
    const original = arduino ? (arduinoCode ?? "") : code;
    const key = `${lessonId}.${arduino ? "arduino" : "python"}`;
    const cachedDraft = () => {
      const queued = offline.pending();
      return (
        (queued?.id === app.session?.id
          ? queued?.patch.drafts?.[key]
          : undefined) ??
        app.session?.drafts[key] ??
        original
      );
    };
    const [value, setValue] = useState(cachedDraft);
    const [saved, setSaved] = useState(true);
    const [command, setCommand] = useState("");
    const [full, setFull] = useState(false);
    const [confirmSave, setConfirmSave] = useState(false);
    const [confirmRestore, setConfirmRestore] = useState(false);
    const [dark, setDark] = useState(() => resolveTheme(app.theme) === "dark");
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const pending = useRef<string | null>(null);
    const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
    const wrapper = useRef<HTMLDivElement>(null);
    const terminal = useRef<HTMLPreElement>(null);
    const latest = useRef({ value, run: (_: string) => {} });
    const drafts = useRef(app.session?.drafts ?? {});
    drafts.current = app.session?.drafts ?? {};
    useEffect(() => () => onReady?.(false), [onReady]);

    useEffect(() => {
      setDark(resolveTheme(app.theme) === "dark");
      return watchSystemTheme(() =>
        setDark(resolveTheme(app.theme) === "dark"),
      );
    }, [app.theme]);

    const persist = (text: string) => {
      pending.current = null;
      if (!app.session) return;
      void app
        .updateSession({ drafts: { ...drafts.current, [key]: text } })
        .then(() => setSaved(true))
        .catch(() =>
          app.notify(
            "No se pudo guardar el borrador. Descárgalo para no perderlo.",
            "error",
          ),
        );
    };
    // Al cambiar de actividad o de placa: se guarda lo pendiente y se carga el borrador nuevo.
    useEffect(() => {
      setValue(cachedDraft());
      setSaved(true);
      return () => {
        if (timer.current) clearTimeout(timer.current);
        if (pending.current !== null) persist(pending.current);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    useEffect(() => {
      if (terminal.current)
        terminal.current.scrollTop = terminal.current.scrollHeight;
    }, [app.terminal]);

    useEffect(() => {
      const change = () =>
        setFull(document.fullscreenElement === wrapper.current);
      document.addEventListener("fullscreenchange", change);
      return () => document.removeEventListener("fullscreenchange", change);
    }, []);

    const change = (text: string) => {
      setValue(text);
      setSaved(false);
      pending.current = text;
      // El borrador local se conserva antes del debounce de red, incluso al recargar inmediatamente.
      if (app.session) {
        const patch = { drafts: { [key]: text } };
        offline.queue(app.session.id, patch);
        offline.remember({
          ...app.session,
          drafts: { ...drafts.current, [key]: text },
        });
      }
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => persist(text), 800);
    };

    useImperativeHandle(ref, () => ({
      applyChange: (find, replacement) => {
        const instance = editor.current,
          model = instance?.getModel();
        if (!instance || !model) return false;
        const matches = model.findMatches(
          find,
          false,
          false,
          true,
          null,
          false,
        );
        if (!matches.length) return false;
        instance.pushUndoStop();
        instance.executeEdits(
          "raices-guided-change",
          matches.map((match) => ({
            range: match.range,
            text: replacement,
            forceMoveMarkers: true,
          })),
        );
        instance.pushUndoStop();
        instance.revealRangeInCenter(matches[0].range);
        instance.focus();
        return true;
      },
      reveal: (text) => {
        const instance = editor.current;
        const model = instance?.getModel();
        if (!instance || !model) return false;
        const match = model.findMatches(
          text,
          false,
          false,
          true,
          null,
          false,
        )[0];
        if (!match) return false;
        instance.setSelection(match.range);
        instance.revealRangeInCenter(
          match.range,
          monaco.editor.ScrollType.Smooth,
        );
        instance.focus();
        return true;
      },
      load: (text) => {
        change(text);
        editor.current?.focus();
      },
    }));

    const unavailable = arduino && !arduinoCode;
    const noCompiler =
      arduino && app.health !== null && !app.health.arduinoAvailable;
    const canRun = app.connected && Boolean(value.trim()) && !unavailable;
    const upload = arduino ? app.uploadStatus : null;
    const uploadLabel = upload
      ? {
          compile: "1 de 3 · Compilando tu programa",
          sync: "2 de 3 · Conectando con tu Arduino",
          write: "3 de 3 · Grabando y verificando",
          verify: "3 de 3 · Grabando y verificando",
          complete: "Programa grabado y verificado",
          error: "La carga no se completó",
        }[upload.stage]
      : "";
    const run = (text: string) => void app.runCode(text, lessonId);
    latest.current = { value, run };

    const toggleFull = () => {
      const element = wrapper.current;
      if (!element) return;
      if (document.fullscreenElement) void document.exitFullscreen();
      else if (element.requestFullscreen)
        void element.requestFullscreen().catch(() => setFull((v) => !v));
      else setFull((v) => !v);
    };

    const fileName = arduino ? `${lessonId}.ino` : `${lessonId}.py`;
    const changed = value !== original;
    const status = !app.session
      ? "Crea tu grupo para guardar tu código"
      : !saved
        ? "Guardando…"
        : offline.pending()?.id === app.session.id
          ? "Guardado en este equipo · se sincroniza al volver la red"
          : changed
            ? "Borrador guardado"
            : "Código original";

    return (
      <div
        ref={wrapper}
        className={cx(
          "flex min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-surface",
          full && "fixed inset-0 z-50 rounded-none border-0",
          className,
        )}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-2">
          <Icon name="fileCode" size={18} className="text-ink-accent" />
          <span className="t-mono truncate font-bold text-ink">{fileName}</span>
          <Tag tone="sky">{arduino ? "Arduino C++" : "MicroPython"}</Tag>
          <span className="ml-auto hidden truncate text-xs font-semibold text-ink-soft sm:block">
            {status}
          </span>
          <IconButton
            icon={full ? "collapse" : "expand"}
            label={full ? "Salir de pantalla completa" : "Pantalla completa"}
            tone="ghost"
            size="sm"
            onClick={toggleFull}
          />
        </div>

        {unavailable ? (
          <div className="p-4">
            <Callout tone="info" title="Esta actividad es solo para la Pico W">
              Necesita Wi-Fi, y las placas Arduino Uno y Nano no lo tienen.
              Cambia la placa a Raspberry Pi Pico W para seguir.
            </Callout>
          </div>
        ) : (
          <div className={cx("min-h-0", full && "flex-1")}>
            <Editor
              height={full ? "100%" : editorHeight}
              language={arduino ? "cpp" : "python"}
              theme={dark ? "tel-dark" : "tel-light"}
              value={value}
              onChange={(text) => change(text ?? "")}
              onMount={(instance) => {
                editor.current = instance;
                onReady?.(true);
                // Ctrl/⌘ + Enter ejecuta, como en la mayoría de los editores.
                instance.addCommand(
                  monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter,
                  () => latest.current.run(latest.current.value),
                );
              }}
              loading={
                <p className="p-6 text-sm font-semibold text-ink-soft">
                  Abriendo el editor…
                </p>
              }
              options={{
                fontSize: 14,
                lineHeight: 22,
                fontFamily:
                  '"JetBrains Mono Variable", "Cascadia Code", Consolas, monospace',
                fontLigatures: false,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                lineNumbers: "on",
                lineNumbersMinChars: 3,
                padding: { top: 14, bottom: 14 },
                wordWrap: "on",
                automaticLayout: true,
                tabSize: 4,
                insertSpaces: true,
                renderLineHighlight: "line",
                smoothScrolling: true,
                scrollbar: {
                  verticalScrollbarSize: 10,
                  horizontalScrollbarSize: 10,
                },
                overviewRulerLanes: 0,
                guides: { indentation: true },
                accessibilitySupport: "auto",
                ariaLabel: `Editor de código: ${fileName}`,
                fixedOverflowWidgets: true,
              }}
            />
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-3 py-2.5">
          <Button
            icon="play"
            onClick={() => run(value)}
            disabled={!canRun}
            loading={app.busy}
            title="Ejecutar (Ctrl + Enter)"
          >
            {arduino ? "Compilar y cargar" : "Ejecutar"}
          </Button>
          <Button
            variant="outline"
            icon="stop"
            onClick={() => void app.stopCode()}
            disabled={!app.connected || app.busy}
          >
            Detener
          </Button>
          {app.running && (
            <span
              role="status"
              className="flex items-center gap-2 text-[13px] font-bold text-success-ink"
            >
              <span className="relative flex size-2">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-success" />
                <span className="relative size-2 rounded-full bg-success" />
              </span>
              Ejecutando en la placa
            </span>
          )}
          <div className="ml-auto flex items-center gap-1">
            <IconButton
              icon="save"
              label={
                arduino
                  ? "Cargar en la placa"
                  : "Guardar en la Pico como main.py"
              }
              tone="ghost"
              size="sm"
              disabled={!app.connected || app.busy || unavailable}
              onClick={() =>
                arduino ? void app.saveCode(value) : setConfirmSave(true)
              }
            />
            <IconButton
              icon="undo"
              label="Restaurar el código original"
              tone="ghost"
              size="sm"
              disabled={!changed}
              onClick={() => setConfirmRestore(true)}
            />
            <IconButton
              icon="copy"
              label="Copiar el código"
              tone="ghost"
              size="sm"
              onClick={() =>
                void navigator.clipboard
                  .writeText(value)
                  .then(() => app.notify("Código copiado."))
                  .catch(() =>
                    app.notify("No se pudo copiar. Usa Descargar.", "error"),
                  )
              }
            />
            <IconButton
              icon="download"
              label={`Descargar ${fileName}`}
              tone="ghost"
              size="sm"
              onClick={() => download(fileName, value)}
            />
          </div>
        </div>

        {upload && (
          <div
            role="status"
            aria-live="polite"
            aria-label="Estado de carga del programa"
            className="flex flex-col gap-2 border-t border-border bg-highlight px-3.5 py-3 text-sm text-ink"
          >
            <span className="inline-flex items-center gap-2 font-bold">
              <Icon
                name={
                  upload.stage === "complete"
                    ? "check"
                    : upload.stage === "error"
                      ? "alert"
                      : "usb"
                }
                size={17}
              />
              {uploadLabel}
            </span>
            {upload.percent !== undefined &&
              upload.stage !== "complete" &&
              upload.stage !== "error" && (
                <ProgressBar
                  value={upload.percent}
                  label="Avance de grabación y verificación"
                />
              )}
            {upload.stage === "error" && (
              <p className="text-xs leading-5 text-ink-soft">
                El detalle quedó en la terminal. Puedes corregirlo y volver a
                pulsar «Compilar y cargar».
              </p>
            )}
          </div>
        )}

        {!app.connected && !unavailable && (
          <div className="flex flex-wrap items-center gap-3 border-t border-border bg-highlight px-3.5 py-3">
            <Icon
              name={app.serialSupported ? "usb" : "alert"}
              size={20}
              className="text-ink-accent"
            />
            <p className="min-w-0 flex-1 text-sm font-semibold leading-5 text-ink">
              {app.serialSupported ? (
                <>
                  <strong className="font-extrabold">
                    Conecta tu placa para ejecutar.
                  </strong>{" "}
                  El código corre en tu {arduino ? "Arduino" : "Pico"} de
                  verdad, por el cable USB.
                </>
              ) : (
                <>
                  <strong className="font-extrabold">
                    Este navegador no puede usar el USB.
                  </strong>{" "}
                  Abre el taller en Chrome o Edge de escritorio, o descarga el
                  archivo y ejecútalo con {arduino ? "Arduino IDE" : "Thonny"}.
                </>
              )}
            </p>
            {app.serialSupported && <ConnectButton />}
          </div>
        )}
        {noCompiler && (
          <div className="border-t border-border p-3">
            <Callout
              tone="info"
              compact
              title="Comprobación del compilador pendiente"
            >
              El compilador no respondió a la última comprobación. Puedes pulsar
              «Compilar y cargar» para intentar el envío de nuevo.
            </Callout>
          </div>
        )}

        <div
          className={cx(
            "flex min-h-0 flex-col bg-code text-on-dark",
            full && "h-[32%]",
          )}
        >
          <div className="flex items-center gap-2 px-3.5 pt-2.5">
            <Icon name="terminal" size={16} className="text-accent" />
            <span className="t-overline text-[10.5px] text-accent">
              Terminal serial
            </span>
            <span className="ml-auto text-xs font-semibold text-slate">
              {app.connected
                ? "Lo que imprime tu placa"
                : "Sin placa conectada"}
            </span>
            <IconButton
              icon="eraser"
              label="Limpiar la terminal"
              tone="ghostLight"
              size="sm"
              onClick={app.clearTerminal}
            />
          </div>
          <pre
            ref={terminal}
            role="log"
            aria-label="Salida de la placa"
            tabIndex={0}
            className={cx(
              "t-mono scrollbar-thin m-0 overflow-auto whitespace-pre-wrap break-words px-3.5 pb-2 pt-1 text-cream-soft focus-visible:outline-accent",
              full ? "min-h-0 flex-1" : "h-[150px]",
            )}
          >
            {app.terminal || (
              <span className="text-slate">
                Aquí aparece lo que imprime tu programa con{" "}
                {arduino ? "Serial.println()" : "print()"}.{"\n"}
                Conecta la placa y presiona{" "}
                {arduino ? "Compilar y cargar" : "Ejecutar"}.
              </span>
            )}
          </pre>
          <form
            className="flex items-center gap-2 border-t border-primary-soft px-3.5 py-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              if (!command) return;
              void app
                .sendSerial(`${command}\r\n`)
                .then(() => setCommand(""))
                .catch((problem: Error) =>
                  app.notify(problem.message, "error"),
                );
            }}
          >
            <span aria-hidden className="t-mono font-bold text-accent">
              ›
            </span>
            <input
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              disabled={!app.connected || app.busy || app.connecting}
              aria-label="Enviar texto a la placa"
              placeholder={
                app.connected
                  ? "Escribe y presiona Enter para enviarlo a la placa"
                  : "Conecta la placa para enviarle texto"
              }
              className="t-mono h-9 min-w-0 flex-1 bg-transparent text-cream placeholder:text-slate focus:outline-none disabled:opacity-60"
            />
            <IconButton
              type="submit"
              icon="send"
              label="Enviar"
              tone="ghostLight"
              size="sm"
              disabled={
                !app.connected || app.busy || app.connecting || !command
              }
            />
          </form>
        </div>

        <ConfirmDialog
          open={confirmSave}
          title="¿Guardar como main.py en la Pico?"
          confirmLabel="Sí, guardar"
          variant="primary"
          icon="save"
          loading={app.busy}
          onCancel={() => setConfirmSave(false)}
          onConfirm={() => {
            setConfirmSave(false);
            void app.saveCode(value);
          }}
        >
          <strong>main.py</strong> es el programa que la Pico ejecuta sola cada
          vez que recibe energía. Guardar aquí reemplaza al que tenga ahora. Si
          ya instalaste la estación de tu planta, tendrás que instalarla de
          nuevo después.
        </ConfirmDialog>
        <ConfirmDialog
          open={confirmRestore}
          title="¿Volver al código original?"
          confirmLabel="Restaurar"
          variant="primary"
          icon="undo"
          onCancel={() => setConfirmRestore(false)}
          onConfirm={() => {
            setConfirmRestore(false);
            change(original);
            app.notify("Código original restaurado.");
          }}
        >
          Se reemplaza lo que escribiste en esta actividad por el ejemplo
          inicial. Si quieres conservar tu versión, descárgala primero.
        </ConfirmDialog>
      </div>
    );
  },
);
