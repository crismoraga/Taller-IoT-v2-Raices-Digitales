import { lazy, Suspense, useState } from "react";
import { Backdrop, Icon, Medallion, type IconName } from "../brand/Graphics";
import {
  essentials,
  lessonById,
  lessons,
  lessonsOf,
  stages,
  type Lesson,
  type Stage,
} from "../content";
import { useApp } from "../lib/context";
import { useProgress } from "../lib/progress";
import { Button } from "../ui/Button";
import { Card, Segmented, Tag } from "../ui/Card";
import { Page, SectionHeader } from "../ui/Layout";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";

const LivingStation = lazy(() => import("../experience/LivingStation"));

const MOMENTS: {
  title: string;
  subtitle: string;
  lesson: string;
  icon: IconName;
}[] = [
  {
    title: "Una chispa",
    subtitle: "Enciende un LED. Cambia su ritmo.",
    lesson: "led",
    icon: "lightbulb",
  },
  {
    title: "Un sentido",
    subtitle: "Toca el suelo. Descubre una señal.",
    lesson: "soil",
    icon: "wave",
  },
  {
    title: "Una conexión",
    subtitle: "Tu planta envía datos a la web.",
    lesson: "cloud",
    icon: "wifi",
  },
];

/** La cadena completa que el taller construye, del mundo físico a la web. */
const CHAIN: { name: string; detail: string; icon: IconName }[] = [
  { name: "Planta", detail: "Un fenómeno físico", icon: "sprout" },
  { name: "Sensores", detail: "Lo convierten en señal", icon: "wave" },
  { name: "Pico W", detail: "Tu código la interpreta", icon: "cpu" },
  { name: "Wi-Fi", detail: "El dato viaja", icon: "wifi" },
  { name: "Datos", detail: "Se guardan en la nube", icon: "database" },
  { name: "Dashboard", detail: "Los ves y decides", icon: "chart" },
];

