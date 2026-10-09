import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Icon } from "./brand/Graphics";
import { normalizeProgress } from "./content";
import { api, post, type Reading, type Session } from "./lib/api";
import { arduinoStationSketch } from "./lib/arduino";
import {
  AppContext,
  type AppContextType,
  type Board,
  type Health,
  type ToastTone,
} from "./lib/context";
import {
  isNetworkError,
  mergeSessionPatch,
  offline as offlineStore,
} from "./lib/offline";
import { ArduinoSerial, serial, stationCaFile } from "./lib/serial";
import {
  applyTheme,
  readLocal,
  readThemePref,
  watchSystemTheme,
  writeLocal,
  type ThemePref,
} from "./lib/theme";
import Home from "./pages/Home";
import { Onboarding } from "./shell/Onboarding";
import { NAV, Sidebar, isActive } from "./shell/Sidebar";
import { Topbar } from "./shell/Topbar";
import { PageLoader } from "./ui/Feedback";
import { ToastHost, type ToastItem } from "./ui/Overlay";
import { cx } from "./ui/cx";

const Lesson = lazy(() => import("./pages/Lesson"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Lab = lazy(() => import("./pages/Lab"));
const Station = lazy(() => import("./pages/Settings"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Teacher = lazy(() => import("./pages/Teacher"));

/** Direcciones de la versión anterior que siguen funcionando. */
const ALIASES: Record<string, string> = {
  "/dashboard": "/planta",
  "/laboratorio": "/explora",
  "/configuracion": "/estacion",
};
const canonical = (path: string) => ALIASES[path] ?? path;

const BOARDS: Board[] = ["pico", "uno", "nano", "nano-old"];

export default function App() {
  const [route, setRoute] = useState(() => canonical(location.pathname));
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [offline, setOffline] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [board, setBoardState] = useState<Board>(() => {
    const stored = readLocal<Board>("raices.board", "pico");
    return BOARDS.includes(stored) ? stored : "pico";
  });
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const [terminal, setTerminal] = useState("");
  const [localReadings, setLocalReadings] = useState<Reading[]>([]);
  const [lastDiagnostics, setLastDiagnostics] = useState<
    Record<string, unknown>
  >({});
  const [onboarding, setOnboarding] = useState(false);
  const onboardingDestination = useRef("/taller/welcome");
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [drawer, setDrawer] = useState(false);
  const [collapsed, setCollapsed] = useState(() =>
    readLocal("raices.sidebar", false),
  );
  const [theme, setThemeState] = useState<ThemePref>(readThemePref);
  const [guided, setGuidedState] = useState(() =>
    readLocal("raices.guided", true),
  );

  const boardRef = useRef(board);
  boardRef.current = board;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const sessionUpdates = useRef<Promise<void>>(Promise.resolve());
  const recoveryPending = useRef(false);
  const usbBusy = useRef(false);
  const usbConnecting = useRef(false);
  const usbGeneration = useRef(0);
  const stream = useRef("");
  const pendingUSB = useRef(new Map<string, Reading>());
  const pendingDiagnostics = useRef<Record<string, unknown>>({});
  const lastForward = useRef(0);
  const stationCredential = useRef<{ deviceId: string; token: string } | null>(
    null,
  );
  const toastId = useRef(0);
  const drawerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!drawer) return;
    const element = drawerRef.current,
      previous = document.activeElement as HTMLElement | null;
    const oldOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    (
      element?.querySelector<HTMLElement>('button[aria-current="page"]') ||
      element?.querySelector<HTMLElement>("button")
    )?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setDrawer(false);
        return;
      }
      if (event.key !== "Tab" || !element) return;
      const items = [
        ...element.querySelectorAll<HTMLElement>(
          'button:not(:disabled),a[href],select,input,[tabindex="0"]',
        ),
      ].filter((item) => item.getClientRects().length);
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1)?.focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0]?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.documentElement.style.overflow = oldOverflow;
      previous?.focus();
    };
  }, [drawer]);

  /* ── Avisos ─────────────────────────────────────────────────── */
  const dismiss = useCallback(
    (id: number) =>
      setToasts((list) => list.filter((toast) => toast.id !== id)),
    [],
  );
  const notify = useCallback(
    (message: string, tone: ToastTone | boolean = "success") => {
      const resolved: ToastTone =
        tone === true ? "error" : tone === false ? "success" : tone;
      const id = ++toastId.current;
      setToasts((list) => [...list.slice(-2), { id, message, tone: resolved }]);
      setTimeout(() => dismiss(id), resolved === "error" ? 9000 : 5000);
    },
    [dismiss],
  );

  /* ── Navegación ─────────────────────────────────────────────── */
  const navigate = useCallback((path: string) => {
    const target = canonical(path.split("#")[0].split("?")[0]);
    const suffix = path.slice(path.split("#")[0].split("?")[0].length);
    history.pushState(null, "", target + suffix);
    setRoute(target);
    setDrawer(false);
    window.scrollTo({ top: 0 });
  }, []);
  useEffect(() => {
    const pop = () => setRoute(canonical(location.pathname));
    window.addEventListener("popstate", pop);
    return () => window.removeEventListener("popstate", pop);
  }, []);

  /* ── Tema y preferencias ────────────────────────────────────── */
  useEffect(() => {
    applyTheme(theme);
    return watchSystemTheme(() => applyTheme(theme));
  }, [theme]);
  const setTheme = useCallback((value: ThemePref) => setThemeState(value), []);
  const setGuided = useCallback((value: boolean) => {
    setGuidedState(value);
    writeLocal("raices.guided", value);
  }, []);

  /* ── Sesión ─────────────────────────────────────────────────── */
  const adopt = useCallback((next: Session) => {
    const clean = { ...next, progress: normalizeProgress(next.progress) };
    sessionRef.current = clean;
    setSession(clean);
    offlineStore.remember(clean);
    return clean;
  }, []);
  const refreshSession = useCallback(async () => {
    const operation = sessionUpdates.current
      .catch(() => {})
      .then(async () => {
        try {
          let result = await api<{ session: Session }>("/session");
          const pending = offlineStore.pending();
          if (pending?.id === result.session.id) {
            result = await api<{ session: Session }>("/session", {
              method: "PATCH",
              body: JSON.stringify(pending.patch),
            });
            offlineStore.synced(pending.revision);
          }
          const remaining = offlineStore.pending();
          adopt(
            remaining?.id === result.session.id
              ? (mergeSessionPatch(result.session, remaining.patch) as Session)
              : result.session,
          );
          setOffline(false);
        } catch (problem) {
          const cached = offlineStore.session();
          if (isNetworkError(problem) && cached) {
            sessionRef.current = cached;
            setSession(cached);
            setOffline(true);
          } else {
            sessionRef.current = null;
            setSession(null);
            setOffline(false);
            if (!isNetworkError(problem)) offlineStore.forget();
          }
        } finally {
          setReady(true);
        }
      });
    sessionUpdates.current = operation;
    return operation;
  }, [adopt]);
  useEffect(() => {
    void refreshSession();
    void api<Health>("/health")
      .then(setHealth)
      .catch(() => setHealth(null));
    const online = () => void refreshSession();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [refreshSession]);

  // El servidor puede volver sin que cambie la conexión de red del navegador.
  useEffect(() => {
    if (!offline) return;
    const retry = () => {
      if (!navigator.onLine || document.visibilityState === "hidden" || recoveryPending.current)
        return;
      recoveryPending.current = true;
      void refreshSession().finally(() => { recoveryPending.current = false; });
      void api<Health>("/health").then(setHealth).catch(() => {});
    };
    const timer = setInterval(retry, 5000);
    window.addEventListener("focus", retry);
    document.addEventListener("visibilitychange", retry);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", retry);
      document.removeEventListener("visibilitychange", retry);
    };
  }, [offline, refreshSession]);

  const updateSession = useCallback(
    (patch: Partial<Session>) => {
      const requestedId = sessionRef.current?.id;
      const operation = sessionUpdates.current
        .catch(() => {})
        .then(async () => {
          const current = sessionRef.current;
          if (!current || current.id !== requestedId) return;
          const pending = offlineStore.pending();
          const combined = mergeSessionPatch(
            pending?.id === current.id ? pending.patch : {},
            patch,
          );
          try {
            const result = await api<{ session: Session }>("/session", {
              method: "PATCH",
              body: JSON.stringify(combined),
            });
            offlineStore.synced(pending?.revision);
            const remaining = offlineStore.pending();
            adopt(
              remaining?.id === result.session.id
                ? (mergeSessionPatch(
                    result.session,
                    remaining.patch,
                  ) as Session)
                : result.session,
            );
            setOffline(false);
          } catch (problem) {
            if (!isNetworkError(problem)) throw problem;
            // Sin red: el cambio queda en este navegador y se sincroniza al volver.
            const remaining = offlineStore.pending();
            const latestCombined =
              remaining?.id === current.id &&
              remaining.revision !== pending?.revision
                ? mergeSessionPatch(combined, remaining.patch)
                : combined;
            const local = mergeSessionPatch(current, latestCombined) as Session;
            sessionRef.current = local;
            setSession(local);
            offlineStore.remember(local);
            offlineStore.queue(current.id, latestCombined);
            setOffline(true);
          }
        });
      sessionUpdates.current = operation;
      return operation;
    },
    [adopt],
  );
  const createSession = useCallback(
    async (name: string, groupNumber: number) => {
      const result = await post<{ session: Session }>("/session", {
        name: name.trim() || undefined,
        groupNumber,
      });
      adopt(result.session);
      setOnboarding(false);
      navigate(onboardingDestination.current);
    },
    [adopt, navigate],
  );

  /* ── USB: salida de la placa y puente hacia el servidor ─────── */
  useEffect(() => {
    // La Pico publica sola cuando tiene Wi-Fi y TLS verificado: ahí no se reenvía por USB.
    const publishesAlone = (diagnostics: Record<string, unknown> | undefined) =>
      Boolean(
        diagnostics &&
        diagnostics.tlsVerified === true &&
        !diagnostics.cloudError &&
        typeof diagnostics.ip === "string" &&
        diagnostics.ip !== "0.0.0.0" &&
        (diagnostics.net === "ONLINE" ||
          diagnostics.wifi === "Conectado (2.4 GHz)"),
      );
    const forward = () => {
      if (
        !sessionRef.current ||
        !pendingUSB.current.size ||
        Date.now() - lastForward.current < 4500
      )
        return;
      const readings = [...pendingUSB.current.values()];
      pendingUSB.current.clear();
      lastForward.current = Date.now();
      void api("/bridge/ingest", {
        method: "POST",
        body: JSON.stringify({
          readings,
          diagnostics: pendingDiagnostics.current,
        }),
      }).catch(() => {
        /* El USB sigue mostrando lecturas aunque el servidor no las reciba. */
      });
    };
    const output = (text: string) => {
      setTerminal((previous) => (previous + text).slice(-60000));
      stream.current += text;
      const lines = stream.current.split("\n");
      stream.current = lines.pop()?.slice(-15000) ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("{")) continue;
        try {
          const data = JSON.parse(trimmed) as {
            sensor?: string;
            value?: unknown;
            readings?: Reading[];
            diagnostics?: Record<string, unknown>;
          };
          // Una lectura suelta ({"sensor":…,"value":…}) se trata como un lote de una.
          const batch: Reading[] | undefined = Array.isArray(data.readings)
            ? data.readings
            : data.sensor && "value" in data
              ? [data as unknown as Reading]
              : undefined;
          if (data.diagnostics) setLastDiagnostics(data.diagnostics);
          if (!batch?.length) continue;
          const stamped = batch
            .filter((reading) => typeof reading?.sensor === "string")
            .map((reading) => ({
              ...reading,
              source: "hardware",
              timestamp: new Date().toISOString(),
            }));
          setLocalReadings((previous) => [
            ...previous.filter(
              (reading) =>
                !stamped.some((fresh) => fresh.sensor === reading.sensor),
            ),
            ...stamped,
          ]);
          if (publishesAlone(data.diagnostics)) pendingUSB.current.clear();
          else {
            for (const reading of batch) {
              if (typeof reading?.sensor !== "string") continue;
              const { sensor, value, unit, status, raw, confidence, error } =
                reading;
              pendingUSB.current.set(sensor, {
                sensor,
                value,
                unit,
                status,
                ...(raw !== undefined ? { raw } : {}),
                ...(confidence ? { confidence } : {}),
                ...(error ? { error } : {}),
              });
            }
            pendingDiagnostics.current = data.diagnostics ?? {};
          }
        } catch {
          /* Texto normal del programa: se queda en la terminal. */
        }
      }
      forward();
    };
    const lost = (name: string) => () => {
      usbGeneration.current += 1;
      pendingUSB.current.clear();
      setConnected(false);
      setRunning(false);
      notify(
        `${name} desconectada. Puedes volver a conectarla y seguir.`,
        "info",
      );
    };
    serial.onOutput = output;
    ArduinoSerial.onOutput = output;
    serial.onDisconnect = lost("Pico");
    ArduinoSerial.onDisconnect = lost("Placa Arduino");
    serial.onRunEnd = () => setRunning(false);
    const flush = setInterval(forward, 1000);
    return () => {
      clearInterval(flush);
      serial.onOutput = () => {};
      ArduinoSerial.onOutput = () => {};
      serial.onDisconnect = () => {};
      ArduinoSerial.onDisconnect = () => {};
      serial.onRunEnd = () => {};
    };
  }, [notify]);

  useEffect(() => {
    pendingUSB.current.clear();
    lastForward.current = 0;
    setLocalReadings([]);
  }, [session?.id]);
  useEffect(() => {
    stationCredential.current = null;
  }, [session?.id]);

  /* ── Acciones de placa ──────────────────────────────────────── */
  const guard = useCallback(
    async (work: () => Promise<void>) => {
      if (usbBusy.current || usbConnecting.current) {
        notify("Espera a que termine la operación de la placa antes de continuar.", "info");
        return;
      }
      usbBusy.current = true;
      setBusy(true);
      try {
        await work();
      } catch (problem) {
        notify(
          problem instanceof Error ? problem.message : String(problem),
          "error",
        );
      } finally {
        usbBusy.current = false;
        setBusy(false);
      }
    },
    [notify],
  );
  const connect = useCallback(async () => {
    if (usbConnecting.current || usbBusy.current) return;
    if (!sessionRef.current) {
      onboardingDestination.current = canonical(location.pathname);
      setOnboarding(true);
      return;
    }
    usbConnecting.current = true;
    setConnecting(true);
    const generation = ++usbGeneration.current;
    try {
      const current = boardRef.current;
      if (current === "pico") await serial.connect();
      else await ArduinoSerial.connect(current);
      if (generation !== usbGeneration.current) {
        if (current === "pico") await serial.disconnect();
        else await ArduinoSerial.disconnect();
        return;
      }
      setConnected(true);
      try {
        await post("/bridge/connect", {});
      } catch {
        notify(
          "USB disponible en modo local; el servidor no pudo vincular el puente.",
          "info",
        );
      }
      notify("Placa conectada por USB. Ya puedes ejecutar código.");
    } catch (problem) {
      // Cerrar el selector de puertos sin elegir no es un error que haya que anunciar.
      const cancelled =
        problem instanceof DOMException && problem.name === "NotFoundError";
      if (!cancelled)
        notify(
          problem instanceof DOMException && problem.name === "NetworkError"
            ? "El puerto está ocupado por otro programa (¿Thonny o el IDE de Arduino?). Ciérralo e inténtalo otra vez."
            : problem instanceof Error
              ? problem.message
              : "No se pudo abrir el puerto USB.",
          "error",
        );
    } finally {
      usbConnecting.current = false;
      setConnecting(false);
    }
  }, [notify]);
  const disconnect = useCallback(async () => {
    usbGeneration.current += 1;
    try {
      pendingUSB.current.clear();
      if (boardRef.current === "pico") await serial.disconnect();
      else await ArduinoSerial.disconnect();
    } catch (problem) {
      notify(
        problem instanceof Error ? problem.message : String(problem),
        "error",
      );
    } finally {
      setConnected(false);
      setRunning(false);
    }
  }, [notify]);
  const setBoard = useCallback(
    (value: Board) => {
      if (connected || usbConnecting.current || usbBusy.current) {
        notify("Termina la operación y desconecta la placa antes de cambiar de modelo.", "info");
        return;
      }
      usbGeneration.current += 1;
      setBoardState(value);
      writeLocal("raices.board", value);
      setLocalReadings([]);
    },
    [connected, notify],
  );
  const compileAndUpload = useCallback(async (code: string, target: Board) => {
    const generation = usbGeneration.current;
    const result = await post<{ hex: string; output: string }>(
      "/arduino/compile",
      {
        code,
        board: target,
      },
    );
    if (generation !== usbGeneration.current || target !== boardRef.current || !ArduinoSerial.connected)
      throw new Error("La conexión cambió durante la compilación. Conecta la placa y vuelve a ejecutar.");
    setTerminal((previous) => `${previous}\n${result.output}\n`);
    await ArduinoSerial.upload(result.hex);
  }, []);
  const runCode = useCallback(
    (code: string, lessonId?: string) =>
      guard(async () => {
        if (!connected)
          throw new Error("Conecta tu placa por USB antes de ejecutar.");
        const current = boardRef.current;
        if (current === "pico") {
          setRunning(true);
          try {
            await serial.run(code);
          } catch (problem) {
            setRunning(false);
            throw problem;
          }
        } else {
          await compileAndUpload(code, current);
          notify("Programa compilado y cargado en la placa.");
        }
        if (lessonId)
          // Último programa ejecutado del grupo. No interrumpe si el servidor no responde.
          void updateSession({
            lastRun: {
              lessonId,
              board: current,
              code,
              at: new Date().toISOString(),
            },
          } as Partial<Session>).catch(() => {});
      }),
    [compileAndUpload, connected, guard, notify, updateSession],
  );
  const stopCode = useCallback(
    () =>
      guard(async () => {
        const current = boardRef.current;
        if (current === "pico") {
          await serial.stop();
          setRunning(false);
          notify("Programa detenido.");
        } else {
          // Arduino no se «detiene»: se carga un programa que deja los pines en reposo.
          const idle =
            'void setup(){for(byte p=2;p<=13;p++){digitalWrite(p,LOW);pinMode(p,INPUT);}Serial.begin(115200);Serial.println("Programa detenido. Pines en alta impedancia.");}void loop(){}';
          await compileAndUpload(idle, current);
          notify("Programa detenido: la placa quedó en reposo.");
        }
      }),
    [compileAndUpload, guard, notify],
  );
  const saveCode = useCallback(
    (code: string) =>
      guard(async () => {
        if (!connected) throw new Error("Conecta tu placa antes de guardar.");
        const current = boardRef.current;
        if (current === "pico") {
          await serial.saveFile("main.py", code);
          setRunning(false);
          notify(
            "Guardado como main.py. Se ejecutará sola cada vez que la Pico reciba energía.",
          );
        } else {
          await compileAndUpload(code, current);
          notify("Programa cargado: queda grabado en la placa.");
        }
      }),
    [compileAndUpload, connected, guard, notify],
  );
  const installStation = useCallback(
    (ssid: string, password: string, endpoint: string) =>
      guard(async () => {
        const current = boardRef.current;
        const active = sessionRef.current;
        if (!connected) throw new Error("Conecta tu placa por USB.");
        if (current !== "pico") {
          await compileAndUpload(
            arduinoStationSketch(
              active?.calibrations ?? {},
              active?.sensorEnabled ?? {},
            ),
            current,
          );
          notify(
            "Estación cargada. Mantén esta pestaña abierta: los datos viajan por USB.",
          );
          return;
        }
        const caFile = stationCaFile(endpoint);
        let device = stationCredential.current;
        if (!device) {
          const pairing = await post<{ code: string; expiresAt: string }>(
            "/pair",
            {},
          );
          device = await post<{ deviceId: string; token: string }>(
            "/device/pair",
            { code: pairing.code },
          );
          stationCredential.current = device;
        }
        const bundle = await api<{ files: Record<string, string> }>(
          "/firmware",
        );
        const now = new Date();
        bundle.files["config.json"] = JSON.stringify({
          ssid,
          password,
          endpoint,
          caFile,
          deviceId: device.deviceId,
          token: device.token,
          calibrations: active?.calibrations ?? {},
          enabled: active?.sensorEnabled ?? {},
          rtc: [
            now.getUTCFullYear(),
            now.getUTCMonth() + 1,
            now.getUTCDate(),
            now.getUTCHours(),
            now.getUTCMinutes(),
            now.getUTCSeconds(),
          ],
        });
        await serial.install(bundle.files);
        setRunning(true);
        try {
          await serial.run("exec(open('main.py').read())");
        } catch (problem) {
          setRunning(false);
          throw problem;
        }
        notify(
          "Estación instalada. Mira la terminal: verás el Wi-Fi y las primeras lecturas.",
        );
      }),
    [compileAndUpload, connected, guard, notify],
  );
  const revokeDevice = useCallback(
    async (deviceId: string) => {
      await post("/device/revoke", { deviceId });
      if (stationCredential.current?.deviceId === deviceId)
        stationCredential.current = null;
      notify("Dispositivo revocado: ya no puede enviar datos.");
    },
    [notify],
  );
  const sendSerial = useCallback(async (text: string) => {
    if (boardRef.current === "pico") await serial.write(text);
    else await ArduinoSerial.write(text);
  }, []);
  const queryPico = useCallback(async (code: string) => {
    if (usbBusy.current || usbConnecting.current)
      throw new Error("Espera a que termine la operación USB antes de consultar la placa.");
    if (boardRef.current !== "pico" || !serial.connected)
      throw new Error("Esta consulta requiere una Pico conectada por USB.");
    const generation = usbGeneration.current;
    usbBusy.current = true;
    setBusy(true);
    setRunning(false);
    try {
      const output = await serial.exec(code);
      if (generation !== usbGeneration.current)
        throw new Error("La placa se desconectó durante la consulta. Repite la captura.");
      return output;
    } finally {
      usbBusy.current = false;
      setBusy(false);
    }
  }, []);
  const clearTerminal = useCallback(() => setTerminal(""), []);
  const openOnboarding = useCallback((destination = "/taller/welcome") => {
    onboardingDestination.current =
      typeof destination === "string" &&
      destination.startsWith("/") &&
      !destination.startsWith("//")
        ? destination
        : "/taller/welcome";
    setOnboarding(true);
  }, []);

  const context = useMemo<AppContextType>(
    () => ({
      session,
      ready,
      offline,
      createSession,
      updateSession,
      refreshSession,
      openOnboarding,
      route,
      navigate,
      notify,
      board,
      setBoard,
      serialSupported: serial.supported,
      connected,
      connecting,
      busy,
      running,
      connect,
      disconnect,
      runCode,
      stopCode,
      saveCode,
      terminal,
      clearTerminal,
      sendSerial,
      queryPico,
      localReadings,
      lastDiagnostics,
      installStation,
      revokeDevice,
      health,
      theme,
      setTheme,
      guided,
      setGuided,
    }),
    [
      session,
      ready,
      offline,
      createSession,
      updateSession,
      refreshSession,
      openOnboarding,
      route,
      navigate,
      notify,
      board,
      setBoard,
      connected,
      connecting,
      busy,
      running,
      connect,
      disconnect,
      runCode,
      stopCode,
      saveCode,
      terminal,
      clearTerminal,
      sendSerial,
      queryPico,
      localReadings,
      lastDiagnostics,
      installStation,
      revokeDevice,
      health,
      theme,
      setTheme,
      guided,
      setGuided,
    ],
  );

  const isLesson = route.startsWith("/taller/");
  const page = !ready ? (
    <PageLoader />
  ) : isLesson ? (
    <Lesson />
  ) : route === "/planta" ? (
    <Dashboard />
  ) : route === "/explora" ? (
    <Lab />
  ) : route === "/estacion" ? (
    <Station />
  ) : route === "/diagnostico" ? (
    <Diagnostics />
  ) : route === "/profesor" ? (
    <Teacher />
  ) : (
    <Home />
  );

  const toggleSidebar = () => {
    setCollapsed((value: boolean) => {
      writeLocal("raices.sidebar", !value);
      return !value;
    });
  };

  return (
    <AppContext.Provider value={context}>
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-md focus:bg-action focus:px-4 focus:py-2.5 focus:font-bold focus:text-action-ink"
      >
        Ir al contenido
      </a>
      <div className="flex min-h-dvh">
        <div className="sticky top-0 hidden h-dvh shrink-0 lg:block">
          <Sidebar collapsed={collapsed} onToggle={toggleSidebar} />
        </div>
        {drawer && (
          <div
            className="fixed inset-0 z-[60] lg:hidden"
            role="dialog"
            ref={drawerRef}
            aria-modal="true"
            aria-label="Menú"
          >
            <button
              type="button"
              aria-label="Cerrar menú"
              className="absolute inset-0 bg-overlay"
              onClick={() => setDrawer(false)}
            />
            <div className="relative h-full w-[264px] animate-fade shadow-lifted">
              <Sidebar collapsed={false} onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar onMenu={() => setDrawer(true)} />
          <main
            id="contenido"
            tabIndex={-1}
            className="flex-1 pb-20 outline-none lg:pb-0"
          >
            <Suspense fallback={<PageLoader />}>
              {["/planta", "/estacion", "/diagnostico", "/profesor"].includes(
                route,
              ) ? (
                <div className="legacy-page">{page}</div>
              ) : (
                page
              )}
            </Suspense>
          </main>
        </div>
      </div>

      {/* Barra inferior en pantallas angostas: la pestaña activa se marca completa. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border bg-surface px-1.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
      >
        {NAV.slice(0, 4).map((entry) => {
          const active = isActive(entry, route);
          return (
            <button
              key={entry.path}
              type="button"
              aria-current={active ? "page" : undefined}
              onClick={() => navigate(entry.path)}
              className={cx(
                "pressable focus-ring mx-1 flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-extrabold leading-4",
                active ? "bg-action text-action-ink" : "text-ink-soft",
              )}
            >
              <Icon name={entry.icon} size={21} />
              {entry.label.replace("Zona ", "")}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setDrawer(true)}
          className="pressable focus-ring mx-1 flex min-h-[54px] flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[11px] font-extrabold leading-4 text-ink-soft"
        >
          <Icon name="more" size={21} />
          Más
        </button>
      </nav>

      <Onboarding open={onboarding} onClose={() => setOnboarding(false)} />
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </AppContext.Provider>
  );
}
