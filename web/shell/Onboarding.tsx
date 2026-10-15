import { useEffect, useState } from "react";
import { BOARD_NAMES, useApp, type Board } from "../lib/context";
import { ARDUINO_BOARDS } from "../../shared/boards";
import { essentials } from "../content";
import { Button } from "../ui/Button";
import { Callout } from "../ui/Feedback";
import { Field, Input, Select } from "../ui/Form";
import { Disclosure } from "../ui/Layout";
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
  useEffect(() => {
    if (!open) setError(null);
  }, [open]);
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
      kicker="Tu estación viva"
      title="Armen su equipo"
      description="Pónganle un nombre a su aventura. Guardaremos aquí cada descubrimiento."
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
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
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
            hint={
              app.connected
                ? `USB conectado: ${BOARD_NAMES[app.board]}.`
                : app.board === "uno"
                  ? "Uno clásico · conecta USB, programa y comprueba cada paso."
                  : "Elige el modelo escrito en tu placa. Al conectar USB reconoceremos el adaptador compatible."
            }
          >
            {(props) => (
              <Select
                {...props}
                value={app.board}
                disabled={saving || app.connected || app.connecting || app.busy}
                onChange={(event) => app.setBoard(event.target.value as Board)}
              >
                {([...ARDUINO_BOARDS, "pico"] as Board[]).map((board) => (
                  <option key={board} value={board}>
                    {BOARD_NAMES[board]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
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
        </div>
        <Disclosure title="Opciones de la actividad" icon="route" tone="plain">
          <Field
            label="Cómo ver las actividades"
            hint="Primero descubre las conexiones; después enciende tu LED. Puedes cambiar la vista durante el taller."
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
                <option value="guided">Guiado · una cosa a la vez</option>
                <option value="full">Libre · todas las secciones juntas</option>
              </Select>
            )}
          </Field>
        </Disclosure>
        {error && (
          <Callout tone="danger" title="No pudimos crear el equipo" compact>
            {error}
          </Callout>
        )}
        <p className="text-sm leading-6 text-ink-soft">
          Entiende las conexiones y controla un LED. Prueba luz y aire; con esos
          dos sensores ya empiezas tu estación. Después añade el suelo y amplía
          tu maceta. {essentials.length} actividades, una a la vez.
        </p>
        {!app.serialSupported && (
          <Callout tone="warning" title="Programación por USB" compact>
            {app.usbHint} Puedes seguir el montaje y practicar en el simulador.
          </Callout>
        )}
        {app.board !== "pico" && app.health && !app.health.arduinoAvailable && (
          <Callout
            tone="info"
            title="La compilación se comprueba al cargar"
            compact
          >
            Puedes comenzar ahora. Al pulsar «Compilar y cargar» intentaremos
            preparar el programa y enviarlo a tu Arduino desde esta página.
          </Callout>
        )}
      </form>
    </Modal>
  );
}
