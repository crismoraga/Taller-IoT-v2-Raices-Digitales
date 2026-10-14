import { lazy, Suspense } from "react";
import { Icon } from "../brand/Graphics";
import {
  essentials,
  lessonsOf,
  stages,
  type Lesson,
  type Stage,
} from "../content";
import { useApp } from "../lib/context";
import { useProgress } from "../lib/progress";
import { Button } from "../ui/Button";
import { Segmented, Tag } from "../ui/Card";
import { Page } from "../ui/Layout";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";
import { FinalReview } from "../workshop/Preparation";
import { resumeWorkshop, workshopRoute } from "../workshop/flow";

const LivingStation = lazy(() => import("../experience/LivingStation"));

/** A living, touchable entry point into the workshop. */
export default function Home() {
  const app = useApp();
  const progress = useProgress();
  const route = workshopRoute(app.guided);
  const completedSteps = route.flatMap((lesson, index) =>
    progress.done.has(lesson.id) ? [index] : [],
  );
  const done = completedSteps.length;
  const finished = done === route.length;
  const resume = resumeWorkshop(app.guided, progress.done);
  const duration = route.reduce(
    (minutes, lesson) => minutes + lesson.duration,
    0,
  );
  const open = (lesson: Lesson) =>
    app.session
      ? app.navigate(`/taller/${lesson.id}`)
      : app.openOnboarding(`/taller/${lesson.id}`);

  return (
    <Page wide className="experience-home home-solarpunk">
      <section
        className="workshop-welcome solar-hero bg-night"
        aria-labelledby="welcome-title"
      >
        <div className="workshop-welcome-copy">
          <span className="solar-live-badge">
            <span aria-hidden="true" /> Un laboratorio vivo
          </span>
          <p className="t-overline mt-6 text-accent">
            Taller IoT · Telemática USM
          </p>
          <h1 id="welcome-title" className="workshop-welcome-title text-cream">
            Haz que tu planta <span className="solar-title-light">hable.</span>
          </h1>
          <p className="mt-3 max-w-[46ch] text-base leading-6 text-on-dark">
            {app.session
              ? finished
                ? `${app.session.name}, ya completaron la ruta. Es momento de ver qué cuenta su planta.`
                : `${app.session.name}, continuemos. Conecta, programa y comprueba una cosa a la vez.`
              : "Tu kit está listo. Conecta tu placa por USB y descubre una planta que siente, se comunica y cobra vida. Un cable, un paso y un hallazgo a la vez."}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
            <Button
              size="lg"
              variant="accent"
              iconRight="arrowRight"
              className="solar-start-button"
              onClick={() =>
                app.session
                  ? app.navigate(resume ? `/taller/${resume.id}` : "/planta")
                  : app.openOnboarding()
              }
            >
              {!app.session || done === 0
                ? "Comenzar taller"
                : finished
                  ? "Ver mi planta"
                  : "Continuar taller"}
            </Button>
            <span className="inline-flex items-center gap-2 text-sm text-on-dark">
              <Icon name="clock" size={16} />
              {duration} minutos ·{" "}
              {app.guided ? "paso a paso" : "ruta completa"}
            </span>
          </div>
          <p className="solar-kit-note">
            <Icon name="usb" size={17} /> Arduino Uno y Nano · USB desde tu PC
            <span className="sr-only">
              . También compatible con Raspberry Pi Pico.
            </span>
          </p>
        </div>
        <div className="solar-hero-world">
          <Suspense
            fallback={
              <div className="scene-loading" role="status">
                <img
                  src="/brand/raices-station.svg"
                  alt=""
                  width={170}
                  height={154}
                />
                <span>Tu laboratorio está despertando…</span>
              </div>
            }
          >
            <LivingStation
              mode="hero"
              board={app.board}
              className="living-station-view"
            />
          </Suspense>
        </div>
      </section>

      <section className="solar-route-section mt-7" aria-labelledby="ruta">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 id="ruta" className="t-heading text-ink">
              Pequeños pasos. Grandes descubrimientos.
            </h2>
            <p className="mt-1 text-sm text-ink-soft">
              {app.guided
                ? "Desde encender una luz hasta escuchar a tu planta. Toca una actividad para entrar."
                : "Abre una etapa para ver sus actividades."}
            </p>
          </div>
          <Segmented
            label="Qué ruta ver"
            value={app.guided ? "express" : "full"}
            onChange={(value) => app.setGuided(value === "express")}
            options={[
              { value: "express", label: "Guiada", icon: "route" },
              { value: "full", label: "Completa", icon: "book" },
            ]}
          />
        </div>
        {app.session && (
          <div className="mt-4 flex items-center gap-3 text-sm text-ink-soft">
            <span className="shrink-0 tabular">
              {done} de {route.length} completadas
            </span>
            <SegmentedProgress
              total={route.length}
              done={completedSteps}
              current={route.findIndex((lesson) => lesson.id === resume?.id)}
              onDark={false}
              label="Avance de tu ruta"
              className="max-w-64 flex-1"
            />
          </div>
        )}
        {app.guided ? (
          <ol
            className="home-route mt-4"
            aria-label="Actividades de la ruta guiada"
          >
            {essentials.map((lesson, index) => (
              <li key={lesson.id}>
                <LessonRow
                  lesson={lesson}
                  number={index + 1}
                  done={progress.done.has(lesson.id)}
                  current={resume?.id === lesson.id}
                  onOpen={() => open(lesson)}
                />
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {stages
              .filter((stage) => stage.id !== "explora")
              .map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  done={progress.done}
                  nextId={resume?.id}
                  onOpen={open}
                />
              ))}
          </div>
        )}
      </section>

      {app.session && finished && (
        <div className="mt-5">
          <FinalReview />
        </div>
      )}

      <nav
        className="home-utilities mt-4"
        aria-label="Más herramientas del taller"
      >
        <button
          type="button"
          className="focus-ring"
          onClick={() => app.navigate("/explora")}
        >
          <Icon name="flask" size={17} /> Más experimentos
        </button>
        <button
          type="button"
          className="focus-ring"
          onClick={() => app.navigate("/diagnostico")}
        >
          <Icon name="stethoscope" size={17} /> Necesito ayuda
        </button>
      </nav>
    </Page>
  );
}

function LessonRow({
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
      aria-current={current ? "step" : undefined}
      className={cx(
        "home-lesson focus-ring group",
        current && "home-lesson-current",
      )}
    >
      <span className={cx("home-lesson-number", done && "home-lesson-done")}>
        <span className="home-lesson-icon" aria-hidden="true">
          <Icon name={done ? "check" : lesson.icon} size={21} />
        </span>
        {String(number).padStart(2, "0")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-display text-[15px] font-bold leading-5 text-ink">
          {lesson.title}
        </span>
        <span className="mt-1 block text-sm leading-5 text-ink-soft">
          {lesson.summary}
        </span>
      </span>
      <span className="home-lesson-state">
        {done ? (
          <Tag tone="success">Completada</Tag>
        ) : current ? (
          <Tag tone="sky">Sigue aquí</Tag>
        ) : (
          <span className="tabular text-xs text-ink-soft">
            {lesson.duration} min
          </span>
        )}
        <Icon name="arrowRight" size={17} className="text-ink-accent" />
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
  return (
    <details
      className="home-disclosure"
      open={list.some((lesson) => lesson.id === nextId)}
    >
      <summary className="home-disclosure-summary focus-ring">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-ink-accent">
            {stage.label}
          </span>
          <span className="mt-1 block">{stage.title}</span>
        </span>
        <span className="tabular text-xs font-normal text-ink-soft">
          {count} / {list.length}
        </span>
        <Icon
          name="chevronDown"
          size={18}
          className="disclosure-chevron text-ink-soft"
        />
      </summary>
      <ol className="home-route home-stage-route">
        {list.map((lesson, index) => (
          <li key={lesson.id}>
            <LessonRow
              lesson={lesson}
              number={index + 1}
              done={done.has(lesson.id)}
              current={nextId === lesson.id}
              onOpen={() => onOpen(lesson)}
            />
          </li>
        ))}
      </ol>
    </details>
  );
}