export default function Home() {
  const app = useApp();
  const progress = useProgress();
  const [view, setView] = useState<"express" | "full">(
    app.guided ? "express" : "full",
  );
  const open = (lesson: Lesson) =>
    app.session
      ? app.navigate(`/taller/${lesson.id}`)
      : app.openOnboarding(`/taller/${lesson.id}`);
  const started = app.session && progress.done.size > 0;
  const finished =
    progress.expressDone === progress.expressTotal && progress.expressTotal > 0;
  const duration = essentials.reduce(
    (minutes, lesson) => minutes + lesson.duration,
    0,
  );
  const routeStages = stages.filter((stage) => stage.id !== "explora");
  const chain = CHAIN.map((node, index) =>
    app.board === "pico"
      ? node
      : index === 2
        ? {
            name: "Arduino",
            detail: "Tu código la interpreta",
            icon: "cpu" as const,
          }
        : index === 3
          ? { name: "USB", detail: "Tu navegador envía", icon: "usb" as const }
          : node,
  );

  return (
    <Page className="experience-home" wide>
      {/* Portada */}
      <section className="living-hero relative isolate overflow-hidden rounded-2xl bg-night">
        <Backdrop pattern="estrellas" opacity={0.3} className="-z-10" />
        <div className="living-hero-grid">
          <div className="living-hero-copy animate-rise">
            <p className="t-overline flex items-center gap-2 text-accent">
              <span className="signal-dot" aria-hidden="true" />
              Raíces Digitales · Laboratorio vivo
            </p>
            <h1 className="living-hero-title mt-5 text-cream">
              Haz que tu
              <br />
              planta <span className="text-accent">hable.</span>
            </h1>
            <p className="mt-5 max-w-[43ch] text-[1.0625rem] leading-7 text-on-dark">
              {app.session
                ? `Hola, ${app.session.name}. Un cable, una línea de código, una nueva señal. Retoma tu estación y descubre qué está pasando bajo las hojas.`
                : "Empieza con un LED. Dale sentidos a una planta. Conecta su mundo al tuyo con electrónica, código y redes. Tú construyes cada conexión."}
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                variant="accent"
                iconRight="arrowRight"
                onClick={() =>
                  app.session
                    ? app.navigate(
                        progress.next
                          ? `/taller/${progress.next.id}`
                          : "/planta",
                      )
                    : app.openOnboarding()
                }
              >
                {!app.session
                  ? "Comenzar taller"
                  : finished && !progress.next
                    ? "Ver mi planta"
                    : started
                      ? "Retomar mi estación"
                      : "Comenzar taller"}
              </Button>
              <Button
                size="lg"
                variant="outlineLight"
                icon="flask"
                onClick={() => app.navigate("/explora")}
              >
                Explorar sin prisa
              </Button>
            </div>
            <ul className="mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-bold text-on-dark">
              <li className="flex items-center gap-2">
                <Icon name="clock" size={16} className="text-accent" />
                {duration} minutos · paso a paso
              </li>
              <li className="flex items-center gap-2">
                <Icon name="usb" size={16} className="text-accent" />
                Código real en tu placa
              </li>
              <li className="flex items-center gap-2">
                <Icon name="shieldCheck" size={16} className="text-accent" />
                Tu grupo, tu experimento
              </li>
            </ul>
            <div className="mt-7 flex items-center gap-3 border-t border-accent-soft/20 pt-4">
              <Icon name="cpu" size={22} className="text-pilar-teleco" />
              <p className="text-xs font-semibold leading-5 text-accent-soft">
                Ingeniería Civil Telemática · UTFSM
                <br />
                Hardware + software + redes. En una planta real.
              </p>
            </div>
          </div>
          <div className="living-hero-scene">
            <div className="living-scene-heading">
              <span className="t-overline text-accent-soft">
                Del suelo a la señal
              </span>
              <span className="font-mono text-[10px] text-accent-soft/80">
                ESTACIÓN / 01
              </span>
            </div>
            <Suspense
              fallback={
                <div className="scene-loading" role="status">
                  <Icon name="sprout" size={42} />
                  <span>Preparando tu laboratorio 3D…</span>
                </div>
              }
            >
              <LivingStation mode="hero" className="living-station-view" />
            </Suspense>
          </div>
        </div>

        {/* Cadena planta → dashboard */}
        <ol
          className="living-chain grid grid-cols-2 gap-px sm:grid-cols-3 xl:grid-cols-6"
          aria-label="Cómo viaja un dato de tu planta"
        >
          {chain.map((node, index) => (
            <li
              key={node.name}
              className="relative flex items-center gap-3 bg-primary-deep/45 px-3.5 py-4 animate-rise"
              style={{ animationDelay: `${index * 60}ms` }}
            >
              <span className="flex size-9 shrink-0 items-center justify-center text-accent">
                <Icon name={node.icon} size={20} />
              </span>
              <span className="min-w-0">
                <span className="block font-display text-[15px] font-bold leading-5 text-cream">
                  {node.name}
                </span>
                <span className="block truncate text-xs font-semibold leading-4 text-accent-soft">
                  {node.detail}
                </span>
              </span>
              {index < chain.length - 1 && (
                <Icon
                  name="chevronRight"
                  size={16}
                  className="absolute -right-[9px] top-1/2 z-10 hidden -translate-y-1/2 text-accent xl:block"
                />
              )}
            </li>
          ))}
        </ol>
      </section>

      <section
        className="journey-moments mt-6 grid gap-3 md:grid-cols-3"
        aria-label="Tu experimento crece en tres momentos"
      >
        {MOMENTS.map((moment, index) => {
          const lesson = lessonById(moment.lesson);
          if (!lesson) return null;
          return (
            <button
              type="button"
              key={moment.lesson}
              className="moment-card pressable focus-ring group"
              onClick={() => open(lesson)}
            >
              <span className="moment-number" aria-hidden="true">
                0{index + 1}
              </span>
              <span className="moment-content">
                <span className="t-overline text-ink-accent">
                  {index === 0
                    ? "Controla"
                    : index === 1
                      ? "Siente"
                      : "Conecta"}
                </span>
                <span className="t-heading mt-1 block text-ink">
                  {moment.title}
                </span>
                <span className="mt-1 block text-sm text-ink-soft">
                  {moment.subtitle}
                </span>
              </span>
              <Icon name={moment.icon} size={25} className="moment-icon" />
              <Icon
                name="arrowRight"
                size={16}
                className="self-end text-ink-accent transition-transform group-hover:translate-x-1"
              />
            </button>
          );
        })}
      </section>

      {/* La ruta */}
      <section className="mt-10" aria-labelledby="ruta">
        <SectionHeader
          kicker="Tu ruta"
          title={
            <span id="ruta">
              {view === "express"
                ? "De cero a una planta conectada"
                : "La ruta completa, etapa por etapa"}
            </span>
          }
          description={
            view === "express"
              ? `${essentials.length} actividades esenciales: observar, conectar, programar y comprobar. Cada paso prepara el siguiente.`
              : `${routeStages.length} etapas: de encender un LED a recibir alertas de tu planta. Explora cada sensor antes de integrarlo.`
          }
          actions={
            <Segmented
              label="Qué ruta ver"
              value={view}
              onChange={(value) => {
                setView(value);
                app.setGuided(value === "express");
              }}
              options={[
                {
                  value: "express",
                  label: `Guiada · ${duration} min`,
                  icon: "bolt",
                },
                { value: "full", label: "Completa", icon: "route" },
              ]}
            />
          }
        />
        {app.session && (
          <div className="route-status mt-4" role="status">
            <span className="t-overline text-ink-accent">Tu avance</span>
            <span className="font-bold text-ink">
              {progress.expressDone} / {progress.expressTotal} actividades
              registradas
            </span>
            <SegmentedProgress
              total={progress.expressTotal}
              done={progress.expressDone}
              onDark={false}
              label="Avance de la ruta guiada"
              className="min-w-[110px] flex-1"
            />
            <span className="text-xs text-ink-soft">
              {finished
                ? "Revisa tus lecturas en Mi planta."
                : "El avance se guarda para tu grupo."}
            </span>
          </div>
        )}
        {view === "express" ? (
          <ol className="mt-5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {essentials.map((lesson, index) => (
              <li key={lesson.id}>
                <LessonCard
                  lesson={lesson}
                  number={index + 1}
                  done={progress.done.has(lesson.id)}
                  current={progress.next?.id === lesson.id}
                  onOpen={() => open(lesson)}
                />
              </li>
            ))}
          </ol>
        ) : (
          <ol className="mt-5 flex flex-col gap-3.5">
            {routeStages.map((stage) => (
              <li key={stage.id}>
                <StageRow
                  stage={stage}
                  done={progress.done}
                  nextId={progress.next?.id}
                  onOpen={open}
                />
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Accesos */}
      <section
        className="mt-10 grid gap-3.5 md:grid-cols-3"
        aria-label="Más por hacer"
      >
        <Shortcut
          icon="sprout"
          title="Mi planta"
          text="Tus lecturas reales, sus cambios y sus alertas. El modo de práctica está identificado por separado."
          action="Abrir el dashboard"
          onClick={() => app.navigate("/planta")}
        />
        <Shortcut
          icon="flask"
          title="Zona Explora"
          text={`${lessons.filter((lesson) => lesson.stage === "explora").length} experimentos con componentes de tu kit. Prueba, cambia y descubre a tu ritmo.`}
          action="Ver experimentos"
          onClick={() => app.navigate("/explora")}
        />
        <Shortcut
          icon="stethoscope"
          title="¿Algo no funciona?"
          text="Revisa navegador, USB, Wi-Fi y cada sensor, uno por uno."
          action="Abrir diagnóstico"
          onClick={() => app.navigate("/diagnostico")}
        />
      </section>
      <p className="mt-7 max-w-3xl text-sm leading-6 text-ink-soft">
        El modelo 3D muestra una estación con Pico W; Arduino envía sus lecturas
        por USB a través de este navegador. Las conexiones eléctricas se
        comprueban en cada actividad antes de enchufar la placa. Los datos
        reales aparecen cuando conectas tu hardware.
      </p>
    </Page>
  );
}

function LessonCard({
  lesson,
  number,
  done,
  current,
  onOpen,
}: {
  lesson: Lesson;
  number: number;
  done: boolean;
  current: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cx(
        "lesson-route-card pressable focus-ring group flex h-full w-full flex-col rounded-lg border bg-surface p-[18px] text-left hover:shadow-soft",
        current
          ? "border-action ring-1 ring-action"
          : "border-border hover:border-border-strong",
      )}
    >
      <span className="flex items-center gap-3">
        <span
          className={cx(
            "flex size-11 shrink-0 items-center justify-center rounded-sm",
            done
              ? "bg-success-soft text-success-ink"
              : "bg-highlight text-ink-accent",
          )}
        >
          <Icon
            name={done ? "check" : lesson.icon}
            size={22}
            strokeWidth={done ? 2.6 : 2}
          />
        </span>
        <span className="route-card-number text-ink-soft">0{number}</span>
        <span className="ml-auto">
          {done ? (
            <Tag tone="success" icon="check">
              Completada
            </Tag>
          ) : current ? (
            <Tag tone="navy">Sigue aquí</Tag>
          ) : (
            <Tag tone="neutral" icon="clock">
              {lesson.duration} min
            </Tag>
          )}
        </span>
      </span>
      <span className="t-subtitle mt-4 block text-ink">{lesson.title}</span>
      <span className="mt-1.5 block flex-1 text-[15px] leading-[22px] text-ink-soft">
        {lesson.summary}
      </span>
      <span className="mt-4 flex items-center gap-1.5 text-sm font-bold text-ink-accent">
        {done ? "Repasar" : current ? "Continuar" : "Abrir actividad"}
        <Icon
          name="arrowRight"
          size={16}
          className="transition-transform group-hover:translate-x-1"
        />
      </span>
    </button>
  );
}

