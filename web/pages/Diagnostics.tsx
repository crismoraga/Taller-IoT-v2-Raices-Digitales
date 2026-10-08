import { useState, useEffect } from "react";
import {
  CheckCircle2,
  XCircle,
  Usb,
  ShieldCheck,
  Cloud,
  Activity,
  Download,
  Stethoscope,
  Terminal,
  ArrowRight,
} from "lucide-react";
import { useApp } from "../lib/context";
import { api, download, sensorLabels, statusLabels } from "../lib/api";
import { serial } from "../lib/serial";
import { PageHeading, Button, Notice, Badge } from "../components/Common";
export default function Diagnostics() {
  const app = useApp();
  const [health, setHealth] = useState<Record<string, unknown>>({}),
    [deviceInfo, setDeviceInfo] = useState<Record<string, unknown>>({}),
    [testing, setTesting] = useState(false);
  useEffect(() => {
    void api("/health")
      .then(setHealth)
      .catch(() => setHealth({ ok: false }));
  }, []);
  const probe = async () => {
    setTesting(true);
    try {
      if (!app.connected || app.board !== "pico")
        throw new Error(
          "La consulta de MicroPython requiere Pico conectada por USB. Arduino reporta diagnósticos con el sketch de estación.",
        );
      const result = await serial.exec(
        "import sys, gc, machine, json, time\nd={'micropython':sys.version,'board':sys.implementation._machine,'freeMemory':gc.mem_free(),'uptime':time.ticks_ms(),'adc0':machine.ADC(26).read_u16(),'adc1':machine.ADC(27).read_u16(),'adc2':machine.ADC(28).read_u16()}\ntry:\n import network\n w=network.WLAN(network.STA_IF)\n d['wifi']=w.isconnected()\n d['rssi']=w.status('rssi') if w.isconnected() else None\nexcept Exception:\n d['wifi']=False\nprint('DIAG:'+json.dumps(d))",
      );
      const m = result.match(/DIAG:(\{[^\r\n]+\})/);
      if (!m)
        throw new Error("No se pudo consultar la placa. Revisa la terminal.");
      setDeviceInfo(JSON.parse(m[1]));
      app.notify("Información real de tu Pico recibida.");
    } catch (e) {
      app.notify((e as Error).message, true);
    } finally {
      setTesting(false);
    }
  };
  const checks = [
    {
      title: "Contexto seguro",
      detail: window.isSecureContext
        ? "HTTPS o localhost válido"
        : "Usa HTTPS para acceder al puerto USB.",
      ok: window.isSecureContext,
      Icon: ShieldCheck,
    },
    {
      title: "Web Serial",
      detail:
        "serial" in navigator
          ? "Navegador compatible con conexión USB."
          : "Usa Chrome o Edge de escritorio; descarga código para Thonny/Arduino IDE.",
      ok: "serial" in navigator,
      Icon: Usb,
    },
    {
      title: "Puerto USB",
      detail: app.connected
        ? "Placa conectada por selección de usuario."
        : "Conecta un cable de datos y cierra otros monitores seriales.",
      ok: app.connected,
      Icon: Terminal,
    },
    {
      title: "Servidor",
      detail: health.ok
        ? "API y almacenamiento disponibles."
        : "No se recibió respuesta. El editor y USB pueden seguir funcionando.",
      ok: !!health.ok,
      Icon: Cloud,
    },
    {
      title: "Compilador Arduino",
      detail: health.arduinoAvailable
        ? "Compilador disponible en el servidor."
        : "Ejecuta scripts/setup-arduino.ps1 en el servidor del taller; alternativa: Arduino IDE.",
      ok: !!health.arduinoAvailable,
      Icon: Activity,
    },
    {
      title: "Telegram",
      detail: health.telegramConfigured
        ? "Bot configurado por el docente."
        : "El docente puede configurar el bot de la clase desde su panel.",
      ok: !!health.telegramConfigured,
      Icon: Cloud,
    },
  ];
  const info = { ...app.lastDiagnostics, ...deviceInfo };
  return (
    <div className="diagnostics-page">
      <PageHeading
        eyebrow="SI ALGO FALLA, APRENDER TAMBIÉN ES INVESTIGAR"
        title="Cada conexión tiene una pista."
        description="Comprueba navegador, placa, red y sensores con información real."
        action={
          <Button
            variant="secondary"
            onClick={() =>
              download(
                "diagnostico-raices.json",
                JSON.stringify(
                  {
                    at: new Date().toISOString(),
                    checks: checks.map(({ title, ok, detail }) => ({
                      title,
                      ok,
                      detail,
                    })),
                    device: info,
                    readings: app.localReadings,
                  },
                  null,
                  2,
                ),
                "application/json",
              )
            }
          >
            <Download size={15} />
            Exportar diagnóstico
          </Button>
        }
      />
      <div className="diagnostic-checks">
        {checks.map(({ title, detail, ok, Icon }) => (
          <section
            className={`diagnostic-card ${ok ? "passed" : ""}`}
            key={title}
          >
            <div>
              <Icon size={21} />
              {ok ? <CheckCircle2 size={18} /> : <XCircle size={18} />}
            </div>
            <h3>{title}</h3>
            <p>{detail}</p>
            <Badge tone={ok ? "sage" : "neutral"}>
              {ok ? "DISPONIBLE" : "POR REVISAR"}
            </Badge>
          </section>
        ))}
      </div>
      <div className="diagnostics-actions">
        <Button onClick={() => void app.connect()} disabled={app.connected}>
          <Usb size={16} />
          Conectar mi placa
        </Button>
        <Button
          variant="secondary"
          onClick={() => void probe()}
          disabled={!app.connected || app.board !== "pico"}
          loading={testing}
        >
          <Stethoscope size={16} />
          Consultar Pico
        </Button>
        <Button variant="ghost" onClick={() => app.navigate("/configuracion")}>
          Configurar estación <ArrowRight size={16} />
        </Button>
      </div>
      <Notice>
        La consulta detiene el programa actual para leer el intérprete. Los
        valores ADC no demuestran por sí solos que un sensor esté conectado.
        Luego vuelve a ejecutar la estación.
      </Notice>
      <section className="settings-card">
        <div className="settings-card-title">
          <Activity size={20} />
          <h3>Lo que reporta la placa</h3>
        </div>
        {Object.keys(info).length ? (
          <dl className="diagnostic-values">
            {Object.entries(info).map(([key, value]) => (
              <div key={key}>
                <dt>{key}</dt>
                <dd>
                  {typeof value === "object"
                    ? JSON.stringify(value)
                    : String(value ?? "Sin lectura")}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="muted">
            Consulta una Pico o ejecuta el firmware de estación. Aquí verás
            versión, ADC, memoria libre, uptime y estado de Wi-Fi.
          </p>
        )}
      </section>
      <section className="settings-card">
        <div className="settings-card-title">
          <Activity size={20} />
          <h3>Estado individual de sensores</h3>
        </div>
        {app.localReadings.length ? (
          <div className="sensor-status-table">
            {app.localReadings.map((r) => (
              <div key={r.sensor}>
                <strong>{sensorLabels[r.sensor] || r.sensor}</strong>
                <Badge tone={r.status === "READING" ? "sage" : "neutral"}>
                  {statusLabels[r.status] || r.status}
                </Badge>
                <span>
                  {r.error || r.confidence || "Sin confirmación adicional"}
                </span>
                <code>
                  {r.raw != null
                    ? `ADC ${r.raw}`
                    : r.value != null
                      ? `${r.value} ${r.unit}`
                      : "—"}
                </code>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">
            Los sensores aparecerán al recibir las líneas JSON del firmware. No
            se generan lecturas automáticamente.
          </p>
        )}
      </section>
      <section className="troubleshooting-list">
        <h2>Soluciones para seguir creciendo.</h2>
        {[
          {
            q: "El puerto USB no aparece.",
            a: "Usa un cable USB con datos. Cierra Thonny, Arduino IDE y otras pestañas que usen el puerto. Comprueba el dispositivo en el sistema operativo. MicroPython debe estar instalado en Pico W.",
          },
          {
            q: "El DHT11 o DS18B20 no responde.",
            a: "Revisa VCC, GND y DATA. DHT11 bare necesita pull-up de 10 kΩ. DS18B20 necesita dos de 10 kΩ en paralelo entre DATA y 3V3. DHT11 se lee con al menos 2 segundos entre muestras.",
          },
          {
            q: "La Pico no se conecta al Wi-Fi.",
            a: "Usa una red 2,4 GHz sin portal cautivo. Verifica SSID y contraseña. El firmware sigue leyendo sensores por USB si la red falla. Usa hotspot dedicado como alternativa.",
          },
          {
            q: "El envío HTTPS falla.",
            a: "El dominio debe ser público y tener certificado válido. La instalación sincroniza la hora de la placa y copia la CA. Revisa la terminal, DNS y firewall. No uses localhost como endpoint de la Pico.",
          },
          {
            q: "La humedad no parece correcta.",
            a: "Calibra las referencias seca y húmeda del sensor. Es una escala relativa a tu sustrato. Valores pegados al límite ADC necesitan revisión; no prueban desconexión por sí solos.",
          },
          {
            q: "¿Por qué no veo lux ni una puntuación de salud?",
            a: "El fotoresistor del kit mide iluminación relativa sin calibración fotométrica. El dashboard muestra tus variables y umbrales sin inventar unidades ni conclusiones fisiológicas.",
          },
        ].map(({ q, a }) => (
          <details key={q}>
            <summary>{q}</summary>
            <p>{a}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
