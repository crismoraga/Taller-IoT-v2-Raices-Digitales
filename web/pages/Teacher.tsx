import { useState, useEffect, useRef } from "react";
import {
  GraduationCap,
  LockKeyhole,
  ArrowRight,
  Radio,
  Wifi,
  WifiOff,
  CheckCircle2,
  Eye,
  Send,
  LogOut,
  Download,
} from "lucide-react";
import { useApp } from "../lib/context";
import { Icon } from "../brand/Graphics";
import { essentials, normalizeProgress } from "../content";
import { PageHeader } from "../ui/Layout";
import {
  api,
  ApiError,
  post,
  sensorLabels,
  statusLabels,
  type Session,
  type Device,
  type Reading,
  type Alert,
} from "../lib/api";
import { Button, Notice, Badge, Modal } from "../components/Common";
type Group = {
  id: string;
  name: string;
  groupNumber: number;
  progress: string[] | number;
  devices?: Device[];
  latest?: Reading[];
  lastSeen?: string;
  online?: boolean;
  sensorIssues?: number;
  createdAt?: string;
};
type Detail = {
  session: Session;
  devices: Device[];
  latest: Reading[];
  alerts: Alert[];
};
const expressCount = (progress: Group["progress"]) =>
  Array.isArray(progress)
    ? essentials.filter((lesson) =>
        normalizeProgress(progress).includes(lesson.id),
      ).length
    : Math.max(0, Math.min(essentials.length, Number(progress) || 0));
