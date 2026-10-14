import { useEffect, useRef, useState } from "react";
import { Copy, Download, Terminal } from "lucide-react";
import { Button } from "../components/Common";
import { post } from "../lib/api";
import { useApp } from "../lib/context";
import {
  PI_SENSORS,
  piBridgeCommand,
  piCheckCommand,
  type PiSensor,
} from "../lib/raspberry-pi";

export function RaspberryPiTools() {
  const app = useApp();
  const currentSession = useRef(app.session?.id);
  currentSession.current = app.session?.id;
  const [sensor, setSensor] = useState<PiSensor>("dht11");
  const [port, setPort] = useState("/dev/ttyACM0");
  const [pairing, setPairing] = useState<{
    code: string;
    expiresAt: string;
  } | null>(null);
  const [pairingBusy, setPairingBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState("");
  const definition = PI_SENSORS[sensor];
  useEffect(() => {
    setPairing(null);
    setError("");
  }, [app.session?.id]);
  useEffect(() => {
    if (!pairing) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= Date.parse(pairing.expiresAt)) setPairing(null);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [pairing]);
  const pair = async () => {
    if (pairingBusy) return;
    setPairingBusy(true);
    setError("");
    const sessionId = currentSession.current;
    try {
      const result = await post<{ code: string; expiresAt: string }>(
        "/pair",
        {},
      );
      if (currentSession.current === sessionId) {
        setNow(Date.now());
        setPairing(result);
      }
    } catch (problem) {
      if (currentSession.current === sessionId)
        setError(
          problem instanceof Error
            ? problem.message
            : "No se pudo generar el código. Vuelve a intentar.",
        );
    } finally {
      setPairingBusy(false);
    }
  };
  const copy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      app.notify("Comando copiado para la terminal de tu Raspberry Pi.");
    } catch {
      app.notify("Selecciona el comando y cópialo con Ctrl+C.", "info");
    }
  };
  let bridgeCommand = "";
  if (pairing)
    try {
      bridgeCommand = piBridgeCommand(location.origin, pairing.code, port);
    } catch {
      // An invalid port or a development HTTP origin never makes a runnable command.
    }
  return (
    <details className="settings-card simple-details">
      <summary>Raspberry Pi 3 / 4 · comprobar sensores · opcional</summary>
      <p className="mt-3">
        Prueba un sensor conectado al GPIO de tu Raspberry Pi, sin Arduino. Esta
        herramienta es independiente del recorrido principal del taller.
      </p>
      <label>
        Sensor que quieres comprobar en la Pi
        <select
          aria-label="Sensor para Raspberry Pi"
          value={sensor}
          onChange={(event) => setSensor(event.target.value as PiSensor)}
        >
          {Object.entries(PI_SENSORS).map(([id, entry]) => (
            <option key={id} value={id}>
              {entry.label}
            </option>
          ))}
        </select>
      </label>
      <ol className="my-3 grid gap-2 pl-5 text-sm">
        {definition.connections.map((connection) => (
          <li key={connection}>{connection}</li>
        ))}
      </ol>
      {definition.note && <p className="text-sm">{definition.note}</p>}
      {definition.adc && (
        <p className="text-sm">
          La Pi no tiene entradas analógicas. Esta prueba necesita un MCP3008
          conectado por SPI; sin ese ADC, el programa informa que la lectura no
          está disponible. VDD y VREF a 3V3, AGND y DGND a GND; CLK a BCM11 (pin
          23), DOUT a BCM9 (21), DIN a BCM10 (19) y CS a BCM8 (24).
        </p>
      )}
      <a
        className="button secondary mt-3"
        href="/downloads/check_sensors.py"
        download="check_sensors.py"
      >
        <Download size={16} /> Descargar comprobador GPIO
      </a>
      <p className="mt-3 text-sm">
        Ejecuta este comando en la carpeta donde descargaste el archivo en la
        Pi. Verás las lecturas en su terminal; Ctrl+C termina la prueba.
      </p>
      <pre className="my-3 overflow-x-auto rounded-lg bg-code p-3 text-sm text-cream-soft">
        <code>{piCheckCommand(sensor)}</code>
      </pre>
      <Button
        variant="secondary"
        onClick={() => void copy(piCheckCommand(sensor))}
      >
        <Copy size={15} /> Copiar comando del sensor
      </Button>
      <details className="simple-details">
        <summary>Primera ejecución en Raspberry Pi OS</summary>
        <pre className="my-3 overflow-x-auto rounded-lg bg-code p-3 text-xs text-cream-soft">
          <code>
            {"sudo apt install python3-gpiozero python3-venv libgpiod2\n" +
              (sensor === "dht11"
                ? "python3 -m venv --system-site-packages .venv\n.venv/bin/pip install adafruit-circuitpython-dht"
                : sensor === "ds18b20"
                  ? "sudo raspi-config nonint do_onewire 0"
                  : definition.adc
                    ? "sudo raspi-config nonint do_spi 0"
                    : "")}
          </code>
        </pre>
        {(sensor === "ds18b20" || definition.adc) && (
          <p className="text-sm">
            Reinicia la Pi después de activar esa interfaz.
          </p>
        )}
      </details>
      <details className="simple-details">
        <summary>Usar Raspberry Pi como PC o puente USB para Arduino</summary>
        <p className="mt-2 text-sm">
          En Raspberry Pi OS abre esta web en Chromium y conecta Arduino por
          USB. Elige Arduino Uno o Nano como placa; la Pi es el computador.
        </p>
        <p className="text-sm">
          Para publicar sin dejar el navegador abierto, instala primero la
          estación en Arduino y desconecta su puerto del navegador. Este puente
          mantiene las lecturas de USB en «Mi planta».
        </p>
        <a
          className="button secondary"
          href="/downloads/raspberry-pi-bridge.py"
          download="raspberry-pi-bridge.py"
        >
          <Download size={15} /> Descargar puente USB
        </a>
        <p className="mt-2 text-sm">
          Dependencia en la Pi: <code>sudo apt install python3-serial</code>.
        </p>
        <label>
          Puerto de Arduino en la Pi
          <input
            value={port}
            aria-label="Puerto Arduino en Raspberry Pi"
            placeholder="/dev/ttyACM0 o /dev/ttyUSB0"
            maxLength={240}
            onChange={(event) => setPort(event.target.value)}
          />
        </label>
        <Button
          variant="secondary"
          disabled={!/^\/dev\/[A-Za-z0-9_./-]+$/.test(port)}
          loading={pairingBusy}
          onClick={() => void pair()}
        >
          <Terminal size={15} /> Generar código para el puente USB
        </Button>
        {error && <p role="alert">{error}</p>}
        {pairing && (
          <div role="status" className="mt-3">
            <p className="text-sm">
              Código de un uso · vence en{" "}
              {Math.max(
                0,
                Math.ceil((Date.parse(pairing.expiresAt) - now) / 1000),
              )}{" "}
              s. Ejecútalo en la Pi.
            </p>
            {bridgeCommand ? (
              <>
                <pre className="my-3 overflow-x-auto rounded-lg bg-code p-3 text-xs text-cream-soft">
                  <code>{bridgeCommand}</code>
                </pre>
                <Button
                  variant="secondary"
                  onClick={() => void copy(bridgeCommand)}
                >
                  <Copy size={15} /> Copiar comando del puente USB
                </Button>
              </>
            ) : (
              <p className="text-sm">
                Usa la web HTTPS y revisa el puerto de Arduino.
              </p>
            )}
          </div>
        )}
      </details>
    </details>
  );
}
