import { useState, useEffect } from "react";
import {
  Wifi,
  Usb,
  Download,
  Upload,
  Save,
  Trash2,
  ShieldCheck,
  Radio,
  Link2,
  ArrowRight,
  Settings2,
  Power,
} from "lucide-react";
import { useApp } from "../lib/context";
import { Icon } from "../brand/Graphics";
import { PageHeader } from "../ui/Layout";
import { api, post, type DashboardData, type Session } from "../lib/api";
import { downloadExport, readSessionBackup } from "../lib/export";
import { offline } from "../lib/offline";
import { sensors } from "../data/lessons";
import { Button, Notice, Badge, Modal, EmptyState } from "../components/Common";
import { CalibrationTool } from "../lesson/CalibrationTool";
import { BoardDiscovery } from "../lesson/BoardDiscovery";
import { circuitForBoard } from "../circuit/boards";
import { circuits } from "../circuit/layouts";
import { BOARD_NAMES } from "../lib/context";
export default function Settings() {
  const app = useApp();
  const [name, setName] = useState(app.session?.name || ""),
    [group, setGroup] = useState(app.session?.groupNumber || 1),
    [ssid, setSsid] = useState(""),
    [password, setPassword] = useState(""),
    [endpoint, setEndpoint] = useState(`${location.origin}/api/device/ingest`),
    [devices, setDevices] = useState<DashboardData["devices"]>([]),
    [deleteModal, setDeleteModal] = useState(false),
    [deleting, setDeleting] = useState(false),
    [deleteWord, setDeleteWord] = useState(""),
    [installConfirm, setInstallConfirm] = useState(false),
    [calibration, setCalibration] = useState(false),
    [backupFile, setBackupFile] = useState<File | null>(null),
    [importing, setImporting] = useState(false),
    [importError, setImportError] = useState(""),
    [exporting, setExporting] = useState(false),
    [saving, setSaving] = useState(false),
    [savingSensors, setSavingSensors] = useState(false);
  const [stage, setStage] = useState<1 | 2 | 3>(app.connected ? 2 : 1);
  const [previewOpen, setPreviewOpen] = useState(false);
  const arduino = app.board !== "pico";
  useEffect(() => {
    if (app.connected) setStage(2);
  }, [app.connected]);
  useEffect(() => {
    let active = true;
    setName(app.session?.name || "");
    setGroup(app.session?.groupNumber || 1);
    setDevices([]);
    if (app.session)
      void api<DashboardData>("/dashboard")
        .then((d) => {
          if (active) setDevices(d.devices);
        })
        .catch(() => {});
    return () => {
      active = false;
    };
  }, [app.session?.id]);
  const enabled = app.session?.sensorEnabled || {};
  const advancedSensorCount = sensors.filter(
    (sensor) =>
      !["soil", "air_temperature", "air_humidity"].includes(sensor.id) &&
      enabled[sensor.id],
  ).length;
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await app.updateSession({ name: name.trim(), groupNumber: group });
      app.notify("Datos del grupo guardados.");
    } catch (e) {
      app.notify((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  };
  const install = async () => {
    setInstallConfirm(false);
    await app.installStation(ssid, password, endpoint);
    // La nueva identidad queda visible y puede revocarse sin recargar ni perder la configuración.
    void api<DashboardData>("/dashboard")
      .then((data) => setDevices(data.devices))
      .catch(() => {});
  };
  const remove = async () => {
    setDeleting(true);
    try {
      if (app.connected) await app.disconnect();
      await api("/session", { method: "DELETE" });
      await app.refreshSession();
      setDeleteModal(false);
      app.navigate("/");
      app.notify("Sesión y sus datos eliminados.");
    } catch (e) {
      app.notify((e as Error).message, true);
    } finally {
      setDeleting(false);
    }
  };
  const exportSession = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await downloadExport("/session/export", "raices-sesion.json");
      app.notify("Respaldo de tu sesión descargado.");
    } catch (problem) {
      app.notify(
        problem instanceof Error
          ? problem.message
          : "No se pudo descargar el respaldo. Vuelve a intentar.",
        true,
      );
    } finally {
      setExporting(false);
    }
  };
  const importSession = async () => {
    if (!backupFile || importing) return;
    setImporting(true);
    setImportError("");
    try {
      const payload = await readSessionBackup(backupFile);
      const restored = await post<{ session: Session }>(
        "/session/import",
        payload,
      );
      // Preserve a successful recovery if the following refresh loses network.
      offline.remember(restored.session);
      await app.refreshSession();
      app.navigate("/");
      app.notify("Respaldo recuperado. Conecta tu placa para continuar.");
    } catch (problem) {
      const message =
        problem instanceof TypeError ||
        (problem instanceof Error &&
          ["AbortError", "TimeoutError"].includes(problem.name))
          ? "No se pudo conectar con el servidor para recuperar el respaldo. Revisa tu conexión y vuelve a intentar."
          : problem instanceof Error
            ? problem.message
            : "No se pudo recuperar el respaldo. Vuelve a intentar.";
      setImportError(message);
      app.notify(message, true);
    } finally {
      setImporting(false);
    }
  };
  if (!app.session)
    return (
      <div className="settings-page">
        <PageHeader
          kicker="Telemática USM · Taller IoT"
          title="Dale vida a tu estación"
          subtitle="Tu kit está listo. Dale un espacio a tu experimento y conecta tu placa."
          art={
            <Icon
              name="board"
              size={84}
              className="text-accent"
              strokeWidth={1.3}
            />
          }
        />
        <EmptyState
          title="Empecemos por darle un nombre."
          description="Cada grupo tiene su propio espacio, sin datos personales."
          action={
            <Button onClick={() => app.openOnboarding("/estacion")}>
              Crear mi grupo <ArrowRight size={16} />
            </Button>
          }
        />
        <section className="settings-card">
          <div className="settings-card-title">
            <Upload size={20} />
            <h3>Recupera el trabajo de tu grupo</h3>
          </div>
          <p id="session-backup-help">
            Recupera progreso, código, calibraciones y sensores con tu archivo
            raices-sesion.json. Luego conecta e instala tu placa de nuevo.
          </p>
          <details className="simple-details">
            <summary>¿Qué incluye el respaldo?</summary>
            <p>
              Las lecturas y los accesos de dispositivos permanecen en la
              estación original. El respaldo recupera el trabajo de aprendizaje
              en una sesión nueva.
            </p>
          </details>
          <label htmlFor="session-backup">
            Selecciona tu respaldo JSON
            <input
              id="session-backup"
              type="file"
              accept="application/json,.json"
              aria-describedby="session-backup-help"
              disabled={importing}
              onChange={(event) => {
                setBackupFile(event.currentTarget.files?.[0] || null);
                setImportError("");
              }}
            />
          </label>
          <p className="muted">
            Tamaño máximo: 5 MiB. Conserva tu archivo original como respaldo.
          </p>
          {importError && (
            <div role="alert">
              <Notice tone="error">{importError}</Notice>
            </div>
          )}
          <Button
            variant="secondary"
            disabled={!backupFile}
            loading={importing}
            onClick={() => void importSession()}
          >
            <Upload size={15} /> Importar respaldo JSON
          </Button>
        </section>
      </div>
    );
  return (
    <div className="settings-page">
      <PageHeader
        kicker={`Estación ${String(app.session.groupNumber).padStart(2, "0")} · tu laboratorio`}
        title="Dale vida a tu estación"
        subtitle="USB → sensores → programa. Tú eliges el ritmo de cada descubrimiento."
        art={
          <Icon
            name="board"
            size={84}
            className="text-accent"
            strokeWidth={1.3}
          />
        }
      />
      <nav
        className="mb-5 grid gap-3 sm:grid-cols-3"
        aria-label="Etapas de tu estación"
      >
        {(
          [
            [1, "Conecta tu placa", "Un clic para reconocerla por USB"],
            [2, "Elige tus sensores", "Activa los que acabas de conectar"],
            [3, "Instala tu estación", "Haz que el código se vuelva datos"],
          ] as const
        ).map(([number, title, description]) => (
          <button
            key={number}
            className={`flex min-h-24 items-center gap-3 rounded-xl border p-4 text-left transition duration-200 hover:-translate-y-0.5 ${stage === number ? "border-accent bg-highlight text-ink" : "border-border bg-surface text-ink-soft"}`}
            aria-current={stage === number ? "step" : undefined}
            onClick={() => setStage(number)}
          >
            <span
              aria-hidden="true"
              className={`grid size-10 shrink-0 place-items-center rounded-full font-display font-extrabold ${stage === number ? "bg-action text-action-ink" : "bg-surface-alt text-ink-accent"}`}
            >
              {number}
            </span>
            <span>
              <strong className="block text-sm">
                {number}. {title}
              </strong>
              <small className="mt-1 block text-xs">{description}</small>
            </span>
          </button>
        ))}
      </nav>
      {stage === 1 && (
        <div>
          <section className="settings-card">
            <div className="settings-card-title">
              <Usb size={20} />
              <h3>1. Conecta tu placa</h3>
              <Badge tone={app.connected ? "sage" : "neutral"}>
                {app.connected ? "USB CONECTADO" : "SIN CONEXIÓN USB"}
              </Badge>
            </div>
            <details className="simple-details">
              <summary>Modelo de placa · {BOARD_NAMES[app.board]}</summary>
              <label>
                Placa de trabajo
                <select
                  value={app.board}
                  disabled={app.connected || app.connecting || app.busy}
                  onChange={(e) =>
                    app.setBoard(e.target.value as typeof app.board)
                  }
                >
                  <option value="pico">
                    Raspberry Pi Pico W · MicroPython
                  </option>
                  <option value="uno">Arduino Uno · ATmega328P</option>
                  <option value="nano">Arduino Nano · ATmega328P</option>
                  <option value="nano-old">
                    Arduino Nano · bootloader antiguo
                  </option>
                </select>
              </label>
            </details>
            {!app.serialSupported && (
              <Notice tone="warning">
                Para conectar por USB, abre este taller en Chrome o Edge de
                escritorio. Puedes explorar y simular desde este navegador.
              </Notice>
            )}
            <p>
              Conecta el USB de tu placa al PC y pulsa «Conectar USB». El
              navegador te muestra los puertos; elegimos el protocolo de tu
              placa y, si el adaptador no informa el modelo, te pedimos elegirlo
              una vez.
            </p>
            <Button
              variant="secondary"
              loading={app.connecting}
              disabled={app.busy || app.connecting || !app.serialSupported}
              onClick={() =>
                void (app.connected ? app.disconnect() : app.connect())
              }
            >
              <Usb size={16} />
              {app.connected ? "Desconectar USB" : "Conectar USB"}
            </Button>
            {app.connected && (
              <Notice>
                <strong>{BOARD_NAMES[app.board]} conectada.</strong> Ya puedes
                elegir tus sensores.
              </Notice>
            )}
            <Button variant="ghost" onClick={() => setStage(2)}>
              Elegir mis sensores <ArrowRight size={16} />
            </Button>
            <details className="simple-details">
              <summary>Nombre y número de tu grupo</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void save();
                }}
              >
                <label>
                  Nombre del grupo
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={60}
                    required
                    minLength={1}
                  />
                </label>
                <label>
                  Estación
                  <select
                    value={group}
                    onChange={(e) => setGroup(Number(e.target.value))}
                  >
                    {Array.from({ length: 10 }, (_, i) => (
                      <option key={i} value={i + 1}>
                        Estación {String(i + 1).padStart(2, "0")}
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  type="submit"
                  variant="secondary"
                  loading={saving}
                  disabled={!name.trim()}
                >
                  <Save size={15} />
                  Guardar equipo
                </Button>
              </form>
            </details>
          </section>
        </div>
      )}
      {stage === 2 && (
        <section className="settings-card sensor-config">
          <div className="settings-card-title">
            <Radio size={21} />
            <h3>2. Elige tus sensores</h3>
          </div>
          <p>
            Toca los sensores de tu experimento. Cada selección añade sus
            lecturas al programa de estación.
          </p>
          {[false, true].map((advanced) => {
            const options = sensors
              .filter(
                (s) =>
                  s.id !== "air_humidity" &&
                  (advanced
                    ? !["soil", "air_temperature"].includes(s.id)
                    : ["soil", "air_temperature"].includes(s.id)),
              )
              .map((s) => {
                // Sensor IDs in the inventory are the canonical telemetry keys.
                // The DHT11 is one physical sensor and enables both measurements.
                const key = s.id;
                const isDht = key === "air_temperature";
                return (
                  <label className="sensor-toggle" key={s.id} data-sensor={key}>
                    <input
                      type="checkbox"
                      aria-label={s.name}
                      checked={
                        isDht
                          ? !!enabled.air_temperature && !!enabled.air_humidity
                          : !!enabled[key]
                      }
                      disabled={savingSensors || app.busy}
                      onChange={(e) => {
                        setSavingSensors(true);
                        void app
                          .updateSession({
                            sensorEnabled: {
                              ...enabled,
                              ...(isDht
                                ? {
                                    air_temperature: e.target.checked,
                                    air_humidity: e.target.checked,
                                  }
                                : { [key]: e.target.checked }),
                            },
                          })
                          .catch((err) => app.notify(err.message, true))
                          .finally(() => setSavingSensors(false));
                      }}
                    />
                    <span>
                      <strong>{s.name}</strong>
                      <small>
                        {s.model}
                        {isDht ? " · temperatura y humedad" : ""} ·{" "}
                        {arduino
                          ? (
                              {
                                soil: "A0",
                                soil_temperature: "D5",
                                air_temperature: "D4",
                                light: "A1",
                                rain: "D6",
                                water_level: "A2",
                                distance: "D7 TRIG · D8 ECHO",
                                motion: "D9",
                              } as Record<string, string>
                            )[key] || s.gpio
                          : s.gpio}
                      </small>
                    </span>
                    <span className="toggle-visual" />
                  </label>
                );
              });
            return advanced ? (
              <details className="simple-details" key="advanced-sensors">
                <summary>
                  Más sensores del kit
                  {advancedSensorCount
                    ? ` · ${advancedSensorCount} seleccionados`
                    : ""}
                </summary>
                <div className="enabled-sensors">{options}</div>
              </details>
            ) : (
              <div className="enabled-sensors" key="basic-sensors">
                {options}
              </div>
            );
          })}
          {!arduino && (enabled.distance || enabled.soil_temperature) && (
            <Notice>
              {enabled.distance &&
                "HC-SR04: conecta ECHO mediante el divisor resistivo. "}
              {enabled.soil_temperature &&
                "DS18B20: conecta dos resistencias de 10 kΩ en paralelo entre DATA y 3V3. "}
              Puedes tocar cada conexión en la vista 3D de su actividad.
            </Notice>
          )}
          <Button
            variant="secondary"
            onClick={() => setCalibration(!calibration)}
          >
            <Settings2 size={16} />
            {calibration ? "Cerrar calibración" : "Calibrar suelo y agua"}
          </Button>
          {calibration && <CalibrationTool />}
          <Button
            onClick={() => setStage(3)}
            disabled={savingSensors || !Object.values(enabled).some(Boolean)}
          >
            Continuar al programa <ArrowRight size={16} />
          </Button>
        </section>
      )}
      {stage === 3 && (
        <section className="settings-card connection-card">
          <div className="settings-card-title">
            <Wifi size={21} />
            <h3>3. Instala tu estación</h3>
            <Badge tone="sage">{arduino ? "PUENTE USB" : "PICO W"}</Badge>
          </div>
          <p>
            {arduino
              ? "El navegador recibe los sensores por USB y envía sus datos al servidor. Mantén esta pestaña abierta."
              : "La Pico W enviará sus lecturas al servidor aun si cierras el navegador. Las credenciales se escriben solo en tu placa."}
          </p>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!Object.values(enabled).some(Boolean)) {
                app.notify(
                  "Habilita al menos un sensor que hayas cableado.",
                  true,
                );
                return;
              }
              setInstallConfirm(true);
            }}
          >
            {!arduino && (
              <>
                <label>
                  Red Wi-Fi de 2,4 GHz
                  <input
                    value={ssid}
                    onChange={(e) => setSsid(e.target.value)}
                    required
                    maxLength={32}
                    autoComplete="off"
                    placeholder="Nombre de la red del taller"
                  />
                </label>
                <label>
                  Contraseña Wi-Fi
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="off"
                    maxLength={63}
                    placeholder="Nunca se guarda en el servidor"
                  />
                </label>
                <details className="simple-details">
                  <summary>Dirección del servidor · avanzado</summary>
                  <label>
                    Endpoint HTTPS de telemetría
                    <input
                      type="url"
                      value={endpoint}
                      onChange={(e) => setEndpoint(e.target.value)}
                      required
                      placeholder="https://taller.tudominio.cl/api/device/ingest"
                    />
                  </label>
                </details>
                {!endpoint.startsWith("https://") && (
                  <Notice tone="warning">
                    La dirección del servidor debe usar HTTPS. Abre «Dirección
                    del servidor» para corregirla; puedes usar la dirección de
                    este taller.
                  </Notice>
                )}
              </>
            )}
            <details className="simple-details">
              <summary>¿Qué programa se instala?</summary>
              <p>
                {arduino
                  ? "La estación reemplaza el sketch actual de Arduino y envía sus lecturas por USB. Tu borrador del editor se conserva."
                  : "La estación escribe main.py y su configuración en MicroPython, y envía tus lecturas por Wi-Fi y USB. Tu borrador del editor se conserva."}
              </p>
            </details>
            <Button
              type="submit"
              disabled={
                !app.connected ||
                savingSensors ||
                !Object.values(enabled).some(Boolean) ||
                (!arduino && !endpoint.startsWith("https://"))
              }
              loading={app.busy}
            >
              <Link2 size={16} />
              {arduino
                ? "Compilar e instalar estación USB"
                : "Vincular e instalar estación"}
            </Button>
          </form>
          {!app.connected && (
            <p>Conecta tu placa en el paso 1 para instalar.</p>
          )}
          {!Object.values(enabled).some(Boolean) && (
            <p>Selecciona al menos un sensor en el paso 2.</p>
          )}
          {!arduino && (
            <details className="simple-details">
              <summary>¿Cómo preparo MicroPython?</summary>
              <p>
                Mantén BOOTSEL al conectar USB, copia el firmware UF2 oficial de{" "}
                <a
                  href="https://micropython.org/download/RPI_PICO_W/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Pico W
                </a>{" "}
                a la unidad RPI-RP2 y vuelve a conectar desde esta web. No uses
                la imagen de Pico sin Wi-Fi.
              </p>
            </details>
          )}
          <Button variant="ghost" onClick={() => app.navigate("/planta")}>
            Ver mis lecturas <ArrowRight size={16} />
          </Button>
        </section>
      )}
      <details
        className="settings-card simple-details"
        onToggle={(event) => setPreviewOpen(event.currentTarget.open)}
      >
        <summary>
          Toca los pines de {BOARD_NAMES[app.board]} · explorador 3D y 2D
        </summary>
        {previewOpen && (
          <BoardDiscovery circuit={circuitForBoard(circuits.led, app.board)} />
        )}
      </details>
      <details className="settings-card simple-details">
        <summary>
          Dispositivos vinculados (
          {devices.filter((device) => !device.revoked).length})
        </summary>
        {devices.length ? (
          devices.map((d) => (
            <div className="device-row" data-device-id={d.id} key={d.id}>
              <div>
                <strong>{d.name || d.id.slice(0, 8)}</strong>
                <small>
                  {d.source === "simulation"
                    ? "Simulador educativo"
                    : "Hardware"}{" "}
                  ·{" "}
                  {d.lastSeen
                    ? new Date(d.lastSeen).toLocaleString("es-CL")
                    : "Sin lecturas"}
                </small>
              </div>
              <Button
                variant="ghost"
                disabled={d.revoked}
                onClick={() =>
                  void app
                    .revokeDevice(d.id)
                    .then(() => {
                      setDevices((current) =>
                        current.map((x) =>
                          x.id === d.id ? { ...x, revoked: true } : x,
                        ),
                      );
                    })
                    .catch((e) => app.notify(e.message, true))
                }
              >
                <Power size={14} />
                {d.revoked ? "Revocado" : "Revocar acceso"}
              </Button>
            </div>
          ))
        ) : (
          <p className="muted">
            Los dispositivos aparecerán al conectar USB o instalar la estación.
          </p>
        )}
      </details>
      <div className="privacy-panel">
        <div>
          <ShieldCheck size={21} />
          <h3>Tus datos pertenecen a tu equipo.</h3>
          <p>Descarga tu progreso y código antes de cambiar de equipo.</p>
        </div>
        <div>
          <Button
            variant="secondary"
            loading={exporting}
            onClick={() => void exportSession()}
          >
            <Download size={15} />
            Exportar mi sesión
          </Button>
          <details className="simple-details">
            <summary>Eliminar datos del grupo</summary>
            <p>
              La eliminación incluye progreso, código, lecturas y dispositivos.
            </p>
            <Button variant="danger" onClick={() => setDeleteModal(true)}>
              <Trash2 size={15} /> Eliminar sesión
            </Button>
          </details>
        </div>
      </div>
      {installConfirm && (
        <Modal
          title="Tu estación está a un clic"
          onClose={() => setInstallConfirm(false)}
        >
          <p>
            La instalación escribirá el programa de estación en tu placa. Tu
            borrador del editor sigue guardado en la web.
          </p>
          <Notice>
            {Object.values(enabled).filter(Boolean).length} variables activadas.
            Cuando termine, toca «Ver mis lecturas» para descubrir tu
            experimento.
          </Notice>
          <Button loading={app.busy} onClick={() => void install()}>
            Instalar en mi placa <ArrowRight size={16} />
          </Button>
        </Modal>
      )}
      {deleteModal && (
        <Modal
          title="Eliminar el espacio de tu grupo"
          onClose={() => setDeleteModal(false)}
        >
          <p>
            Se eliminarán tu progreso, código, calibraciones, dispositivos,
            lecturas y alertas. Esta acción no se puede deshacer.
          </p>
          <label>
            Escribe ELIMINAR para confirmar
            <input
              value={deleteWord}
              onChange={(e) => setDeleteWord(e.target.value)}
              autoComplete="off"
            />
          </label>
          <Button
            variant="danger"
            disabled={deleteWord !== "ELIMINAR"}
            loading={deleting}
            onClick={() => void remove()}
          >
            Eliminar todos mis datos
          </Button>
        </Modal>
      )}
    </div>
  );
}