function StageRow({
  stage,
  done,
  nextId,
  onOpen,
}: {
  stage: Stage;
  done: Set<string>;
  nextId?: string;
  onOpen: (lesson: Lesson) => void;
}) {
  const list = lessonsOf(stage);
  const count = list.filter((lesson) => done.has(lesson.id)).length;
  const complete = list.length > 0 && count === list.length;
  return (
    <Card padded={false} className="overflow-hidden">
      <div className="flex items-center gap-4 p-[18px] sm:p-5">
        <Medallion
          glyph={stage.glyph}
          size={60}
          state={complete ? "unlocked" : count > 0 ? "progress" : "locked"}
          progress={list.length ? count / list.length : 0}
          tier={complete ? "oro" : "crema"}
          label={complete ? `Medalla de la ${stage.label} obtenida` : undefined}
        />
        <div className="min-w-0 flex-1">
          <p className="t-overline text-ink-accent">{stage.label}</p>
          <h3 className="t-heading text-ink">{stage.title}</h3>
          <p className="mt-0.5 text-sm leading-5 text-ink-soft">
            {stage.summary}
          </p>
        </div>
        <div className="hidden w-28 shrink-0 sm:block">
          <SegmentedProgress
            total={Math.max(list.length, 1)}
            done={count}
            onDark={false}
            label={`Avance de la ${stage.label}`}
          />
          <p className="tabular mt-1.5 text-right text-xs font-bold text-ink-soft">
            {count} de {list.length}
          </p>
        </div>
      </div>
      <ul className="border-t border-border">
        {list.map((lesson) => {
          const isDone = done.has(lesson.id);
          return (
            <li
              key={lesson.id}
              className="border-b border-border last:border-b-0"
            >
              <button
                type="button"
                onClick={() => onOpen(lesson)}
                className="focus-ring group flex min-h-14 w-full items-center gap-3.5 px-[18px] py-2.5 text-left transition-colors hover:bg-surface-alt sm:px-5"
              >
                <span
                  className={cx(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    isDone
                      ? "bg-success text-white"
                      : nextId === lesson.id
                        ? "bg-action text-action-ink"
                        : "bg-surface-alt text-ink-soft",
                  )}
                >
                  <Icon
                    name={isDone ? "check" : lesson.icon}
                    size={16}
                    strokeWidth={isDone ? 3 : 2}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="t-label block truncate text-[15px] text-ink">
                    {lesson.title}
                  </span>
                  <span className="block truncate text-[13px] leading-[18px] text-ink-soft">
                    {lesson.summary}
                  </span>
                </span>
                {lesson.essential && (
                  <Tag tone="gold" className="hidden sm:inline-flex">
                    Esencial
                  </Tag>
                )}
                <span className="tabular hidden w-14 text-right text-[13px] font-bold text-ink-soft sm:block">
                  {lesson.duration} min
                </span>
                <Icon
                  name="chevronRight"
                  size={18}
                  className="text-ink-soft transition-transform group-hover:translate-x-0.5"
                />
              </button>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Shortcut({
  icon,
  title,
  text,
  action,
  onClick,
}: {
  icon: IconName;
  title: string;
  text: string;
  action: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="pressable focus-ring group flex h-full flex-col rounded-lg border border-border bg-surface p-[18px] text-left hover:border-border-strong hover:shadow-soft"
    >
      <span className="flex size-11 items-center justify-center rounded-sm bg-highlight text-ink-accent">
        <Icon name={icon} size={22} />
      </span>
      <span className="t-subtitle mt-3.5 block text-ink">{title}</span>
      <span className="mt-1 block flex-1 text-[15px] leading-[22px] text-ink-soft">
        {text}
      </span>
      <span className="mt-3.5 flex items-center gap-1.5 text-sm font-bold text-ink-accent">
        {action}
        <Icon
          name="arrowRight"
          size={16}
          className="transition-transform group-hover:translate-x-1"
        />
      </span>
    </button>
  );
}
