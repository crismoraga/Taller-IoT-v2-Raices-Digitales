import { useEffect, useMemo, useRef, useState } from "react";
import {
  initialPlantSensors,
  normalizePlantSensors,
  PLANT_SENSORS,
  plantSensorFlags,
  type PlantSensorId,
} from "../circuit/plantStation";
import { useApp } from "../lib/context";
import { compatibleCalibration } from "../lib/calibration";
import { readLocal, writeLocal } from "../lib/theme";
import { ConnectButton } from "../shell/ConnectButton";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Checkbox } from "../ui/Form";
import { Disclosure } from "../ui/Layout";
import { cx } from "../ui/cx";

export function usePlantStationSelection(includeSoil = false) {
  const app = useApp();
  const storageKey = `raices.station.sensors.${app.session?.id ?? "anon"}`;
  const read = () =>
    initialPlantSensors(
      readLocal<unknown>(storageKey, undefined),
      app.session?.sensorEnabled,
    );
  const [stored, setStored] = useState<PlantSensorId[]>(read);
  useEffect(() => {
    setStored(read());
  }, [storageKey]);
  const selected = useMemo(
    () =>
      includeSoil && !stored.includes("soil")
        ? normalizePlantSensors([...stored, "soil"])!
        : stored,
    [stored, includeSoil],
  );
  const update = (next: readonly PlantSensorId[]) => {
    const normalized = normalizePlantSensors(next) ?? [];
    setStored(normalized);
    writeLocal(storageKey, normalized);
  };
  return { selected, update };
}

export function PlantStationSetup({
  selected,
  onChange,
  onConnect,
}: {
  selected: readonly PlantSensorId[];
  onChange: (next: PlantSensorId[]) => void;
  onConnect: () => void;
}) {
  const app = useApp();
  const [inspected, setInspected] = useState<PlantSensorId>(
    selected[0] ?? "light",
  );
  const sensor = PLANT_SENSORS.find((item) => item.id === inspected)!;
  return (
    <Card
      as="section"
      className="mt-4 space-y-3"
      aria-label="Sensores de mi estación"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="t-overline text-ink-accent">
            La maceta entra al taller
          </p>
          <h2 className="t-heading mt-1 text-ink">
            Empieza con luz y aire; crece de uno en uno
          </h2>
          <p className="mt-1 text-sm text-ink-soft">
            Conserva el LED. Elige sólo los sensores que vas a conectar.
          </p>
        </div>
        <Button size="sm" variant="outline" icon="cable" onClick={onConnect}>
          Conectar mi estación paso a paso
        </Button>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Sensores seleccionados">
        {PLANT_SENSORS.filter((item) => selected.includes(item.id)).map(
          (item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={inspected === item.id}
              className={cx(
                "focus-ring min-h-11 rounded-pill border px-3 text-sm font-bold transition-colors",
                inspected === item.id
                  ? "border-action bg-action text-action-ink"
                  : "border-border bg-surface-alt text-ink",
              )}
              onClick={() => setInspected(item.id)}
            >
              {item.short}
            </button>
          ),
        )}
        {!selected.length && (
          <p className="text-sm text-ink-soft">
            Sólo el LED por ahora. Añade tu primer sensor abajo.
          </p>
        )}
      </div>
      {selected.includes(inspected) && (
        <div className="rounded-md bg-highlight p-3 text-sm leading-6 text-ink">
          <p className="font-bold">{sensor.label} · Dónde colocarlo</p>
          <p>{sensor.placement}</p>
          <Button
            size="sm"
            variant="ghost"
            icon="cable"
            onClick={() => app.navigate(`/taller/${sensor.lesson}`)}
          >
            Conectar sólo este sensor
          </Button>
          <Disclosure title="Cómo comprobarlo" tone="plain" icon="checkCircle">
            <p>{sensor.response}</p>
          </Disclosure>
        </div>
      )}
      <Disclosure title="Añadir o quitar un sensor" icon="flask" tone="plain">
        <p className="mb-3 text-sm text-ink-soft">
          Añade uno, sigue sus conexiones e instala de nuevo. El plano y el
          programa usan esta misma selección.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {PLANT_SENSORS.map((item) => (
            <Checkbox
              key={item.id}
              checked={selected.includes(item.id)}
              onChange={(checked) => {
                onChange(
                  checked
                    ? [...selected, item.id]
                    : selected.filter((id) => id !== item.id),
                );
                if (checked) setInspected(item.id);
              }}
            >
              {item.label}
            </Checkbox>
          ))}
        </div>
      </Disclosure>
    </Card>
  );
}

