import { useState } from "react";
import { Rutix } from "../brand/Graphics";
import { BOARD_NAMES, useApp, type Board } from "../lib/context";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Feedback";
import { Field, Input, Select } from "../ui/Form";
import { Modal } from "../ui/Overlay";

/**
 * Crear el espacio del grupo: sesión anónima, sin correo ni datos personales.
 * Solo se pide (opcionalmente) un nombre de equipo y el número de estación.
 */
export function Onboarding({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const app = useApp();
  const [name, setName] = useState("");
  const [group, setGroup] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await app.createSession(name, group);
      onClose();
    } catch (problem) {
      setError(
        problem instanceof Error && problem.message
          ? problem.message
          : "No pudimos crear el grupo. Revisa la conexión e inténtalo otra vez.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      tone="navy"
      kicker="Antes de empezar"
      title="Armen su equipo"
      description="Elijan su placa y recorrido. Su equipo tendrá un espacio para guardar código, progreso y mediciones."
      dismissable={!saving}
      footer={
        <Button
          type="submit"
          form="onboarding-form"
          size="lg"
          iconRight="arrowRight"
          loading={saving}
          fullWidth
        >
          Comenzar el taller
        </Button>
      }
    >
      <form
        id="onboarding-form"
        className="flex flex-col gap-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <div className="flex items-end gap-3">
          <span className="flex size-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-night ring-2 ring-accent/35">
            <Rutix expression="happy" pose="wave" size={68} shadow={false} />
          </span>
          <p className="rounded-[18px] rounded-bl-sm bg-cream px-4 py-3 text-[15px] font-semibold leading-[22px] text-primary">
            ¡Hola! Soy Rutix. No necesito tu correo ni tu nombre real: solo cómo
            se llama el equipo.
          </p>
        </div>
        <Field
          label="Nombre del equipo"
          optional
          hint="Lo verán ustedes y el docente."
        >
          {(props) => (
            <Input
              {...props}
              autoFocus
              value={name}
              maxLength={60}
              autoComplete="off"
              disabled={saving}
              placeholder="Por ejemplo, Los Clorofilos"
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Placa del equipo"
            hint="La guía y el código se adaptan a este modelo."
          >
            {(props) => (
              <Select
                {...props}
                value={app.board}
                disabled={saving}
                onChange={(event) => app.setBoard(event.target.value as Board)}
              >
                {(Object.keys(BOARD_NAMES) as Board[]).map((board) => (
                  <option key={board} value={board}>
                    {BOARD_NAMES[board]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field
            label="Recorrido del equipo"
            hint="Puedes cambiarlo durante el taller."
          >
            {(props) => (
              <Select
                {...props}
                value={app.guided ? "guided" : "full"}
                disabled={saving}
                onChange={(event) =>
                  app.setGuided(event.target.value === "guided")
                }
              >
                <option value="guided">Guiado · 6 actividades · 60 min</option>
                <option value="full">Completo · a tu ritmo</option>
              </Select>
            )}
          </Field>
        </div>
        <Field
          label="Número de estación"
          hint="Es el número que tiene su mesa o su kit."
        >
          {(props) => (
            <Select
              {...props}
              value={group}
              disabled={saving}
              onChange={(event) => setGroup(Number(event.target.value))}
            >
              {Array.from({ length: 10 }, (_, index) => (
                <option key={index} value={index + 1}>
                  Estación {String(index + 1).padStart(2, "0")}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {error && (
          <Callout tone="danger" title="No pudimos crear el equipo" compact>
            {error}
          </Callout>
        )}
        <Callout tone="tip" title="Un navegador por grupo" compact>
          Este navegador recupera el avance, el código y los datos de su grupo.
          El docente puede acompañarlos; otros grupos tienen su propio espacio.
        </Callout>
        <Callout
          tone={app.serialSupported ? "info" : "warning"}
          title="Con kit o con práctica"
          compact
        >
          Para programar la placa, usa Chrome o Edge de escritorio y un cable
          USB de datos. Sin kit puedes seguir la guía, editar código y practicar
          en el simulador de Mi planta; sus datos se identifican como
          Simulación.
        </Callout>
        {app.board !== "pico" && app.health && !app.health.arduinoAvailable && (
          <Callout tone="info" title="Carga del código Arduino" compact>
            En esta instalación, descarga el sketch y cárgalo con Arduino IDE.
            Después puedes conectar USB para ver y enviar las lecturas de tu
            placa.
          </Callout>
        )}
      </form>
    </Modal>
  );
}