export default function Teacher() {
  const app = useApp();
  const [authed, setAuthed] = useState(false),
    [password, setPassword] = useState(""),
    [groups, setGroups] = useState<Group[]>([]),
    [loading, setLoading] = useState(false),
    [detail, setDetail] = useState<Detail | null>(null),
    [botToken, setBotToken] = useState(""),
    [chatId, setChatId] = useState(""),
    [telegram, setTelegram] = useState(false),
    [connectionIssue, setConnectionIssue] = useState("");
  const refreshing = useRef(false);
  const generation = useRef(0);
  const refresh = async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    const requestedGeneration = generation.current;
    try {
      const d = await api<{ groups: Group[] }>("/teacher/groups");
      if (requestedGeneration !== generation.current) return;
      setConnectionIssue("");
      setGroups(
        d.groups.map((g) => ({
          ...g,
          online: g.devices?.some((v) => !v.revoked && v.online),
          sensorIssues:
            g.latest?.filter((v) =>
              ["NO_RESPONSE", "ERROR", "OUT_OF_RANGE"].includes(v.status),
            ).length || 0,
        })),
      );
      setAuthed(true);
      const t = await api<{ configured: boolean; chatId?: string }>(
        "/telegram",
      ).catch(() => null);
      if (requestedGeneration !== generation.current) return;
      if (t) {
        setTelegram(t.configured);
        if (t.chatId) setChatId(t.chatId);
      }
    } catch (error) {
      if (requestedGeneration !== generation.current) return;
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        setAuthed(false);
        setGroups([]);
        setDetail(null);
      } else {
        setConnectionIssue("El servidor no está respondiendo. Conservamos la última consulta y volveremos a intentar; los datos pueden estar desactualizados.");
      }
    } finally {
      refreshing.current = false;
    }
  };
  useEffect(() => {
    void refresh();
  }, []);
  useEffect(() => {
    if (!authed) return;
    const timer = setInterval(() => void refresh(), 5000);
    return () => clearInterval(timer);
  }, [authed]);
  const login = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await post("/teacher/login", { password });
      generation.current += 1;
      setAuthed(true);
      setPassword("");
      await refresh();
    } catch (e) {
      app.notify((e as Error).message, true);
    } finally {
      setLoading(false);
    }
  };
  const configure = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await post("/telegram", { token: botToken, chatId });
      setBotToken("");
      setTelegram(true);
      app.notify(
        "Bot guardado de forma cifrada. Envía una prueba al chat de la clase.",
      );
    } catch (e) {
      app.notify((e as Error).message, true);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="teacher-page">
      <PageHeader
        kicker="Espacio docente · acompaña el descubrimiento"
        title="Diez equipos. Mil preguntas."
        subtitle="Una mirada a todo el taller para dar la siguiente pista, resolver un cable suelto y celebrar cada descubrimiento."
        art={
          <Icon
            name="school"
            size={84}
            className="text-accent"
            strokeWidth={1.3}
          />
        }
        actions={
          authed ? (
            <Button
              variant="hero"
              onClick={() => {
                generation.current += 1;
                void post("/teacher/logout", {})
                  .then(() => {
                    setAuthed(false);
                    setGroups([]);
                    setDetail(null);
                    setTelegram(false);
                    setChatId("");
                  })
                  .catch((error) => app.notify(error.message, true));
              }}
            >
              <LogOut size={15} />
              Cerrar sesión docente
            </Button>
          ) : undefined
        }
      />
      {!authed ? (
        <section className="teacher-login">
          <span className="teacher-login-icon">
            <GraduationCap size={37} />
          </span>
          <span className="eyebrow">ESPACIO DOCENTE</span>
          <h2>Una mirada a todo el taller.</h2>
          <p>
            Accede con la contraseña configurada por la organización. Los datos
            de tus estudiantes se muestran en modo lectura.
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void login();
            }}
          >
            <label>
              Contraseña docente
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña del taller"
              />
            </label>
            <Button type="submit" loading={loading}>
              <LockKeyhole size={16} />
              Entrar al panel
            </Button>
          </form>
          <small>
            La contraseña la entrega la organización del taller. El acceso
            docente permite consultar a los equipos y configurar los avisos de
            la clase.
          </small>
        </section>
      ) : (
        <>
          {connectionIssue && <Notice tone="warning">{connectionIssue}</Notice>}
          <div className="teacher-stats">
            <div>
              <strong>{groups.length}</strong>
              <span>grupos registrados</span>
            </div>
            <div>
              <strong>{groups.filter((g) => g.online).length}</strong>
              <span>estaciones transmitiendo</span>
            </div>
            <div>
              <strong>{groups.filter((g) => g.sensorIssues).length}</strong>
              <span>grupos por revisar</span>
            </div>
            <div>
              <strong>
                60<span>min</span>
              </strong>
              <span>un recorrido guiado</span>
            </div>
          </div>
          <div className="teacher-group-grid">
            {Array.from({ length: 10 }, (_, i) => {
              const teams = groups.filter((g) => g.groupNumber === i + 1);
              return (
                <section className="teacher-group" key={i}>
                  <div className="teacher-group-head">
                    <span className="card-number">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Badge
                      tone={teams.some((g) => g.online) ? "sage" : "neutral"}
                    >
                      {teams.some((g) => g.online)
                        ? "EN LÍNEA"
                        : teams.length
                          ? "SIN TELEMETRÍA"
                          : "DISPONIBLE"}
                    </Badge>
                  </div>
                  {teams.length ? (
                    teams.map((g) => (
                      <div key={g.id}>
                        <h3>{g.name || `Equipo ${i + 1}`}</h3>
                        <div className="progress-track">
                          <div
                            style={{
                              width: `${(expressCount(g.progress) / Math.max(essentials.length, 1)) * 100}%`,
                            }}
                          />
                        </div>
                        <small>
                          {Array.isArray(g.progress)
                            ? g.progress.length
                            : g.progress}{" "}
                          actividades registradas{" "}
                          {g.sensorIssues
                            ? `· ${g.sensorIssues} sensores por revisar`
                            : ""}
                        </small>
                        <button
                          className="text-button"
                          onClick={() =>
                            void api<Detail>(`/teacher/groups/${g.id}`)
                              .then(setDetail)
                              .catch((e) => app.notify(e.message, true))
                          }
                        >
                          <Eye size={14} />
                          Ver en modo lectura <ArrowRight size={13} />
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="group-unused">
                      <Radio size={23} />
                      <p>Esperando un equipo</p>
                      <small>El grupo elige esta estación al comenzar.</small>
                    </div>
                  )}
                </section>
              );
            })}
          </div>
          <section className="teacher-telegram settings-card">
            <div className="settings-card-title">
              <Send size={21} />
              <h3>De un umbral a un aviso en la clase.</h3>
              <Badge tone={telegram ? "sage" : "neutral"}>
                {telegram ? "BOT CONFIGURADO" : "TELEGRAM"}
              </Badge>
            </div>
            <div className="telegram-layout">
              <div>
                <p>
                  Las alertas llegan al docente o al chat del taller. No se
                  requieren cuentas personales de estudiantes.
                </p>
                <ol>
                  <li>
                    Crea un bot con{" "}
                    <a
                      href="https://t.me/BotFather"
                      target="_blank"
                      rel="noreferrer"
                    >
                      @BotFather
                    </a>{" "}
                    y copia su token.
                  </li>
                  <li>Agrega el bot al chat de la clase y envía /start.</li>
                  <li>
                    Consulta el ID del chat mediante <code>getUpdates</code> en
                    la API oficial o un bot de identificación de tu confianza.
                  </li>
                  <li>Configura un umbral en el dashboard de cada grupo.</li>
                </ol>
                <Notice>
                  La clave del bot se guarda cifrada y no se muestra al volver a
                  abrir el panel. Usa un chat del taller al que el bot tenga
                  acceso.
                </Notice>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void configure();
                }}
              >
                <label>
                  Token del bot
                  <input
                    type="password"
                    value={botToken}
                    onChange={(e) => setBotToken(e.target.value)}
                    required
                    autoComplete="off"
                    placeholder="123456:token-del-bot"
                  />
                </label>
                <label>
                  ID del chat de clase
                  <input
                    value={chatId}
                    onChange={(e) => setChatId(e.target.value)}
                    required
                    placeholder="Por ejemplo, -1001234567890"
                  />
                </label>
                <Button type="submit" loading={loading}>
                  Guardar bot <CheckCircle2 size={16} />
                </Button>
                <Button
                  variant="secondary"
                  disabled={!telegram}
                  onClick={() =>
                    void post("/telegram/test", {})
                      .then(() =>
                        app.notify("Mensaje enviado al chat de la clase."),
                      )
                      .catch((e) => app.notify(e.message, true))
                  }
                >
                  <Send size={15} />
                  Enviar mensaje de prueba
                </Button>
              </form>
            </div>
          </section>
          <section className="teacher-guide">
            <h2>Una hora para construir una idea.</h2>
            <div>
              {[
                ["05", "Conoce tu estación"],
                ["08", "Tu primer LED"],
                ["07", "Código en movimiento"],
                ["15", "Escucha a tu planta"],
                ["10", "Calibra y comprueba"],
                ["15", "Conecta y observa"],
              ].map(([n, t]) => (
                <span key={n + t}>
                  <strong>
                    {n}
                    <small>min</small>
                  </strong>
                  {t}
                </span>
              ))}
            </div>
            <p>
              Para terminar a tiempo, usa humedad de suelo y DHT11 como estación
              mínima. Los otros sensores quedan en el laboratorio libre. Reserva
              los últimos minutos para mostrar qué cambió al cruzar un umbral.
            </p>
            <Button
              variant="secondary"
              onClick={() => window.open("/docs/TEACHER_GUIDE.md", "_blank")}
            >
              <Download size={15} />
              Guía del docente
            </Button>
          </section>
        </>
      )}
      {detail && (
        <Modal
          title={`${detail.session.name || "Equipo"} · modo lectura`}
          onClose={() => setDetail(null)}
          wide
        >
          <Notice>
            Este panel muestra información del grupo y no modifica sus
            borradores ni su configuración.
          </Notice>
          <p>
            Estación {detail.session.groupNumber} ·{" "}
            {detail.session.progress.length} actividades completadas
          </p>
          <div className="sensor-status-table">
            {detail.latest.map((r) => (
              <div key={`${r.deviceId}:${r.sensor}`}>
                <strong>{sensorLabels[r.sensor] || r.sensor}</strong>
                <Badge>{statusLabels[r.status] || r.status}</Badge>
                <span>
                  {r.source === "simulation" ? "Simulado" : "Hardware real"}
                </span>
                <code>
                  {r.value ?? "—"} {r.unit}
                </code>
              </div>
            ))}
          </div>
          {!detail.latest.length && (
            <p className="muted">
              Aún no se ha recibido telemetría en este grupo.
            </p>
          )}
          <h3>Últimos avisos</h3>
          {detail.alerts.slice(0, 5).map((a) => (
            <p key={a.id}>{a.message}</p>
          ))}
        </Modal>
      )}
    </div>
  );
}
