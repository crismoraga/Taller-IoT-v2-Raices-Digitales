import { useState, useEffect, useRef } from "react";
import {
  CheckCircle2,
  Circle,
  LoaderCircle,
  RefreshCw,
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
import { Icon } from "../brand/Graphics";
import { PageHeader } from "../ui/Layout";
import { api, download, sensorLabels, statusLabels } from "../lib/api";
import { Button, Notice, Badge } from "../components/Common";
export default function Diagnostics() {
  const app = useApp();
  const [health, setHealth] = useState<Record<string, unknown>>({}),
    [deviceInfo, setDeviceInfo] = useState<Record<string, unknown>>({}),
    [testing, setTesting] = useState(false),
    [checkingHealth, setCheckingHealth] = useState(true),
    [healthFailed, setHealthFailed] = useState(false);
  const healthRequest = useRef(0);
  const checkHealth = async () => {
    const request = ++healthRequest.current;
    setCheckingHealth(true);
    setHealthFailed(false);
    try {
      const result = await api("/health");
      if (request === healthRequest.current) setHealth(result);
    } catch {
      if (request === healthRequest.current) setHealthFailed(true);
    } finally {
      if (request === healthRequest.current) setCheckingHealth(false);
    }
  };
  useEffect(() => {
    void checkHealth();
    return () => {
      healthRequest.current += 1;
    };
  }, []);
  useEffect(() => setDeviceInfo({}), [app.board]);
  const probe = async () => {
    setTesting(true);
    try {
      if (!app.connected || app.board !== "pico")
        throw new Error(
          "La consulta de MicroPython requiere Pico conectada por USB. Arduino reporta diagnósticos con el sketch de estación.",
        );
      const result = await app.queryPico(
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
      title: "Página del taller",
      detail: window.isSecureContext
        ? "El navegador puede conectar tu placa desde esta página."
        : "Abre la dirección HTTPS del taller para conectar tu placa.",
      ok: window.isSecureContext,
      Icon: ShieldCheck,
    },
    {
      title: "USB del navegador",
      detail: app.serialSupported
        ? "Navegador compatible con conexión USB."
        : (app.usbHint ?? "USB no está disponible en esta pestaña."),
      ok: app.serialSupported,
      Icon: Usb,
    },
    {
      title: "Puerto USB",
      detail: app.connected
        ? "Tu placa está conectada."
        : "Conecta tu placa al PC y pulsa «Conectar mi placa».",
      ok: app.connected,
      label: app.connected ? "CONECTADO" : "CONECTA TU PLACA",
      Icon: Terminal,
    },
    {
      title: "Servidor",
      detail: checkingHealth
        ? "Comprobando conexión y almacenamiento…"
        : !healthFailed && health.ok
          ? "Tus datos se pueden guardar."
          : "No se recibió respuesta. Reintenta; el editor y USB siguen disponibles.",
      ok: checkingHealth ? null : !healthFailed && !!health.ok,
      Icon: Cloud,
    },
    {
      title: "Compilador Arduino",
      detail: checkingHealth
        ? "Comprobando disponibilidad…"
        : healthFailed
          ? "Pendiente de recuperar la conexión al servidor."
          : health.arduinoAvailable
            ? "Compilador disponible en el servidor."
            : "Puedes descargar el código y usar Arduino IDE. Avísale al docente si necesitas compilar desde esta web.",
      ok: checkingHealth || healthFailed ? null : !!health.arduinoAvailable,
      optional: app.board === "pico",
      Icon: Activity,
    },
    {
      title: "Telegram",
      detail: checkingHealth
        ? "Comprobando configuración…"
        : healthFailed
          ? "Puedes continuar el taller sin Telegram."
          : health.telegramConfigured
            ? "Bot configurado por el docente."
            : "Opcional. El docente puede activar avisos para la clase.",
      ok: checkingHealth || healthFailed ? null : !!health.telegramConfigured,
      optional: true,
      Icon: Cloud,
    },
  ];
  const info = { ...app.lastDiagnostics, ...deviceInfo };
  const readings = app.localReadings.filter(
    (reading) => reading.status !== "DISABLED",
  );
  const renderCheck = ({
    title,
    detail,
    ok,
    Icon,
    optional,
    label,
  }: (typeof checks)[number]) => (
    <section className={`diagnostic-card ${ok ? "passed" : ""}`} key={title}>
      <div>
        <Icon size={21} />
        {ok ? (
          <CheckCircle2 size={18} />
        ) : ok === null ? (
          checkingHealth ? (
            <LoaderCircle size={18} className="spin" />
          ) : (
            <Circle size={18} />
          )
        ) : optional ? (
          <Circle size={18} />
        ) : (
          <ArrowRight size={18} />
        )}
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      <Badge tone={ok ? "sage" : "neutral"}>
        {label ||
          (ok === null
            ? checkingHealth
              ? "COMPROBANDO"
              : "PENDIENTE"
            : ok
              ? "DISPONIBLE"
              : optional
                ? "OPCIONAL"
                : "POR REVISAR")}
      </Badge>
    </section>
  );
  return (
    <div className="diagnostics-page">
      <PageHeader
        kicker="Descubre · sigue la señal"
        title="Conexión del experimento"
        subtitle="Placa → navegador → tu planta. Veamos cómo viaja tu dato."
        art={
          <Icon
            name="stethoscope"
            size={84}
            className="text-accent"
            strokeWidth={1.3}
          />
        }
        actions={
          <Button
            variant="hero"
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
      <div
        className="mb-5 grid gap-3 sm:grid-cols-3"
        aria-label="Recorrido de una lectura"
      >
        {[
          [
            "01",
            "Tu placa",
            app.connected
              ? "USB conectado · la señal empieza aquí"
              : "Conecta USB para empezar",
            app.connected,
          ],
          [
            "02",
            "Este navegador",
            app.serialSupported
              ? "Recibe y muestra tus lecturas"
              : "Puedes explorar el modelo y simular",
            app.serialSupported,
          ],
          [
            "03",
            "Tu planta",
            health.ok
              ? "Guarda la historia de tu experimento"
              : "Comprobando el espacio de tu grupo",
            !!health.ok,
          ],
        ].map(([number, title, detail, active]) => (
          <div
            key={String(number)}
            className={`rounded-xl border p-4 ${active ? "border-accent/50 bg-highlight" : "border-border bg-surface"}`}
          >
            <span className="t-overline text-ink-accent">{number}</span>
            <h2 className="mt-2 font-display text-lg font-bold text-ink">
              {title}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{detail}</p>
          </div>
        ))}
      </div>
      <details className="settings-card simple-details">
        <summary>Ver la conexión paso a paso</summary>
        <div className="diagnostic-checks">
          {checks.slice(0, 4).map(renderCheck)}
        </div>
      </details>
      {!checkingHealth &&
        !healthFailed &&
        app.board !== "pico" &&
        !health.arduinoAvailable && (
          <Notice tone="warning">
            El compilador Arduino no está disponible. Puedes descargar tu
            programa y cargarlo con Arduino IDE; avísale al docente para
            recuperar la compilación web.
          </Notice>
        )}
      <div className="diagnostics-actions">
        <Button
          onClick={() => void app.connect()}
          disabled={
            app.connected || app.busy || app.connecting || !app.serialSupported
          }
        >
          <Usb size={16} />
          Conectar mi placa
        </Button>
        {app.board === "pico" && (
          <Button
            variant="secondary"
            onClick={() => void probe()}
            disabled={!app.connected || app.board !== "pico" || app.busy}
            loading={testing}
          >
            <Stethoscope size={16} />
            Consultar Pico
          </Button>
        )}
        <Button
          variant="secondary"
          onClick={() => void checkHealth()}
          loading={checkingHealth}
        >
          <RefreshCw size={16} /> Reintentar servidor
        </Button>
        <Button variant="ghost" onClick={() => app.navigate("/estacion")}>
          Configurar estación <ArrowRight size={16} />
        </Button>
      </div>
      {app.board === "pico" && app.connected && (
        <Notice>
          La consulta toma una fotografía de tu Pico. Después vuelve a ejecutar
          el programa de estación para seguir recibiendo lecturas.
        </Notice>
      )}
      <details className="settings-card simple-details">
        <summary>Servicios adicionales · Arduino y Telegram</summary>
        <div className="diagnostic-checks">
          {checks.slice(4).map(renderCheck)}
        </div>
      </details>
      <details className="settings-card simple-details">
        <summary>Información técnica de la placa</summary>
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
            {app.board === "pico"
              ? "Consulta tu Pico o ejecuta la estación para ver su versión, memoria y estado de Wi-Fi."
              : "Ejecuta la estación Arduino para recibir su información por USB."}
          </p>
        )}
      </details>
      <section className="settings-card">
        <div className="settings-card-title">
          <Activity size={20} />
          <h3>Estado individual de sensores</h3>
        </div>
        {readings.length ? (
          <div className="sensor-status-table">
            {readings.map((r) => (
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
            Ejecuta el programa de estación. La primera lectura USB hará
            aparecer tu sensor y su señal aquí.
          </p>
        )}
      </section>
      <section className="troubleshooting-list">
        <h2>Soluciones rápidas</h2>
        {[
          {
            q: "El puerto USB no aparece.",
            a:
              app.board === "pico"
                ? "Usa un cable USB con datos. Cierra Thonny, Arduino IDE y otras pestañas que usen el puerto. Comprueba el dispositivo en el sistema operativo. MicroPython debe estar instalado en Pico W."
                : "Usa un cable USB con datos. Cierra Arduino IDE y otras pestañas que usen el puerto. Comprueba el dispositivo en el sistema operativo. Si usas Nano, selecciona el bootloader correspondiente en Estación.",
          },
          {
            q: "El DHT11 o DS18B20 no responde.",
            a: `Sigue VCC → GND → DATA en el esquema de la actividad. El DHT11 sin módulo necesita una resistencia de 10 kΩ entre DATA y alimentación. El DS18B20 necesita dos de 10 kΩ en paralelo entre DATA y ${app.board === "pico" ? "3V3" : "5 V"}. Espera al menos 2 segundos entre lecturas del DHT11.`,
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
        ]
          .filter(
            ({ q }) =>
              app.board === "pico" ||
              (!q.includes("Pico") && !q.includes("HTTPS")),
          )
          .map(({ q, a }) => (
            <details key={q}>
              <summary>{q}</summary>
              <p>{a}</p>
            </details>
          ))}
      </section>
    </div>
  );
}
