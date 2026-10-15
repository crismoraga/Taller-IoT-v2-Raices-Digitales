import { lazy, Suspense, useState, useEffect, useRef } from "react";
import {
  Activity,
  Download,
  FlaskConical,
  Leaf,
  Radio,
  Wifi,
  WifiOff,
  Droplets,
  Sun,
  Thermometer,
  Ruler,
  CloudRain,
  Plus,
  Trash2,
  Bell,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  TriangleAlert,
} from "lucide-react";
import { useApp } from "../lib/context";
import { Icon } from "../brand/Graphics";
import { PageHeader } from "../ui/Layout";
import { Segmented } from "../ui/Card";
import {
  api,
  post,
  sensorLabels,
  statusLabels,
  type Reading,
  type DashboardData,
} from "../lib/api";
import { Button, Badge, EmptyState, Notice, Modal } from "../components/Common";
import { downloadExport } from "../lib/export";
import {
  dashboardReadings,
  hasReadingValue,
  isLiveReading,
  readingSource,
  readingTime,
} from "../lib/dashboard-readings";
import "./dashboard.css";
const LivingStation = lazy(() => import("../experience/LivingStation"));

const initial: DashboardData = {
  devices: [],
  latest: [],
  history: [],
  rules: [],
  alerts: [],
};
const deliveryLabels: Record<string, string> = {
  simulation: "Práctica simulada",
  pending: "Enviando a Telegram",
  not_configured: "Aviso en el panel",
  delivered: "Enviado a Telegram",
  failed: "No se pudo enviar a Telegram",
};
const definitions = [
  { id: "soil", unit: "%", Icon: Droplets, min: 0, max: 100, value: 55 },
  {
    id: "soil_temperature",
    unit: "°C",
    Icon: Thermometer,
    min: -10,
    max: 50,
    value: 20,
  },
  {
    id: "air_temperature",
    unit: "°C",
    Icon: Thermometer,
    min: 0,
    max: 50,
    value: 23,
  },
  {
    id: "air_humidity",
    unit: "%",
    Icon: Droplets,
    min: 0,
    max: 100,
    value: 60,
  },
  { id: "light", unit: "%", Icon: Sun, min: 0, max: 100, value: 65 },
  { id: "water_level", unit: "%", Icon: Droplets, min: 0, max: 100, value: 40 },
  { id: "rain", unit: "0/1", Icon: CloudRain, min: 0, max: 1, value: 0 },
  { id: "distance", unit: "cm", Icon: Ruler, min: 2, max: 400, value: 35 },
  { id: "motion", unit: "0/1", Icon: Activity, min: 0, max: 1, value: 0 },
];
function format(r: Reading | undefined) {
  if (!hasReadingValue(r)) return "—";
  if (r.sensor === "rain") return r.value ? "Sí" : "No";
  if (r.sensor === "motion") return r.value ? "Detectado" : "Sin actividad";
  return Number(r.value).toLocaleString("es-CL", { maximumFractionDigits: 1 });
}
function age(iso: string) {
  if (!Number.isFinite(Date.parse(iso))) return "Sin fecha";
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(iso).getTime()) / 1000),
  );
  return seconds < 60
    ? `hace ${seconds} s`
    : seconds < 3600
      ? `hace ${Math.floor(seconds / 60)} min`
      : `hace ${Math.floor(seconds / 3600)} h`;
}
export default function Dashboard() {
  const app = useApp();
  const [data, setData] = useState(initial),
    [range, setRange] = useState("15m"),
    [source, setSource] = useState("all"),
    [chartSensor, setChartSensor] = useState("soil"),
    [simulation, setSimulation] = useState(false),
    [showAllSensors, setShowAllSensors] = useState(false),
    [moreSimulationSensors, setMoreSimulationSensors] = useState(false),
    [historyOpen, setHistoryOpen] = useState(false),
    [connectionIssue, setConnectionIssue] = useState(""),
    [streaming, setStreaming] = useState(false),
    [values, setValues] = useState<Record<string, number>>(
      Object.fromEntries(definitions.map((d) => [d.id, d.value])),
    ),
    [failed, setFailed] = useState(""),
    [ruleModal, setRuleModal] = useState(false),
    [ruleSensor, setRuleSensor] = useState("soil"),
    [min, setMin] = useState("25"),
    [max, setMax] = useState("80"),
    [hysteresis, setHysteresis] = useState("3"),
    [cooldown, setCooldown] = useState("60"),
    [loading, setLoading] = useState(false),
    [exporting, setExporting] = useState(false),
    [eventState, setEventState] = useState("Conectando"),
    [, setTick] = useState(0);
  const valuesRef = useRef(values),
    failedRef = useRef(failed),
    refreshGeneration = useRef(0),
    refreshRequest = useRef(0);
  const simulationDefinitions = definitions.filter(
    ({ id }) =>
      moreSimulationSensors ||
      ["soil", "air_temperature", "air_humidity"].includes(id) ||
      app.session?.sensorEnabled[id],
  );
  const simulationDefinitionsRef = useRef(simulationDefinitions);
  simulationDefinitionsRef.current = simulationDefinitions;
  valuesRef.current = values;
  failedRef.current = failed;
  const refresh = async () => {
    if (!app.session) return;
    const generation = refreshGeneration.current;
    const request = ++refreshRequest.current;
    try {
      const updated = await api<DashboardData>(`/dashboard?range=${range}`);
      if (
        generation !== refreshGeneration.current ||
        request !== refreshRequest.current
      )
        return;
      setData(updated);
      setConnectionIssue("");
    } catch {
      if (
        generation !== refreshGeneration.current ||
        request !== refreshRequest.current
      )
        return;
      setConnectionIssue(
        "Sin conexión con el servidor. Mostramos las últimas lecturas; volveremos a intentar automáticamente.",
      );
    }
  };
  useEffect(() => {
    setData(initial);
    setStreaming(false);
  }, [app.session?.id]);
  useEffect(() => {
    if (!app.session) return;
    void refresh();
    const events = new EventSource("/api/events");
    events.onopen = () => setEventState("En línea");
    events.onerror = () => setEventState("Reconectando");
    events.addEventListener("update", () => void refresh());
    const poll = setInterval(() => {
      setTick((t) => t + 1);
      void refresh();
    }, 10000);
    return () => {
      refreshGeneration.current += 1;
      events.close();
      clearInterval(poll);
    };
  }, [app.session?.id, range]);
  const sendSimulation = async () => {
    if (!app.session) {
      app.openOnboarding();
      return;
    }
    const readings = simulationDefinitionsRef.current.map((d) => ({
      sensor: d.id,
      value: failedRef.current === d.id ? null : valuesRef.current[d.id],
      unit: d.unit,
      status: failedRef.current === d.id ? "NO_RESPONSE" : "READING",
      confidence: "simulated",
    }));
    try {
      await post("/simulation", { readings });
      setHistoryOpen(true);
      void refresh();
    } catch (e) {
      app.notify((e as Error).message, true);
      setStreaming(false);
    }
  };
  useEffect(() => {
    if (!streaming) return;
    void sendSimulation();
    const interval = setInterval(() => void sendSimulation(), 5000);
    return () => clearInterval(interval);
  }, [streaming]);
  const allReadings = [...data.latest, ...app.localReadings];
  const { source: sceneSource, latest: latestMap } = dashboardReadings(
    allReadings,
    source,
  );
  const latest = [...latestMap.values()];
  const sceneValue = (sensor: string) => {
    const reading = latestMap.get(sensor);
    return hasReadingValue(reading) &&
      ["READING", "OUT_OF_RANGE"].includes(reading.status) &&
      isLiveReading(reading)
      ? reading.value
      : undefined;
  };
  const history = data.history.filter(
    (reading) =>
      reading.sensor === chartSensor && readingSource(reading) === sceneSource,
  );
  const liveSensorCount = latest.filter((reading) =>
    isLiveReading(reading),
  ).length;
  // A connected browser/event stream is different from receiving fresh sensor data.
  const online = liveSensorCount > 0;
  const variableRules = data.rules.filter((rule) => {
    const reading = latestMap.get(rule.sensor);
    return (
      hasReadingValue(reading) &&
      ["READING", "OUT_OF_RANGE"].includes(reading.status) &&
      isLiveReading(reading)
    );
  });
  const inRange = variableRules.filter((rule) => {
    const value = latestMap.get(rule.sensor)!.value!;
    return value >= rule.min && value <= rule.max;
  }).length;
  const createRule = async () => {
    if (loading) return;
    if (
      !Number.isFinite(Number(min)) ||
      !Number.isFinite(Number(max)) ||
      Number(min) >= Number(max)
    ) {
      app.notify("El mínimo debe ser menor que el máximo.", true);
      return;
    }
    setLoading(true);
    try {
      await post("/rules", {
        sensor: ruleSensor,
        min: Number(min),
        max: Number(max),
        hysteresis: Number(hysteresis),
        cooldown: Number(cooldown),
      });
      setRuleModal(false);
      void refresh();
      app.notify("Umbral guardado. Se evaluará con las próximas lecturas.");
    } catch (e) {
      app.notify((e as Error).message, true);
    } finally {
      setLoading(false);
    }
  };
  const exportCSV = async () => {
    if (!app.session || exporting) return;
    setExporting(true);
    try {
      await downloadExport(
        "/export",
        `raices-grupo-${app.session.groupNumber}.csv`,
      );
      app.notify("Lecturas descargadas en CSV.");
    } catch (problem) {
      app.notify(
        problem instanceof Error
          ? problem.message
          : "No se pudieron descargar las lecturas. Vuelve a intentar.",
        true,
      );
    } finally {
      setExporting(false);
    }
  };
  const relevantSensors = definitions.filter(
    ({ id }) =>
      (latestMap.has(id) && latestMap.get(id)?.status !== "DISABLED") ||
      app.session?.sensorEnabled[id],
  );
  const visibleSensors = showAllSensors
    ? relevantSensors
    : relevantSensors.slice(0, 4);
  const relevantSensorIds = relevantSensors.map(({ id }) => id).join(",");
  useEffect(() => {
    const ids = relevantSensorIds ? relevantSensorIds.split(",") : [];
    if (ids.length && !ids.includes(chartSensor)) setChartSensor(ids[0]);
  }, [chartSensor, relevantSensorIds]);
  return (
    <div className="dashboard-page">
      <PageHeader
        kicker="Cultiva · Mi estación"
        title="Tu planta tiene algo que contarte"
        subtitle="Monta un sensor, recibe su señal y descubre lo que cambia en tu planta."
        art={
          <Icon
            name="sprout"
            size={84}
            className="text-accent"
            strokeWidth={1.3}
          />
        }
        actions={
          <Button
            variant="secondary"
            loading={exporting}
            onClick={() => void exportCSV()}
            disabled={!app.session}
          >
            <Download size={15} />
            Exportar CSV
          </Button>
        }
      />
      {!app.session ? (
        <EmptyState
          title="Cada planta merece su propio espacio."
          description="Crea tu grupo para guardar lecturas, calibraciones y alertas de forma independiente."
          action={
            <Button onClick={() => app.openOnboarding("/planta")}>
              Crear mi grupo <ArrowRight size={16} />
            </Button>
          }
        />
      ) : (
        <>
          {connectionIssue && (
            <div role="status">
              <Notice tone="warning">{connectionIssue}</Notice>
            </div>
          )}
          <section className="station-summary">
            <span className="station-plant-icon">
              <Leaf size={31} />
            </span>
            <div>
              <span className="eyebrow">
                ESTACIÓN {String(app.session.groupNumber).padStart(2, "0")}
              </span>
              <h3>
                {app.session.name ||
                  `Planta del grupo ${app.session.groupNumber}`}
              </h3>
              <span className="muted">
                {liveSensorCount
                  ? `${liveSensorCount} ${liveSensorCount === 1 ? "variable en vivo" : "variables en vivo"}`
                  : latest.length
                    ? "Conservamos tus últimas lecturas"
                    : "Tu primera lectura está por llegar"}
              </span>
            </div>
            <div className="station-summary-status">
              <Badge tone={online ? "sage" : "neutral"}>
                {online ? <Wifi size={13} /> : <WifiOff size={13} />}{" "}
                {online
                  ? sceneSource === "simulation"
                    ? "SIMULACIÓN EN VIVO"
                    : "RECIBIENDO DATOS"
                  : "ESPERANDO LA PLACA"}
              </Badge>
              <small>Actualización del panel: {eventState}</small>
            </div>
            {data.rules.length > 0 && (
              <div className="range-summary">
                <strong>
                  {variableRules.length
                    ? `${inRange}/${variableRules.length}`
                    : "—"}
                </strong>
                <span>
                  Variables dentro
                  <br />
                  de tus umbrales
                </span>
              </div>
            )}
          </section>
          <div className="dashboard-controls">
            <Segmented
              label="Fuente de las lecturas"
              value={source}
              onChange={setSource}
              options={[
                { value: "all", label: "Automática" },
                { value: "hardware", label: "Hardware real", icon: "usb" },
                { value: "simulation", label: "Simulación", icon: "flask" },
              ]}
            />
            <Button
              variant={simulation ? "secondary" : "ghost"}
              onClick={() => {
                if (simulation) {
                  setStreaming(false);
                  if (source === "simulation") setSource("all");
                } else setSource("simulation");
                setSimulation(!simulation);
              }}
            >
              <FlaskConical size={15} />
              {simulation ? "Cerrar simulador" : "Practicar sin hardware"}
            </Button>
          </div>
          {sceneSource === "simulation" && latest.length > 0 && (
            <Notice>
              Estás viendo <strong>datos simulados</strong>. Elige «Hardware
              real» para ver únicamente los sensores de tu placa.
            </Notice>
          )}
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
            <Suspense
              fallback={
                <div className="grid min-h-[450px] place-items-center rounded-2xl border border-border bg-surface text-ink-soft">
                  Tu estación está tomando forma…
                </div>
              }
            >
              <LivingStation
                mode="explore"
                board={app.board}
                readings={{
                  soil: sceneValue("soil"),
                  light: sceneValue("light"),
                  source: sceneSource,
                }}
              />
            </Suspense>
            <div className="min-w-0 space-y-4">
              <div className="dashboard-growth-heading">
                <div>
                  <p className="t-overline text-ink-accent">
                    Tu jardín de datos
                  </p>
                  <h2>Tus sensores, una señal a la vez</h2>
                  <p>Toca una tarjeta para ver cómo cambia.</p>
                </div>
                <button
                  className="dashboard-add-sensor"
                  onClick={() => app.navigate("/taller/station")}
                >
                  <Plus size={16} /> Añadir sensor
                </button>
              </div>
              {!relevantSensors.length && (
                <EmptyState
                  title="Todo listo para tu primera lectura"
                  description="Empieza con luz y temperatura. Después añade humedad del suelo y lleva tu estación a la maceta."
                  action={
                    <Button
                      variant="secondary"
                      onClick={() => app.navigate("/taller/station")}
                    >
                      Elegir mis sensores <ArrowRight size={16} />
                    </Button>
                  }
                />
              )}
              <div className="dashboard-sensor-groups">
                {[
                  { title: "En la maceta", ids: ["soil", "soil_temperature"] },
                  {
                    title: "A su alrededor",
                    ids: ["air_temperature", "air_humidity", "light"],
                  },
                  {
                    title: "Agua y entorno",
                    ids: ["water_level", "rain", "distance", "motion"],
                  },
                ].map((group) => {
                  const sensors = visibleSensors.filter(({ id }) =>
                    group.ids.includes(id),
                  );
                  if (!sensors.length) return null;
                  return (
                    <section
                      className="dashboard-sensor-group"
                      aria-label={group.title}
                      key={group.title}
                    >
                      <h3 className="dashboard-group-label">{group.title}</h3>
                      <div className="sensor-grid">
                        {sensors.map(({ id, unit, Icon }) => {
                          const reading = latestMap.get(id);
                          const rule = data.rules.find((r) => r.sensor === id);
                          const fresh = isLiveReading(reading);
                          const outside =
                            hasReadingValue(reading) &&
                            fresh &&
                            rule &&
                            (reading.value < rule.min ||
                              reading.value > rule.max);
                          const sensorProblem =
                            reading &&
                            ["NO_RESPONSE", "ERROR", "OUT_OF_RANGE"].includes(
                              reading.status,
                            );
                          return (
                            <button
                              key={id}
                              className={`sensor-card ${chartSensor === id ? "selected" : ""} ${outside || sensorProblem ? "alerting" : ""}`}
                              aria-pressed={chartSensor === id}
                              data-sensor={id}
                              data-source={
                                reading ? readingSource(reading) : sceneSource
                              }
                              onClick={() => {
                                setChartSensor(id);
                                setHistoryOpen(true);
                              }}
                            >
                              <div className="sensor-card-top">
                                <span className="sensor-icon">
                                  <Icon size={19} />
                                </span>
                                <span
                                  className={`sensor-state ${fresh && reading?.status === "READING" && hasReadingValue(reading) ? "good" : ""}`}
                                >
                                  {reading
                                    ? !fresh && hasReadingValue(reading)
                                      ? "Última lectura"
                                      : statusLabels[reading.status] ||
                                        reading.status
                                    : "Esperando"}
                                </span>
                              </div>
                              <h3>{sensorLabels[id]}</h3>
                              <div className="sensor-value">
                                {format(reading)}
                                <span>
                                  {hasReadingValue(reading) && unit !== "0/1"
                                    ? unit
                                    : ""}
                                </span>
                              </div>
                              <div className="sensor-card-bottom">
                                <span>
                                  {reading?.source === "simulation"
                                    ? "SIMULACIÓN"
                                    : reading
                                      ? "HARDWARE REAL"
                                      : "SIN LECTURAS"}
                                </span>
                                <span>
                                  {reading?.timestamp
                                    ? age(reading.timestamp)
                                    : "—"}
                                </span>
                              </div>
                              {outside && (
                                <span className="threshold-flag">
                                  Fuera del rango {rule!.min}–{rule!.max}
                                </span>
                              )}
                              {reading?.status === "NEEDS_CALIBRATION" && (
                                <span className="threshold-flag">
                                  {typeof reading.raw === "number"
                                    ? `RAW ${reading.raw} · `
                                    : ""}
                                  calibra para ver el porcentaje
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>
              {relevantSensors.some(({ id }) =>
                ["NO_RESPONSE", "ERROR", "OUT_OF_RANGE"].includes(
                  latestMap.get(id)?.status || "",
                ),
              ) && (
                <Notice tone="warning">
                  Veamos qué necesita ese sensor. La conexión del experimento te
                  muestra el siguiente paso.{" "}
                  <button
                    className="text-button"
                    onClick={() => app.navigate("/diagnostico")}
                  >
                    Revisar diagnóstico <ArrowRight size={13} />
                  </button>
                </Notice>
              )}
              {relevantSensors.length > 4 && (
                <Button
                  variant="ghost"
                  onClick={() => setShowAllSensors(!showAllSensors)}
                >
                  {showAllSensors
                    ? "Mostrar menos sensores"
                    : `Ver los ${relevantSensors.length} sensores activos`}
                </Button>
              )}
            </div>
          </div>
          <details
            className="chart-panel simple-details"
            open={historyOpen}
            onToggle={(event) => setHistoryOpen(event.currentTarget.open)}
          >
            <summary>
              Historial de lecturas · {sensorLabels[chartSensor]}
            </summary>
            <div className="panel-header">
              <div>
                <Activity size={17} />
                <h3>{sensorLabels[chartSensor]}</h3>
              </div>
              <select
                aria-label="Rango histórico"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="15m">Últimos 15 minutos</option>
                <option value="1h">Última hora</option>
                <option value="6h">Últimas 6 horas</option>
                <option value="24h">Últimas 24 horas</option>
                <option value="all">Toda la sesión</option>
              </select>
            </div>
            <HistoryChart readings={history} />
            <div className="chart-footnote">
              Histórico de lecturas recibidas; cadencia habitual de 5 segundos
              por fuente.{" "}
              {chartSensor === "light"
                ? "La luz se expresa como nivel relativo, sin equivalencia en lux."
                : ""}
            </div>
          </details>
          <div className="dashboard-bottom-grid">
            <details className="rules-panel simple-details">
              <summary>Umbrales de aviso ({data.rules.length})</summary>
              <div className="panel-header">
                <div>
                  <Bell size={17} />
                  <h3>Tus umbrales</h3>
                </div>
                <button
                  className="icon-button"
                  aria-label="Añadir umbral"
                  onClick={() => setRuleModal(true)}
                >
                  <Plus size={19} />
                </button>
              </div>
              {!data.rules.length ? (
                <div className="small-empty">
                  <p>¿Cuándo necesita atención tu planta?</p>
                  <span>
                    Configura un rango para recibir avisos. Los valores
                    adecuados dependen de tu planta y de la calibración.
                  </span>
                  <button
                    className="text-button"
                    onClick={() => setRuleModal(true)}
                  >
                    Crear un umbral <Plus size={13} />
                  </button>
                </div>
              ) : (
                data.rules.map((r) => (
                  <div className="rule-row" key={r.id}>
                    <div>
                      <strong>{sensorLabels[r.sensor]}</strong>
                      <small>
                        Rango {r.min}–{r.max} · histéresis {r.hysteresis} ·
                        pausa {r.cooldown} s
                      </small>
                    </div>
                    <button
                      className="icon-button"
                      aria-label={`Eliminar umbral ${sensorLabels[r.sensor]}`}
                      onClick={() =>
                        void api(`/rules/${r.id}`, { method: "DELETE" })
                          .then(() => refresh())
                          .catch((e) => app.notify(e.message, true))
                      }
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </details>
            <section className="alerts-panel">
              <div className="panel-header">
                <div>
                  <Radio size={17} />
                  <h3>Lo que está pasando</h3>
                </div>
                <Badge>{data.alerts.length} avisos</Badge>
              </div>
              {!data.alerts.length ? (
                <div className="small-empty">
                  <CheckCircle2 size={23} />
                  <p>Sin avisos registrados.</p>
                  <button
                    className="text-button"
                    onClick={() => setRuleModal(true)}
                  >
                    Crear mi primer umbral <Plus size={13} />
                  </button>
                </div>
              ) : (
                <div className="alert-list">
                  {data.alerts.slice(0, 15).map((a) => (
                    <div
                      className={`alert-row ${["RECOVERY", "SENSOR_RECOVERY", "DEVICE_RECOVERY"].includes(a.type) ? "recovered" : ""}`}
                      key={a.id}
                    >
                      {[
                        "RECOVERY",
                        "SENSOR_RECOVERY",
                        "DEVICE_RECOVERY",
                      ].includes(a.type) ? (
                        <CheckCircle2 size={17} />
                      ) : (
                        <TriangleAlert size={17} />
                      )}
                      <div>
                        <p>{a.message}</p>
                        <small>
                          {age(a.createdAt)}{" "}
                          {a.delivery
                            ? `· ${deliveryLabels[a.delivery] || a.delivery}`
                            : ""}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </>
      )}
      {simulation && (
        <section className="simulator-panel">
          <div className="panel-header">
            <div>
              <FlaskConical size={19} />
              <h3>Simulador de fenómenos físicos</h3>
            </div>
            <Badge tone="orange">DATOS SIMULADOS</Badge>
          </div>
          <p>
            Mueve un control, envía la lectura y mira cómo responde tu planta
            3D. Son datos simulados; tu placa conserva sus propias lecturas.
          </p>
          <div className="simulation-grid">
            {simulationDefinitions.map((d) => (
              <label key={d.id}>
                {sensorLabels[d.id]}
                <strong>
                  {d.max === 1
                    ? values[d.id]
                      ? "Sí"
                      : "No"
                    : `${values[d.id]} ${d.unit}`}
                </strong>
                <input
                  type="range"
                  min={d.min}
                  max={d.max}
                  step={d.max === 1 ? 1 : 0.5}
                  value={values[d.id]}
                  onChange={(e) =>
                    setValues({ ...values, [d.id]: Number(e.target.value) })
                  }
                />
              </label>
            ))}
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={moreSimulationSensors}
              onChange={(event) => {
                setMoreSimulationSensors(event.target.checked);
                setFailed("");
              }}
            />
            Practicar con todos los sensores del kit
          </label>
          <div className="simulation-actions">
            <label>
              Simular sensor sin respuesta
              <select
                value={failed}
                onChange={(e) => setFailed(e.target.value)}
              >
                <option value="">Todos responden</option>
                {simulationDefinitions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {sensorLabels[d.id]}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={streaming}
                onChange={(e) => setStreaming(e.target.checked)}
                disabled={!app.session}
              />
              Enviar cada 5 s
            </label>
            <Button onClick={() => void sendSimulation()}>
              <RefreshCw size={16} />
              Enviar una lectura
            </Button>
          </div>
          <small>
            La transmisión se detiene al cerrar el simulador o salir de esta
            página.
          </small>
        </section>
      )}
      {ruleModal && (
        <Modal
          title="Define cuándo prestar atención"
          onClose={() => setRuleModal(false)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void createRule();
            }}
          >
            <label>
              Variable
              <select
                value={ruleSensor}
                onChange={(e) => setRuleSensor(e.target.value)}
              >
                {definitions.map((d) => (
                  <option key={d.id} value={d.id}>
                    {sensorLabels[d.id]}
                  </option>
                ))}
              </select>
            </label>
            <div className="form-row">
              <label>
                Mínimo
                <input
                  type="number"
                  required
                  step="any"
                  value={min}
                  onChange={(e) => setMin(e.target.value)}
                />
              </label>
              <label>
                Máximo
                <input
                  type="number"
                  required
                  step="any"
                  value={max}
                  onChange={(e) => setMax(e.target.value)}
                />
              </label>
            </div>
            <details className="simple-details">
              <summary>Frecuencia de avisos · avanzado</summary>
              <div className="form-row">
                <label>
                  Histéresis
                  <input
                    type="number"
                    min="0"
                    required
                    step="any"
                    value={hysteresis}
                    onChange={(e) => setHysteresis(e.target.value)}
                  />
                </label>
                <label>
                  Pausa entre avisos (s)
                  <input
                    type="number"
                    min="10"
                    required
                    value={cooldown}
                    onChange={(e) => setCooldown(e.target.value)}
                  />
                </label>
              </div>
              <Notice>
                La histéresis evita avisos repetidos cerca del límite. Un aviso
                de recuperación se genera cuando la lectura vuelve al interior
                del rango.
              </Notice>
            </details>
            <Button type="submit" loading={loading}>
              Guardar umbral <CheckCircle2 size={16} />
            </Button>
          </form>
        </Modal>
      )}
    </div>
  );
}
function HistoryChart({ readings }: { readings: Reading[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const points = readings
    .filter((r) => hasReadingValue(r) && readingTime(r) > 0)
    .sort(
      (a, b) =>
        new Date(a.timestamp || 0).getTime() -
        new Date(b.timestamp || 0).getTime(),
    );
  if (!points.length)
    return (
      <div className="chart-empty">
        <Activity size={26} />
        <p>Cada lectura cuenta una parte de la historia.</p>
        <span>
          El gráfico aparecerá cuando recibas telemetría real o envíes una
          lectura simulada.
        </span>
      </div>
    );
  const vals = points.map((p) => p.value!),
    lo = Math.min(...vals),
    hi = Math.max(...vals),
    pad = Math.max((hi - lo) * 0.2, 1),
    min = lo - pad,
    max = hi + pad;
  const firstTime = new Date(points[0].timestamp || 0).getTime();
  const lastTime = new Date(points.at(-1)!.timestamp || 0).getTime();
  const point = (i: number) => [
    50 +
      (lastTime === firstTime
        ? 0.5
        : (new Date(points[i].timestamp || 0).getTime() - firstTime) /
          (lastTime - firstTime)) *
        850,
    185 - ((points[i].value! - min) / (max - min)) * 155,
  ];
  const coords = points.map((_, i) => point(i));
  const path = coords.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join(" ");
  const activeIndex =
    index === null ? null : Math.min(index, points.length - 1);
  const selected = activeIndex !== null ? points[activeIndex] : null;
  return (
    <div className="history-chart">
      <svg
        viewBox="0 0 940 230"
        role="img"
        tabIndex={0}
        aria-label={`Gráfico con ${points.length} lecturas. Usa las flechas para explorar cada valor.`}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            return;
          event.preventDefault();
          setIndex(
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? points.length - 1
                : Math.max(
                    0,
                    Math.min(
                      points.length - 1,
                      (activeIndex ?? 0) +
                        (event.key === "ArrowRight" ? 1 : -1),
                    ),
                  ),
          );
        }}
        onMouseMove={(e) => {
          const bounds = e.currentTarget.getBoundingClientRect();
          const target = Math.max(
            0,
            Math.min(
              1,
              (((e.clientX - bounds.left) / bounds.width) * 940 - 50) / 850,
            ),
          );
          const targetTime = firstTime + target * (lastTime - firstTime);
          let nearest = 0;
          for (let i = 1; i < points.length; i++)
            if (
              Math.abs(
                new Date(points[i].timestamp || 0).getTime() - targetTime,
              ) <
              Math.abs(
                new Date(points[nearest].timestamp || 0).getTime() - targetTime,
              )
            )
              nearest = i;
          setIndex(nearest);
        }}
        onMouseLeave={() => setIndex(null)}
      >
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="var(--ink-accent)" stopOpacity=".24" />
            <stop offset="1" stopColor="var(--ink-accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0, 1, 2, 3].map((i) => (
          <g key={i}>
            <line
              x1="50"
              x2="910"
              y1={30 + i * 52}
              y2={30 + i * 52}
              stroke="var(--border)"
              strokeDasharray="3 5"
            />
            <text
              x="38"
              y={34 + i * 52}
              textAnchor="end"
              fill="var(--ink-soft)"
              fontSize="11"
            >
              {(max - (i * (max - min)) / 3).toFixed(1)}
            </text>
          </g>
        ))}
        <path
          d={`${path} L${coords.at(-1)![0]},190 L50,190Z`}
          fill="url(#chart-fill)"
        />
        <path
          d={path}
          fill="none"
          stroke="var(--ink-accent)"
          strokeWidth="2.5"
        />
        {points.length === 1 && (
          <circle
            cx={coords[0][0]}
            cy={coords[0][1]}
            r="4"
            fill="var(--ink-accent)"
          />
        )}
        {activeIndex !== null && (
          <g>
            <line
              x1={coords[activeIndex][0]}
              x2={coords[activeIndex][0]}
              y1="25"
              y2="190"
              stroke="var(--ink-soft)"
              strokeDasharray="4 3"
            />
            <circle
              cx={coords[activeIndex][0]}
              cy={coords[activeIndex][1]}
              r="5"
              fill="var(--ink-accent)"
              stroke="var(--surface)"
              strokeWidth="2"
            />
          </g>
        )}
        <text x="50" y="216" fill="var(--ink-soft)" fontSize="11">
          {new Date(points[0].timestamp || 0).toLocaleTimeString("es-CL")}
        </text>
        <text
          x="900"
          y="216"
          textAnchor="end"
          fill="var(--ink-soft)"
          fontSize="11"
        >
          {new Date(points.at(-1)!.timestamp || 0).toLocaleTimeString("es-CL")}
        </text>
      </svg>
      {selected && (
        <div className="chart-tooltip" role="status">
          {format(selected)} {selected.unit} ·{" "}
          {new Date(selected.timestamp || 0).toLocaleTimeString("es-CL")} ·{" "}
          {selected.source === "simulation" ? "Simulación" : "Hardware"}
          {selected.status !== "READING"
            ? ` · ${statusLabels[selected.status] || selected.status}`
            : ""}
        </div>
      )}
    </div>
  );
}