/** The physical profile and uploaded driver flags are always the same selection. */
export function StationInstaller({
  selected,
  onRemember,
  afterCalibration = false,
}: {
  selected: readonly PlantSensorId[];
  onRemember: (selected: readonly PlantSensorId[]) => void;
  afterCalibration?: boolean;
}) {
  const app = useApp();
  const [attempted, setAttempted] = useState(false);
  const [following, setFollowing] = useState(true);
  const soilCalibrated = compatibleCalibration(
    app.session?.calibrations.soil,
    app.board,
  );
  const terminal = useRef<HTMLPreElement>(null);
  useEffect(() => {
    const output = terminal.current;
    if (output && following) output.scrollTop = output.scrollHeight;
  }, [app.terminal, following]);
  const install = () => {
    setAttempted(true);
    onRemember(selected);
    return app.installStation(
      "",
      "",
      `${location.origin}/api/device/ingest`,
      plantSensorFlags(selected),
    );
  };
  return (
    <Card
      as="section"
      className="flex flex-col gap-4"
      aria-labelledby="install-plant-station"
    >
      <div>
        <p className="t-overline text-ink-accent">
          {afterCalibration
            ? "El suelo se une a tu planta"
            : "Tus sensores juntos"}
        </p>
        <h3 id="install-plant-station" className="t-heading mt-1 text-ink">
          {afterCalibration
            ? soilCalibrated
              ? "Actualiza la estación con tu suelo calibrado"
              : "Incorpora el suelo a tu estación"
            : "Instala tu estación por USB"}
        </h3>
        <p className="mt-2 text-sm leading-6 text-ink-soft">
          {afterCalibration
            ? soilCalibrated
              ? "Esta carga reúne tu sonda, las referencias guardadas y los sensores de tu estación. "
              : "Puedes instalar para ver el RAW del suelo; guarda después ambas referencias y vuelve a instalar para aplicar tu porcentaje. "
            : "El programa leerá únicamente los sensores de tu selección. "}
          Mantén USB y esta página abiertos para verlos en Mi planta.
        </p>
        <p
          className="mt-2 text-sm font-bold text-ink"
          aria-label="Sensores que se instalarán"
        >
          {PLANT_SENSORS.filter((item) => selected.includes(item.id))
            .map((item) => item.short)
            .join(" · ") || "LED"}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        {!app.connected && <ConnectButton size="lg" />}
        <Button
          variant="accent"
          icon="board"
          size="lg"
          loading={app.busy}
          disabled={!app.connected || app.connecting || app.busy}
          onClick={() => void install()}
        >
          {afterCalibration
            ? "Actualizar estación con suelo"
            : "Instalar sensores conectados"}
        </Button>
        <Button
          variant="outline"
          iconRight="arrowRight"
          onClick={() => app.navigate("/planta")}
        >
          Ver lecturas de mi planta
        </Button>
      </div>
      {attempted && app.uploadStatus && (
        <p
          role="status"
          className={cx(
            "text-sm font-semibold",
            app.uploadStatus.stage === "error"
              ? "text-danger-ink"
              : "text-ink-soft",
          )}
        >
          {app.uploadStatus.message}
          {typeof app.uploadStatus.percent === "number"
            ? ` · ${Math.round(app.uploadStatus.percent)} %`
            : ""}
        </p>
      )}
      {!afterCalibration && (
        <div>
          <h4 className="t-label mb-2 text-ink">Terminal serial</h4>
          <pre
            ref={terminal}
            role="log"
            aria-label="Salida de la placa"
            aria-live="off"
            onScroll={() => {
              const output = terminal.current;
              if (output)
                setFollowing(
                  output.scrollHeight - output.scrollTop - output.clientHeight <
                    32,
                );
            }}
            className="scrollbar-thin h-44 overflow-auto whitespace-pre-wrap break-all rounded-md bg-code p-3 font-mono text-xs leading-5 text-cream-soft"
          >
            {app.terminal ||
              "Al instalar aparecerán aquí las lecturas de tus sensores."}
          </pre>
          {!following && (
            <Button
              variant="ghost"
              size="sm"
              icon="arrowDown"
              onClick={() => setFollowing(true)}
            >
              Volver a lecturas en vivo
            </Button>
          )}
        </div>
      )}
      <Disclosure
        title="Ajustar sensores o conexión · opcional"
        icon="settings"
        tone="plain"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => app.navigate("/estacion")}
        >
          Abrir ajustes de estación
        </Button>
      </Disclosure>
    </Card>
  );
}
