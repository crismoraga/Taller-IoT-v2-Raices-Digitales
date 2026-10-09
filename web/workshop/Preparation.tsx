import { useEffect, useState } from "react";
import { Icon } from "../brand/Graphics";
import { essentials } from "../content";
import { useApp } from "../lib/context";
import { readLocal, writeLocal } from "../lib/theme";
import { Button, LinkButton } from "../ui/Button";
import { Card, Tag } from "../ui/Card";
import { Checkbox } from "../ui/Form";

const PREPARATION = [
  {
    id: "computer",
    title: "Computador y cable USB de datos",
    detail:
      "Chrome o Edge de escritorio para programar. El teléfono sirve para leer la guía y consultar datos.",
  },
  {
    id: "materials",
    title: "Placa, protoboard y componentes",
    detail:
      "Pico W o Uno/Nano; LED, resistencia de 220 Ω, cables, sonda capacitiva y tierra seca/húmeda. Revisa los materiales de cada actividad.",
  },
  {
    id: "team",
    title: "Equipo y seguridad",
    detail:
      "Una persona cablea, otra lee y otra comprueba; roten los roles. Desconecten la alimentación al cambiar cables.",
  },
] as const;

function readPreparation(storage: string): string[] {
  const saved = readLocal<unknown>(storage, []);
  return Array.isArray(saved)
    ? saved.filter(
        (id): id is string =>
          typeof id === "string" && PREPARATION.some((item) => item.id === id),
      )
    : [];
}

