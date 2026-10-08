import { useState, useEffect } from "react";
import {
  Wifi,
  Usb,
  Download,
  Save,
  Trash2,
  ShieldCheck,
  Radio,
  Link2,
  ArrowRight,
  KeyRound,
  Settings2,
  Leaf,
  Power,
} from "lucide-react";
import { useApp } from "../lib/context";
import { api, post, type DashboardData } from "../lib/api";
import { sensors } from "../data/lessons";
import {
  PageHeading,
  Button,
  Notice,
  Badge,
  Modal,
  EmptyState,
} from "../components/Common";
import CalibrationWizard from "../components/CalibrationWizard";
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
    [calibration, setCalibration] = useState(false);
  const arduino = app.board !== "pico";
  useEffect(() => {
    setName(app.session?.name || "");
    setGroup(app.session?.groupNumber || 1);
    if (app.session)
      void api<DashboardData>("/dashboard")
        .then((d) => setDevices(d.devices))
        .catch(() => {});
  }, [app.session?.id]);
  const enabled = app.session?.sensorEnabled || {};
  const save = async () => {
    try {
      await app.updateSession({ name, groupNumber: group });
      app.notify("Datos del grupo guardados.");
    } catch (e) {
      app.notify((e as Error).message, true);
    }
  };
  const install = async () => {
    setInstallConfirm(false);
    await app.installStation(ssid, password, endpoint);
    setPassword("");
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
  if (!app.session)
    return (
      <div className="settings-page">
        <PageHeading
          eyebrow="TU ESTACIÓN, A TU MANERA"
          title="Preparemos tu equipo."
          description="Crea tu grupo para configurar placa, sensores y red."
        />
        <EmptyState
          title="Empecemos por darle un nombre."
          description="Cada grupo tiene su propio espacio, sin datos personales."
          action={
            <Button onClick={app.openOnboarding}>
              Crear mi grupo <ArrowRight size={16} />
            </Button>
          }
        />
      </div>
    );
  return (
    <div className="settings-page">
      <PageHeading
        eyebrow="TU ESTACIÓN, A TU MANERA"
        title="El siguiente paso: conectar."
        description="Prepara el hardware, calibra y dale a tu planta un camino hacia Internet."
      />
      <div className="settings-grid">
        <section className="settings-card">
          <div className="settings-card-title">
            <Leaf size={20} />
            <h3>Tu equipo</h3>
          </div>
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
            <Button type="submit" variant="secondary">
              <Save size={15} />
              Guardar equipo
            </Button>
          </form>
          <div className="settings-divider" />
          <label>
            Placa de trabajo
            <select
              value={app.board}
              onChange={(e) => app.setBoard(e.target.value as typeof app.board)}
            >
              <option value="pico">Raspberry Pi Pico W · MicroPython</option>
              <option value="uno">Arduino Uno · ATmega328P</option>
              <option value="nano">Arduino Nano · ATmega328P</option>
              <option value="nano-old">
                Arduino Nano · bootloader antiguo
              </option>
            </select>
          </label>
          <Button
            variant="secondary"
            onClick={() =>
              void (app.connected ? app.disconnect() : app.connect())
            }
          >
            <Usb size={16} />
            {app.connected ? "Desconectar USB" : "Conectar USB"}
          </Button>
        </section>
        <section className="settings-card connection-card">
          <div className="settings-card-title">
            <Wifi size={21} />
            <h3>
              {arduino ? "La estación Arduino por USB" : "Wi-Fi y telemetría"}
            </h3>
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
                {!endpoint.startsWith("https://") && (
                  <Notice tone="warning">
                    La Pico necesita un endpoint HTTPS accesible desde su red.
                    Para pruebas locales, configura un dominio con TLS;
                    localhost identifica a la propia placa.
                  </Notice>
                )}
              </>
            )}
            <Notice>
              <strong>Antes de cargar:</strong> instala MicroPython en Pico W,
              conecta únicamente los sensores habilitados y verifica las
              protecciones. La instalación reemplaza main.py y los archivos de
              estación.
            </Notice>
            <Button
              type="submit"
              disabled={
                !app.connected || (!arduino && !endpoint.startsWith("https://"))
              }
              loading={app.busy}
            >
              <Link2 size={16} />
              {arduino
                ? "Compilar e instalar estación USB"
                : "Vincular e instalar estación"}
            </Button>
          </form>
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
              a la unidad RPI-RP2 y vuelve a conectar desde esta web. No uses la
              imagen de Pico sin Wi-Fi.
            </p>
          </details>
        </section>
      </div>
      <section className="settings-card sensor-config">
        <div className="settings-card-title">
          <Radio size={21} />
          <h3>Los sentidos de tu estación</h3>
        </div>
        <p>
          Habilita solo los sensores físicamente conectados. Sus fallos se
          gestionan individualmente. Los tres ADC de Pico se reservan para
          suelo, luz y nivel de agua.
        </p>
        <div className="enabled-sensors">
          {sensors
            .filter((s) => s.id !== "air_humidity")
            .map((s) => {
              const key =
                s.id === "dht11"
                  ? "dht11"
                  : s.id === "ds18b20"
                    ? "soil_temperature"
                    : s.id === "ldr"
                      ? "light"
                      : s.id;
              return (
                <label className="sensor-toggle" key={s.id}>
                  <input
                    type="checkbox"
                    checked={!!enabled[key]}
                    onChange={(e) =>
                      void app
                        .updateSession({
                          sensorEnabled: {
                            ...enabled,
                            [key]: e.target.checked,
                            ...(key === "air_temperature"
                              ? { air_humidity: e.target.checked }
                              : {}),
                          },
                        })
                        .catch((err) => app.notify(err.message, true))
                    }
                  />
                  <span>
                    <strong>{s.name}</strong>
                    <small>
                      {s.model} · {s.gpio}
                    </small>
                  </span>
                  <span className="toggle-visual" />
                </label>
              );
            })}
        </div>
        <Notice tone="warning">
          HC-SR04 en Pico: ECHO pasa por divisor resistivo. DS18B20: dos
          resistencias de 10 kΩ en paralelo a 3V3. Verifica el esquema de cada
          actividad antes de habilitarlos.
        </Notice>
        <Button
          variant="secondary"
          onClick={() => setCalibration(!calibration)}
        >
          <Settings2 size={16} />
          {calibration ? "Cerrar calibración" : "Calibrar suelo y agua"}
        </Button>
        {calibration && <CalibrationWizard />}
      </section>
      <section className="settings-card">
        <div className="settings-card-title">
          <ShieldCheck size={20} />
          <h3>Dispositivos vinculados</h3>
        </div>
        {devices.length ? (
          devices.map((d) => (
            <div className="device-row" key={d.id}>
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
                      setDevices(
                        devices.map((x) =>
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
      </section>
      <div className="privacy-panel">
        <div>
          <ShieldCheck size={21} />
          <h3>Tus datos pertenecen a tu equipo.</h3>
          <p>
            Sin correo, RUT ni trackers. Exporta tu progreso o elimina la sesión
            y toda su telemetría.
          </p>
        </div>
        <div>
          <Button
            variant="secondary"
            onClick={() => window.location.assign("/api/session/export")}
          >
            <Download size={15} />
            Exportar mi sesión
          </Button>
          <Button variant="danger" onClick={() => setDeleteModal(true)}>
            <Trash2 size={15} />
            Eliminar sesión
          </Button>
        </div>
      </div>
      {installConfirm && (
        <Modal
          title="¿Todo está listo en la protoboard?"
          onClose={() => setInstallConfirm(false)}
        >
          <p>
            La instalación escribirá el programa de estación en tu placa. Tu
            borrador del editor sigue guardado en la web.
          </p>
          <Notice>
            Revisa GND común, alimentación y sensores habilitados. No cambies
            cables con la alimentación conectada.
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
