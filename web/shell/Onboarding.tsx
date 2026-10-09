import { useState } from "react";
import { Rutix } from "../brand/Graphics";
import { useApp } from "../lib/context";
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
      description="Una planta, una placa y su propio espacio de trabajo. Elijan la estación y empiecen a construir."
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
      </form>
    </Modal>
  );
}
