import { useState, useEffect, useRef, Suspense, lazy } from "react";
import {
  Sprout,
  LayoutDashboard,
  FlaskConical,
  BookOpen,
  Settings2,
  Stethoscope,
  GraduationCap,
  ArrowUpRight,
  ArrowRight,
  Usb,
  Menu,
  X,
  Wifi,
  ChevronDown,
  Check,
  LogOut,
} from "lucide-react";
import { AppContext, type Board } from "./lib/context";
import { api, post, type Session, type Reading } from "./lib/api";
import { serial, ArduinoSerial } from "./lib/serial";
import { arduinoStationSketch } from "./lib/arduino";
import { offline, isNetworkError } from "./lib/offline";
import { lessons } from "./data/lessons";
import { Brand, Button, Modal, Notice } from "./components/Common";
import Home from "./pages/Home";
const Workshop = lazy(() => import("./pages/Workshop"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Lab = lazy(() => import("./pages/Lab"));
const Settings = lazy(() => import("./pages/Settings"));
const Diagnostics = lazy(() => import("./pages/Diagnostics"));
const Teacher = lazy(() => import("./pages/Teacher"));
export default function App() {
  const [route, setRoute] = useState(location.pathname),
    [session, setSession] = useState<Session | null>(null),
    [ready, setReady] = useState(false),
    [board, setBoardState] = useState<Board>("pico"),
    [connected, setConnected] = useState(false),
    [busy, setBusy] = useState(false),
    [terminal, setTerminal] = useState(""),
    [localReadings, setLocalReadings] = useState<Reading[]>([]),
    [lastDiagnostics, setLastDiagnostics] = useState<Record<string, unknown>>(
      {},
    ),
    [onboarding, setOnboarding] = useState(false),
    [name, setName] = useState(""),
    [groupNumber, setGroup] = useState(1),
    [toast, setToast] = useState<{ message: string; error: boolean } | null>(
      null,
    ),
    [mobileNav, setMobileNav] = useState(false);
  const stream = useRef(""),
    token = useRef<string | null>(null),
    credentials = useRef<{ deviceId: string; token: string } | null>(null),
    lastForward = useRef(0),
    pendingUSB = useRef(new Map<string, Reading>()),
    pendingDiagnostics = useRef<Record<string, unknown>>({}),
    toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    boardRef = useRef(board);
  boardRef.current = board;
  const notify = (message: string, error = false) => {
    setToast({ message, error });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  };
  const navigate = (path: string) => {
    history.pushState(null, "", path);
    setRoute(path);
    setMobileNav(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const refreshSession = async () => {
    try {
      let r = await api<{ session: Session }>("/session");
      const pending = offline.pending();
      if (pending?.id === r.session.id) {
        r = await api<{ session: Session }>("/session", {
          method: "PATCH",
          body: JSON.stringify(pending.patch),
        });
        offline.synced();
      }
      setSession(r.session);
      offline.remember(r.session);
    } catch (e) {
      const cached = offline.session();
      if (isNetworkError(e) && cached) {
        setSession(cached);
        notify(
          "Modo local: tus borradores y USB siguen disponibles. Se sincronizarán al reconectar.",
        );
      } else {
        setSession(null);
        offline.forget();
      }
    } finally {
      setReady(true);
    }
  };
  useEffect(() => {
    void refreshSession();
    const pop = () => setRoute(location.pathname);
    window.addEventListener("popstate", pop);
    const online = () => void refreshSession();
    window.addEventListener("online", online);
    return () => {
      window.removeEventListener("popstate", pop);
      window.removeEventListener("online", online);
    };
  }, []);
  useEffect(() => {
    const forwardUSB = () => {
      if (
        !token.current ||
        !pendingUSB.current.size ||
        Date.now() - lastForward.current < 4500
      )
        return;
      const readings = [...pendingUSB.current.values()];
      pendingUSB.current.clear();
      lastForward.current = Date.now();
      void fetch("/api/device/ingest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token.current}`,
        },
        body: JSON.stringify({
          readings,
          source: "hardware",
          diagnostics: pendingDiagnostics.current,
        }),
        signal: AbortSignal.timeout(10000),
      })
        .then((response) => {
          if (!response.ok)
            notify(
              "La lectura USB continúa; no se pudo guardar en el servidor.",
              true,
            );
        })
        .catch(() => {});
    };
    const output = (text: string) => {
      setTerminal((t) => (t + text).slice(-60000));
      stream.current += text;
      const lines = stream.current.split("\n");
      stream.current = lines.pop()?.slice(-15000) || "";
      for (const line of lines) {
        try {
          const data = JSON.parse(line.trim());
          if (data.sensor && "value" in data) {
            // Copy the scalar before attaching a batch: using the same object
            // would create a cycle and prevent JSON telemetry serialization.
            const { readings, diagnostics, ...reading } = data;
            data.readings = [reading];
          }
          if (data.readings && Array.isArray(data.readings)) {
            setLocalReadings((prev) => [
              ...prev.filter(
                (r) =>
                  !data.readings.some((x: Reading) => x.sensor === r.sensor),
              ),
              ...data.readings.map((r: Reading) => ({
                ...r,
                source: "hardware",
                timestamp: new Date().toISOString(),
              })),
            ]);
            if (data.diagnostics) setLastDiagnostics(data.diagnostics);
            if (
              data.diagnostics?.tlsVerified === true &&
              !data.diagnostics?.cloudError &&
              data.diagnostics?.wifi === "Conectado (2.4 GHz)" &&
              data.diagnostics?.ip
            ) {
              pendingUSB.current.clear();
            } else if (token.current) {
              for (const reading of data.readings as Reading[])
                pendingUSB.current.set(reading.sensor, reading);
              pendingDiagnostics.current = data.diagnostics || {};
            }
          }
          if (data.diagnostics) setLastDiagnostics(data.diagnostics);
        } catch {
          /* Plain serial output stays in terminal. */
        }
      }
      forwardUSB();
    };
    serial.onOutput = output;
    ArduinoSerial.onOutput = output;
    serial.onDisconnect = () => {
      pendingUSB.current.clear();
      setConnected(false);
      notify("Pico desconectada. Puedes reconectar y continuar.", true);
    };
    ArduinoSerial.onDisconnect = () => {
      pendingUSB.current.clear();
      setConnected(false);
      notify("Arduino desconectado.", true);
    };
    const flush = setInterval(forwardUSB, 1000);
    return () => {
      clearInterval(flush);
      serial.onOutput = () => {};
      ArduinoSerial.onOutput = () => {};
    };
  }, []);
  useEffect(() => {
    token.current = null;
    credentials.current = null;
    pendingUSB.current.clear();
    lastForward.current = 0;
    setLocalReadings([]);
  }, [session?.id]);
  const updateSession = async (patch: Partial<Session>) => {
    if (!session) return;
    try {
      const result = await api<{ session: Session }>("/session", {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      setSession(result.session);
      offline.remember(result.session);
    } catch (e) {
      if (!isNetworkError(e)) throw e;
      const local = { ...session, ...patch };
      setSession(local);
      offline.remember(local);
      offline.queue(session.id, patch);
    }
  };
  const createSession = async (n: string, g: number) => {
    token.current = null;
    credentials.current = null;
    setLocalReadings([]);
    const r = await post<{ session: Session }>("/session", {
      name: n.trim() || undefined,
      groupNumber: g,
    });
    setSession(r.session);
    offline.remember(r.session);
    setOnboarding(false);
    navigate("/taller/welcome");
  };
  const pair = async (force = false) => {
    if (force) {
      credentials.current = null;
      token.current = null;
    }
    if (credentials.current) return credentials.current;
    const p = await post<{ code: string; expiresAt: string }>("/pair", {});
    const d = await post<{ deviceId: string; token: string }>("/device/pair", {
      code: p.code,
    });
    token.current = d.token;
    credentials.current = d;
    return d;
  };
  const connect = async () => {
    if (!session) {
      setOnboarding(true);
      return;
    }
    try {
      if (board === "pico") await serial.connect();
      else
        await ArduinoSerial.connect(
          board === "uno" ? "uno" : board === "nano-old" ? "nano-old" : "nano",
        );
      setConnected(true);
      try {
        await pair();
      } catch {
        notify(
          "USB conectado. El almacenamiento cloud necesita conexión al servidor.",
          true,
        );
      }
      notify("USB conectado. Tu placa está lista.");
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const disconnect = async () => {
    try {
      pendingUSB.current.clear();
      if (board === "pico") await serial.disconnect();
      else await ArduinoSerial.disconnect();
      setConnected(false);
    } catch (e) {
      notify((e as Error).message, true);
    }
  };
  const revokeDevice = async (deviceId: string) => {
    await post("/device/revoke", { deviceId });
    if (credentials.current?.deviceId === deviceId) {
      credentials.current = null;
      token.current = null;
      pendingUSB.current.clear();
    }
    notify("Token revocado. El dispositivo ya no puede enviar datos.");
  };
  const setBoard = (value: Board) => {
    if (connected) {
      notify("Desconecta USB antes de cambiar de placa.", true);
      return;
    }
    setBoardState(value);
    setLocalReadings([]);
  };
  const action = async (work: () => Promise<void>) => {
    setBusy(true);
    try {
      await work();
    } catch (e) {
      notify((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };
  const runCode = async (code: string) =>
    action(async () => {
      if (!connected)
        throw new Error("Conecta tu placa USB antes de ejecutar.");
      if (board === "pico") {
        await serial.run(code);
        notify("Código enviado a la Pico. Observa el resultado y la terminal.");
      } else {
        const r = await post<{ hex: string; output: string }>(
          "/arduino/compile",
          { code, board },
        );
        setTerminal((t) => t + "\n" + r.output + "\n");
        await ArduinoSerial.upload(r.hex);
        notify("Programa compilado y cargado en Arduino.");
      }
    });
  const stopCode = async () =>
    action(async () => {
      if (board === "pico") {
        await serial.stop();
        notify("Programa detenido.");
      } else {
        const idle =
          'void setup(){for(byte p=2;p<=13;p++){digitalWrite(p,LOW);pinMode(p,INPUT);}Serial.begin(115200);Serial.println("Programa detenido. Pines en alta impedancia.");}void loop(){}';
        const result = await post<{ hex: string; output: string }>(
          "/arduino/compile",
          { code: idle, board },
        );
        await ArduinoSerial.upload(result.hex);
        notify("Programa detenido: se cargó un sketch de reposo seguro.");
      }
    });
  const saveCode = async (code: string) =>
    action(async () => {
      if (!connected) throw new Error("Conecta tu placa antes de guardar.");
      if (board === "pico") {
        await serial.saveFile("main.py", code);
        notify("main.py guardado en Pico. Se ejecutará al reiniciar.");
      } else await runCode(code);
    });
  const installStation = async (
    ssid: string,
    password: string,
    endpoint: string,
  ) =>
    action(async () => {
      if (board !== "pico") {
        await runCode(
          arduinoStationSketch(
            session?.calibrations || {},
            session?.sensorEnabled || {},
          ),
        );
        return;
      }
      if (!connected) throw new Error("Conecta tu Pico W por USB.");
      const d = await pair();
      const bundle = await api<{ files: Record<string, string> }>("/firmware");
      const now = new Date();
      bundle.files["config.json"] = JSON.stringify({
        ssid,
        password,
        endpoint,
        deviceId: d.deviceId,
        token: d.token,
        calibrations: session?.calibrations || {},
        enabled: session?.sensorEnabled || {},
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
      await serial.run("exec(open('main.py').read())");
      notify(
        "Estación instalada. Comprueba Wi-Fi y telemetría en la terminal.",
      );
    });
  const nav = [
    { path: "/", label: "Mi taller", Icon: Sprout },
    { path: "/dashboard", label: "Mi planta", Icon: LayoutDashboard },
    { path: "/laboratorio", label: "Laboratorio libre", Icon: FlaskConical },
  ];
  const core = lessons.filter((l) =>
    ["welcome", "led", "blink", "sensors", "calibration", "cloud"].includes(
      l.id,
    ),
  );
  const progress = Math.round(
    ((session?.progress.filter((x) => core.some((c) => c.id === x)).length ||
      0) /
      6) *
      100,
  );
  const context = {
    session,
    ready,
    route,
    navigate,
    notify,
    createSession,
    updateSession,
    board,
    setBoard,
    connected,
    busy,
    connect,
    disconnect,
    runCode,
    stopCode,
    saveCode,
    terminal,
    clearTerminal: () => setTerminal(""),
    localReadings,
    lastDiagnostics,
    sendSerial: async (text: string) => {
      if (board === "pico") await serial.write(text);
      else await ArduinoSerial.write(text);
    },
    installStation,
    revokeDevice,
    openOnboarding: () => setOnboarding(true),
    refreshSession,
  };
  let page = route.startsWith("/taller/") ? (
    <Workshop />
  ) : route === "/dashboard" ? (
    <Dashboard />
  ) : route === "/laboratorio" ? (
    <Lab />
  ) : route === "/configuracion" ? (
    <Settings />
  ) : route === "/diagnostico" ? (
    <Diagnostics />
  ) : route === "/profesor" ? (
    <Teacher />
  ) : (
    <Home />
  );
  if (!ready) page = <div className="loading-page">Preparando tu espacio…</div>;
  return (
    <AppContext.Provider value={context}>
      <a className="skip-link" href="#main">
        Ir al contenido
      </a>
      <div className="app-shell">
        <aside className={`sidebar ${mobileNav ? "open" : ""}`}>
          <button
            className="brand-link"
            onClick={() => navigate("/")}
            aria-label="Raíces Digitales, inicio"
          >
            <Brand />
          </button>
          <div className="workshop-label">
            TALLER IoT <span>2.0</span>
          </div>
          <nav aria-label="Navegación principal">
            {nav.map(({ path, label, Icon }) => (
              <button
                key={path}
                className={`nav-item ${route === path || (path === "/" && route.startsWith("/taller/")) ? "active" : ""}`}
                onClick={() => navigate(path)}
              >
                <Icon size={18} />
                {label}
                {path === "/laboratorio" && (
                  <span className="tiny-label">EXPLORA</span>
                )}
              </button>
            ))}
          </nav>
          <div className="sidebar-rule" />
          <div className="sidebar-section-title">
            TU RECORRIDO <span>60 MIN</span>
          </div>
          <nav className="journey-nav" aria-label="Etapas del taller">
            {core.map((l, i) => (
              <button
                key={l.id}
                className={`journey-link ${route === `/taller/${l.id}` ? "selected" : ""}`}
                onClick={() =>
                  session ? navigate(`/taller/${l.id}`) : setOnboarding(true)
                }
              >
                <span
                  className={`journey-number ${session?.progress.includes(l.id) ? "done" : ""}`}
                >
                  {session?.progress.includes(l.id) ? (
                    <Check size={12} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>{l.title}</span>
              </button>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="plant-progress">
              <div>
                <Sprout size={18} />
                <span>
                  {session
                    ? "Tu idea está creciendo"
                    : "De una idea a una planta"}
                </span>
              </div>
              <div className="progress-track">
                <div style={{ width: `${progress}%` }} />
              </div>
              <small>
                {session
                  ? `${progress}% del recorrido completado`
                  : "Aprende. Conecta. Cultiva."}
              </small>
            </div>
            <button
              className={`nav-item ${route === "/diagnostico" ? "active" : ""}`}
              onClick={() => navigate("/diagnostico")}
            >
              <Stethoscope size={17} />
              Diagnóstico
            </button>
            <button
              className={`nav-item ${route === "/profesor" ? "active" : ""}`}
              onClick={() => navigate("/profesor")}
            >
              <GraduationCap size={17} />
              Espacio docente
            </button>
            <a
              href="https://telematica.usm.cl/"
              target="_blank"
              rel="noreferrer"
              className="institution"
            >
              <span className="institution-symbol">USM</span>
              <span>
                Ingeniería Civil
                <br />
                <strong>Telemática</strong>
              </span>
              <ArrowUpRight size={13} />
            </a>
          </div>
        </aside>
        <div className="main-column">
          <header className="topbar">
            <button
              className="icon-button mobile-menu"
              aria-label="Abrir menú"
              onClick={() => setMobileNav(!mobileNav)}
            >
              {mobileNav ? <X size={20} /> : <Menu size={20} />}
            </button>
            <div className="breadcrumb">
              Taller IoT 2.0 <span>/</span>
              <strong>
                {route.startsWith("/taller")
                  ? "Aprende haciendo"
                  : route === "/dashboard"
                    ? "Tu estación"
                    : route === "/laboratorio"
                      ? "Explora"
                      : route === "/profesor"
                        ? "Docencia"
                        : "Raíces Digitales"}
              </strong>
            </div>
            <div className="topbar-actions">
              <span
                className={`connection-status ${connected ? "online" : ""}`}
              >
                <span />
                {connected ? "USB conectado" : "Sin placa conectada"}
              </span>
              <button
                className="usb-button"
                onClick={() => void (connected ? disconnect() : connect())}
              >
                <Usb size={15} />
                {connected ? "Desconectar" : "Conectar USB"}
              </button>
              <button
                className="group-avatar"
                onClick={() =>
                  session ? navigate("/configuracion") : setOnboarding(true)
                }
                title={session?.name || "Crear grupo"}
              >
                {session ? (
                  String(session.groupNumber).padStart(2, "0")
                ) : (
                  <Sprout size={19} />
                )}
              </button>
            </div>
          </header>
          <main id="main">
            <Suspense
              fallback={
                <div className="loading-page">Preparando tu espacio…</div>
              }
            >
              {page}
            </Suspense>
          </main>
          <footer className="footer">
            <span>
              <span className="small-leaf">✳</span> La tecnología también echa
              raíces.
            </span>
            <span>
              Ingeniería Civil Telemática · UTFSM{" "}
              <span className="footer-dot">·</span> Taller IoT 2.0
            </span>
          </footer>
        </div>
      </div>
      {onboarding && (
        <Modal
          title="Una planta. Tu equipo. Una nueva idea."
          onClose={() => setOnboarding(false)}
        >
          <p className="muted">
            Crea el espacio de tu grupo. No necesitas correo ni datos
            personales. El progreso queda guardado en este navegador.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void action(() => createSession(name, groupNumber));
            }}
          >
            <label>
              Nombre del equipo
              <input
                autoFocus
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder="Por ejemplo, Los Clorofilos"
              />
            </label>
            <label>
              Número de estación
              <select
                value={groupNumber}
                onChange={(e) => setGroup(Number(e.target.value))}
              >
                {Array.from({ length: 10 }, (_, i) => (
                  <option key={i} value={i + 1}>
                    Estación {String(i + 1).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </label>
            <Notice>
              Usen un navegador por grupo. Dos equipos pueden trabajar al mismo
              tiempo sin cambiar el código ni los datos del otro.
            </Notice>
            <Button type="submit" loading={busy}>
              Comenzar mi recorrido <ArrowRight size={17} />
            </Button>
          </form>
        </Modal>
      )}
      {toast && (
        <div role="status" className={`toast ${toast.error ? "error" : ""}`}>
          {toast.error ? <X size={17} /> : <Check size={17} />}
          <span>{toast.message}</span>
          <button aria-label="Cerrar aviso" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </AppContext.Provider>
  );
}