/** A small, local checklist helps teams prepare without gating the lessons. */
export function Preparation() {
  const app = useApp();
  const storage = `raices.preparation.${app.session?.id ?? "anon"}`;
  const [checked, setChecked] = useState<string[]>(() =>
    readPreparation(storage),
  );
  useEffect(() => setChecked(readPreparation(storage)), [storage]);
  const toggle = (id: string, value: boolean) => {
    const next = value
      ? [...new Set([...checked, id])]
      : checked.filter((candidate) => candidate !== id);
    setChecked(next);
    writeLocal(storage, next);
  };
  const duration = essentials.reduce(
    (total, lesson) => total + lesson.duration,
    0,
  );

  return (
    <Card as="section" className="mt-6" aria-labelledby="prepara-taller">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="t-overline text-ink-accent">Antes del primer cable</p>
          <h2 id="prepara-taller" className="t-title mt-1 text-ink">
            Tu taller de hoy, de inicio a fin
          </h2>
          <p className="mt-2 max-w-3xl text-[15px] leading-6 text-ink-soft">
            En la ruta de {duration} minutos encenderás un LED, medirás y
            calibrarás el suelo, enviarás datos y comprobarás una alerta. Al
            terminar podrás explicar el viaje de una medición hasta Mi planta.
          </p>
        </div>
        <Tag tone="sky" icon="clock">
          {duration} min estimados
        </Tag>
      </div>
      <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div>
          <h3 className="t-label text-ink">Prepara tu mesa</h3>
          <ul className="mt-1 divide-y divide-border">
            {PREPARATION.map((item) => (
              <li key={item.id}>
                <Checkbox
                  checked={checked.includes(item.id)}
                  onChange={(value) => toggle(item.id, value)}
                  className="py-3"
                >
                  <span className="block font-bold">{item.title}</span>
                  <span className="mt-1 block text-[13px] font-normal leading-5 text-ink-soft">
                    {item.detail}
                  </span>
                </Checkbox>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-md bg-surface-alt p-4">
          <h3 className="t-label text-ink">El ritmo del taller</h3>
          <ol className="mt-3 grid gap-2">
            {essentials.map((lesson, index) => (
              <li key={lesson.id} className="flex items-baseline gap-2 text-sm">
                <span className="font-mono font-bold text-ink-accent">
                  0{index + 1}
                </span>
                <span className="min-w-0 flex-1 text-ink">{lesson.title}</span>
                <span className="shrink-0 text-xs text-ink-soft">
                  {lesson.duration} min
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-xs leading-5 text-ink-soft">
            Sigue Entiende → Conecta → Programa → Experimenta → Comprueba. Los
            tiempos son una orientación: avanza cuando puedas explicar el
            resultado.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center">
        <Icon
          name={app.serialSupported ? "usb" : "help"}
          size={20}
          className="shrink-0 text-ink-accent"
        />
        <p className="min-w-0 flex-1 text-sm leading-5 text-ink-soft">
          {app.serialSupported
            ? "Este navegador permite USB. Si falta hardware, puedes leer, editar código y practicar con datos de simulación en Mi planta."
            : "Este navegador permite recorrer el taller. Para conectar USB usa Chrome o Edge de escritorio; también puedes practicar con el simulador de Mi planta."}
        </p>
        <Button
          size="sm"
          variant="outline"
          icon="stethoscope"
          onClick={() => app.navigate("/diagnostico")}
        >
          Revisar mi equipo
        </Button>
      </div>
      <div className="mt-4 border-t border-border pt-4">
        <h3 className="t-label text-ink">Lleva las guías contigo</h3>
        <p className="mt-1 text-sm leading-5 text-ink-soft">
          Descarga los pasos del taller y sus soluciones para consultarlos con
          tu equipo.
        </p>
        <nav
          aria-label="Guías descargables del taller"
          className="mt-3 flex flex-wrap gap-2"
        >
          <LinkButton
            size="sm"
            variant="subtle"
            icon="download"
            href="/docs/STUDENT_GUIDE.md"
            download="raices-guia-estudiante.md"
          >
            Guía estudiante
          </LinkButton>
          <LinkButton
            size="sm"
            variant="subtle"
            icon="download"
            href="/docs/TROUBLESHOOTING.md"
            download="raices-soluciones.md"
          >
            Soluciones y diagnóstico
          </LinkButton>
          <LinkButton
            size="sm"
            variant="subtle"
            icon="download"
            href="/docs/TEACHER_GUIDE.md"
            download="raices-guia-docente.md"
          >
            Guía docente
          </LinkButton>
        </nav>
      </div>
    </Card>
  );
}

export function FinalReview() {
  const app = useApp();
  return (
    <Card as="section" tone="sky" aria-labelledby="demostracion-final">
      <p className="t-overline text-ink-accent">Entrega del equipo</p>
      <h2 id="demostracion-final" className="t-heading mt-1 text-ink">
        Demuestra lo que construiste
      </h2>
      <ol className="mt-3 flex list-decimal flex-col gap-2 pl-5 text-sm leading-6 text-ink">
        <li>
          En Mi planta, muestra dos lecturas recientes de tu dispositivo con
          origen Hardware y su unidad.
        </li>
        <li>
          Explica cómo calibraste el suelo y qué cambia al mover la sonda entre
          tus dos referencias.
        </li>
        <li>
          Crea una regla, cruza su umbral y comprueba la alerta y su
          recuperación. Telegram requiere la configuración del docente.
        </li>
        <li>
          Exporta el CSV de tus mediciones y comparte con el equipo una decisión
          que esos datos te ayuden a tomar.
        </li>
      </ol>
      <p className="mt-3 text-xs leading-5 text-ink-soft">
        Si trabajaste sin placa, presenta tu código y el experimento de
        Simulación. El montaje y las mediciones físicas quedan pendientes de
        comprobar con el kit. En Uno/Nano, mantén esta página y el USB abiertos
        para enviar datos.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button size="sm" icon="chart" onClick={() => app.navigate("/planta")}>
          Abrir Mi planta
        </Button>
        <Button
          size="sm"
          variant="outline"
          icon="board"
          onClick={() => app.navigate("/estacion")}
        >
          Revisar estación
        </Button>
      </div>
    </Card>
  );
}
