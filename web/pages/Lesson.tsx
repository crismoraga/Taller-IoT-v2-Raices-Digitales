import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Icon, Medallion, Rutix, type IconName } from "../brand/Graphics";
import { circuitForBoard } from "../circuit/boards";
import { circuits } from "../circuit/layouts";
import type { Circuit } from "../circuit/model";
import {
  lessonById,
  lessonsOf,
  stageOf,
  type Lesson as LessonData,
} from "../content";
import { lessonForBoard } from "../content/boardLesson";
import { sensorLabels, statusLabels } from "../lib/api";
import { BOARD_NAMES, useApp, type Board } from "../lib/context";
import { useProgress } from "../lib/progress";
import { readLocal, writeLocal } from "../lib/theme";
import { CalibrationTool } from "../lesson/CalibrationTool";
import type { WorkbenchHandle } from "../lesson/CodeWorkbench";
import { PinGuide } from "../lesson/PinGuide";
import { Quiz } from "../lesson/Quiz";
import { WiringGuide } from "../lesson/WiringGuide";
import { Button } from "../ui/Button";
import { Card, Segmented, Tag } from "../ui/Card";
import { Callout, CoachBubble, EmptyState } from "../ui/Feedback";
import { Checkbox, Select } from "../ui/Form";
import { Disclosure, Page } from "../ui/Layout";
import { Modal } from "../ui/Overlay";
import { cx } from "../ui/cx";
import { ConnectButton, ConnectionChip } from "../shell/ConnectButton";
import { BoardDiscovery } from "../lesson/BoardDiscovery";
import { lessonFlow, lessonIdFromRoute, workshopRoute } from "../workshop/flow";
const CodeWorkbench = lazy(() =>
  import("../lesson/CodeWorkbench").then((module) => ({
    default: module.CodeWorkbench,
  })),
);

type Phase = "entiende" | "conecta" | "programa" | "experimenta" | "comprueba";

const PHASES: Record<Phase, { label: string; icon: IconName; hint: string }> = {
  entiende: {
    label: "Entiende",
    icon: "lightbulb",
    hint: "Toca, explora y descubre",
  },
  conecta: { label: "Conecta", icon: "cable", hint: "Cableado paso a paso" },
  programa: {
    label: "Programa",
    icon: "code",
    hint: "Ejecuta y modifica el código",
  },
  experimenta: {
    label: "Experimenta",
    icon: "flask",
    hint: "Juega con tu idea y descubre qué cambia",
  },
  comprueba: {
    label: "Comprueba",
    icon: "checkCircle",
    hint: "Checkpoint y cierre",
  },
};

/** Protoboard vacía para explorar: solo la placa y los agujeros. */
const EXPLORER: Circuit = {
  id: "explorer",
  title: "Placa y protoboard",
  parts: [],
  wires: [],
  steps: [],
  nets: [],
  view: { from: 1, to: 34 },
};

export default function Lesson() {
  const app = useApp();
  const progress = useProgress();
  const id = lessonIdFromRoute(app.route);
  const originalLesson = lessonById(id);
  const lesson = useMemo(
    () =>
      originalLesson ? lessonForBoard(originalLesson, app.board) : undefined,
    [originalLesson, app.board],
  );
  const storage = `raices.lesson.${app.session?.id ?? "anon"}.${id}`;
  const [phase, setPhaseState] = useState<Phase>(() =>
    readLocal<Phase>(storage, "entiende"),
  );
  const [help, setHelp] = useState(false);
  const [quizDone, setQuizDone] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editorReady, setEditorReady] = useState(false);
  const workbench = useRef<WorkbenchHandle>(null);
  const phasePanel = useRef<HTMLDivElement>(null);
  const pendingPhaseScroll = useRef(false);

  useEffect(() => {
    if (!pendingPhaseScroll.current) return;
    pendingPhaseScroll.current = false;
    const target = app.guided
      ? phasePanel.current
      : document.getElementById(`phase-panel-${phase}`);
    target?.scrollIntoView({ block: "start" });
  }, [phase, app.guided]);

  useEffect(() => {
    setPhaseState(readLocal<Phase>(storage, "entiende"));
    setQuizDone(false);
    setConfirmed(false);
    setCelebrate(false);
  }, [storage]);

  const arduino = app.board !== "pico";
  const phases = useMemo<Phase[]>(() => {
    if (!lesson) return [];
    const wiring = Boolean(
      lesson.circuit || lesson.pins || lesson.id === "welcome",
    );
    return [
      "entiende",
      ...(wiring ? (["conecta"] as Phase[]) : []),
      "programa",
      "experimenta",
      "comprueba",
    ];
  }, [lesson]);
  const referenceCircuit = useMemo(
    () =>
      circuitForBoard(
        lesson?.circuit ? circuits[lesson.circuit] : EXPLORER,
        app.board,
      ),
    [lesson?.circuit, app.board],
  );

  if (!lesson)
    return (
      <Page>
        <EmptyState
          illustration="route"
          title="No encontramos esa actividad"
          description="Puede que el enlace esté incompleto. Vuelve a la ruta y elige desde ahí."
          action={
            <Button onClick={() => app.navigate("/")}>
              Volver a mi taller
            </Button>
          }
        />
      </Page>
    );

  const stage = stageOf(lesson);
  const active = phases.includes(phase) ? phase : "entiende";
  const setPhase = (next: Phase) => {
    pendingPhaseScroll.current = next !== phase;
    setPhaseState(next);
    writeLocal(storage, next);
  };
  const index = phases.indexOf(active);
  const done = progress.done.has(lesson.id);
  const flow = lessonFlow(lesson, app.guided);
  const following = flow.following;
  const closesGuidedRoute = flow.express && !following;
  const guidedRouteFinishedAfter =
    closesGuidedRoute &&
    workshopRoute(true).every(
      (item) => item.id === lesson.id || progress.done.has(item.id),
    );
  const stageList = lessonsOf(stage);
  const stageFinishedAfter = stageList.every(
    (item) => item.id === lesson.id || progress.done.has(item.id),
  );

  const complete = async () => {
    if (saving) return;
    if (!app.session) {
      app.openOnboarding(`/taller/${lesson.id}`);
      return;
    }
    setSaving(true);
    try {
      await app.updateSession({
        progress: [...new Set([...app.session.progress, lesson.id])],
      });
      setCelebrate(true);
    } catch (problem) {
      app.notify(
        problem instanceof Error ? problem.message : String(problem),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  const live = lesson.sensor
    ? app.localReadings.filter(
        (reading) =>
          reading.sensor === lesson.sensor ||
          (lesson.sensor === "air_temperature" &&
            reading.sensor === "air_humidity"),
      )
    : [];

  /* ── Partes de la actividad ─────────────────────────────────── */

  const understand = (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.8fr)]">
      <BoardDiscovery
        key={`${lesson.id}:discover`}
        circuit={referenceCircuit}
      />
      <div className="flex flex-col gap-4 xl:sticky xl:top-36">
        <Card
          as="section"
          tone="navy"
          className="solarpunk-discovery-card flex flex-col gap-3"
        >
          <p className="t-overline text-accent">Tu misión</p>
          <h2 className="t-title text-cream">{lesson.concept.title}</h2>
          <p className="text-[15px] leading-6 text-cream">
            {lesson.concept.body[0]}
          </p>
          <p className="rounded-lg bg-primary-soft/70 p-3 text-sm font-semibold leading-6 text-accent-soft">
            {lesson.objective}
          </p>
          <Button
            variant="cream"
            size="lg"
            iconRight="arrowRight"
            onClick={() =>
              setPhase(phases.includes("conecta") ? "conecta" : "programa")
            }
          >
            {lesson.id === "welcome"
              ? "Descubrir mi placa"
              : phases.includes("conecta")
                ? "Vamos a conectar"
                : "Vamos al código"}
          </Button>
        </Card>
        {lesson.id === "welcome" && (
          <Card as="section" className="flex flex-col gap-3">
            <p className="t-overline text-ink-accent">
              El mundo real entra por USB
            </p>
            <p className="text-sm leading-6 text-ink">
              Conecta tu placa al computador y pulsa el botón. La guía se adapta
              a tu Pico o Arduino.
            </p>
            <ConnectionChip />
            <ConnectButton size="lg" />
          </Card>
        )}
        {lesson.concept.body.length > 1 && (
          <Disclosure title="La idea detrás del experimento" icon="lightbulb">
            <div className="prose-rd">
              {lesson.concept.body.slice(1).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </Disclosure>
        )}
      </div>
    </div>
  );

  const connect = (
    <div className="flex flex-col gap-4">
      {lesson.id === "welcome" ? (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.8fr)_minmax(300px,0.8fr)]">
          <BoardDiscovery key="welcome:connect" circuit={referenceCircuit} />
          <Card
            as="section"
            className="solarpunk-discovery-card flex flex-col gap-4"
          >
            <p className="t-overline text-ink-accent">Toca y descubre</p>
            <h2 className="t-title text-ink">
              Conoce tu {BOARD_NAMES[app.board]}
            </h2>
            <p className="text-sm leading-6 text-ink">
              Toca un pin GND, después {arduino ? "D2" : "GP2"}. Gira el modelo
              para seguir su posición. En la protoboard, toca a26 y e26:
              pertenecen a la misma tira.
            </p>
            <ConnectionChip />
            <ConnectButton size="lg" />
            <p className="text-sm leading-6 text-ink-soft">
              {app.connected
                ? "¡La placa ya está conectada! Ahora puedes escribirle tu primer mensaje."
                : "Elige el puerto de tu placa en la ventana del navegador. Continuarás aquí mismo."}
            </p>
            <Button
              variant="accent"
              iconRight="arrowRight"
              onClick={() => setPhase("programa")}
            >
              Escribir mi primer mensaje
            </Button>
          </Card>
        </div>
      ) : lesson.circuit && (!arduino || lesson.arduino) ? (
        <WiringGuide
          circuit={referenceCircuit}
          storageKey={`raices.wiring.${app.session?.id ?? "anon"}.${lesson.circuit}.${app.board}`}
          onDone={() => setPhase("programa")}
        />
      ) : arduino ? (
        lesson.arduino ? (
          <PinGuide
            storageKey={`raices.pins.${app.session?.id ?? "anon"}.${lesson.id}.${app.board}`}
            rows={lesson.arduino.rows}
            notes={lesson.arduino.notes}
            board="arduino"
          />
        ) : (
          <Card>
            <p className="text-sm text-ink">
              Este experimento usa las funciones de la Pico W. Elige esa placa
              para descubrirlo.
            </p>
          </Card>
        )
      ) : lesson.pins ? (
        <PinGuide
          storageKey={`raices.pins.${app.session?.id ?? "anon"}.${lesson.id}.${app.board}`}
          part={lesson.pins.part}
          rows={lesson.pins.rows}
          notes={lesson.pins.notes}
          board="pico"
        />
      ) : null}
      {lesson.id !== "welcome" && (
        <Disclosure
          title="¿Por qué se conecta así?"
          icon="lightbulb"
          tone="alt"
        >
          <p className="max-w-[80ch] text-[15px] leading-[23px] text-ink">
            {lesson.why}
          </p>
        </Disclosure>
      )}
    </div>
  );

  const editor = lesson.code ? (
    <Suspense
      fallback={
        <Card className="grid min-h-[460px] place-items-center text-ink-soft">
          Preparando tu editor de código…
        </Card>
      }
    >
      <CodeWorkbench
        ref={workbench}
        key={`${lesson.id}:${arduino ? "ino" : "py"}`}
        lessonId={lesson.id}
        code={lesson.code}
        arduinoCode={lesson.arduinoCode}
        onReady={setEditorReady}
      />
    </Suspense>
  ) : null;

  const toolCard =
    lesson.tool === "calibration" ? (
      <CalibrationTool />
    ) : lesson.tool ? (
      <Card
        as="section"
        tone="navy"
        className="flex flex-wrap items-center gap-4"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-sm bg-primary-soft text-accent-soft">
          <Icon
            name={
              lesson.tool === "station"
                ? "board"
                : lesson.tool === "alerts"
                  ? "bell"
                  : "chart"
            }
            size={24}
          />
        </span>
        <div className="min-w-0 flex-1">
          <p className="t-overline text-accent">
            Herramienta de esta actividad
          </p>
          <p className="mt-1 font-display text-[17px] font-bold leading-6 text-cream">
            {lesson.tool === "station"
              ? "Configura e instala tu estación"
              : lesson.tool === "alerts"
                ? "Crea reglas y alertas para tu planta"
                : "Abre el dashboard de tu planta"}
          </p>
        </div>
        <Button
          variant="cream"
          iconRight="arrowRight"
          onClick={() =>
            app.navigate(lesson.tool === "station" ? "/estacion" : "/planta")
          }
        >
          {lesson.tool === "station" ? "Ir a Estación" : "Ir a Mi planta"}
        </Button>
      </Card>
    ) : null;

  const modifications = lesson.modify.map((task, taskIndex) => {
    const edit = arduino ? task.arduino : task;
    return (
      <li key={task.title} className="flex gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-highlight font-display text-xs font-extrabold text-ink-accent">
          {taskIndex + 1}
        </span>
        <div className="min-w-0">
          <p className="t-label text-[15px] text-ink">{task.title}</p>
          <p className="mt-0.5 text-sm leading-5 text-ink">
            {edit?.instruction ?? task.instruction}
          </p>
          {edit?.find && (
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!editorReady}
                onClick={() => {
                  if (!workbench.current?.reveal(edit.find!))
                    app.notify(
                      "Esa línea ya cambió en tu código. Restaura el original para verla.",
                      "info",
                    );
                }}
                className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-sm text-[13px] font-bold text-ink-accent hover:underline"
              >
                <Icon name="eye" size={14} />
                Mostrar la línea
              </button>
              {edit.replace !== undefined && (
                <Button
                  size="sm"
                  disabled={!editorReady}
                  variant="outline"
                  icon="code"
                  onClick={() => {
                    if (
                      workbench.current?.applyChange(edit.find!, edit.replace!)
                    )
                      app.notify(
                        "Cambio aplicado. Ejecuta el código para observar el efecto en tu placa.",
                        "success",
                      );
                    else
                      app.notify(
                        "La línea ya cambió. Revisa el editor o restaura el original antes de probar este cambio.",
                        "info",
                      );
                  }}
                >
                  Probar este cambio
                </Button>
              )}
            </div>
          )}
          <p className="mt-1.5 flex gap-1.5 text-[13px] font-semibold leading-[18px] text-ink-soft">
            <Icon name="eye" size={14} className="mt-0.5 shrink-0" />
            {edit?.observe ?? task.observe}
          </p>
        </div>
      </li>
    );
  });

  const program = (
    <div className="flex flex-col gap-4">
      {toolCard}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="min-w-0">{editor}</div>
        <div className="flex min-w-0 flex-col gap-4">
          <Card as="section">
            <p className="t-overline text-ink-accent">Al ejecutar</p>
            <h3 className="t-subtitle mt-1 text-ink">¿Qué debería pasar?</h3>
            <p className="mt-1.5 text-[15px] leading-[22px] text-ink">
              {lesson.expected}
            </p>
            {lesson.sampleOutput && !arduino && (
              <div>
                <p className="mt-3 text-xs font-bold text-ink-soft">
                  Ejemplo de salida · compáralo con tu terminal
                </p>
                <pre className="t-mono scrollbar-thin mt-3 max-h-40 overflow-auto whitespace-pre-wrap rounded-sm bg-code px-3 py-2.5 text-cream-soft">
                  {lesson.sampleOutput}
                </pre>
              </div>
            )}
            {live.length > 0 && (
              <div className="mt-3 flex flex-col gap-2">
                {live.map((reading) => (
                  <p
                    key={reading.sensor}
                    className="flex flex-wrap items-center gap-2 rounded-sm bg-success-soft px-3 py-2 text-sm font-bold text-success-ink"
                  >
                    <Icon name="activity" size={16} />
                    {sensorLabels[reading.sensor] ?? reading.sensor}:
                    <span className="tabular font-display text-base font-extrabold">
                      {reading.value === null
                        ? "—"
                        : `${reading.value} ${reading.unit}`}
                    </span>
                    <span className="font-semibold">
                      · {statusLabels[reading.status] ?? reading.status}
                    </span>
                    {typeof reading.raw === "number" && (
                      <span className="tabular font-semibold opacity-80">
                        · raw {reading.raw}
                      </span>
                    )}
                  </p>
                ))}
              </div>
            )}
          </Card>
          {lesson.codeNotes && !arduino && (
            <Disclosure title="Qué hace cada línea de código" icon="code">
              <ul className="mt-2 flex flex-col gap-2.5">
                {lesson.codeNotes.map((note) => (
                  <li key={note.line}>
                    <button
                      type="button"
                      disabled={!editorReady}
                      onClick={() => workbench.current?.reveal(note.line)}
                      title="Mostrar en el editor"
                      className="t-mono focus-ring max-w-full truncate rounded-sm bg-surface-alt px-2 py-1 text-left font-bold text-ink-accent hover:bg-highlight"
                    >
                      {note.line}
                    </button>
                    <p className="mt-1 text-sm leading-5 text-ink">
                      {note.note}
                    </p>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
          <Card as="section">
            <p className="t-overline text-ink-accent">Ahora cámbialo tú</p>
            <ol className="mt-2 flex flex-col gap-3">
              {modifications.slice(0, 1)}
            </ol>
            {modifications.length > 1 && (
              <Disclosure
                title="Probar otros cambios"
                icon="flask"
                tone="plain"
                className="mt-3"
              >
                <ol className="flex flex-col gap-3">
                  {modifications.slice(1)}
                </ol>
              </Disclosure>
            )}
          </Card>
        </div>
      </div>
    </div>
  );

  const experiment = (
    <div
      className={cx(
        "grid gap-4",
        app.guided && editor && "xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]",
      )}
    >
      {app.guided && editor && <div className="min-w-0">{editor}</div>}
      <div className="flex min-w-0 flex-col gap-4">
        <Card as="section">
          <p className="t-overline text-ink-accent">Experimenta</p>
          <h3 className="t-subtitle mt-1 text-ink">
            Prueba con las manos y explica qué pasó
          </h3>
          <ul className="mt-3 flex flex-col gap-2.5">
            {lesson.experiment.map((item) => (
              <li
                key={item}
                className="flex gap-2.5 rounded-md bg-surface-alt p-3 text-[15px] leading-[22px] text-ink"
              >
                <Icon
                  name="flask"
                  size={18}
                  className="mt-0.5 shrink-0 text-ink-accent"
                />
                {lesson.id === "welcome" && arduino
                  ? item.startsWith("En el explorador")
                    ? "En el explorador, toca a26 y e26. Después toca f26 y observa cómo cambia la tira."
                    : item.startsWith("Localiza GP2")
                      ? "Localiza D2, A0, 5V y GND en tu Arduino. Explica cuáles son señales y cuáles distribuyen alimentación."
                      : item
                  : item}
              </li>
            ))}
          </ul>
        </Card>
        <Challenge
          key={`${lesson.id}:${arduino}`}
          lesson={lesson}
          arduino={arduino}
          ready={editorReady}
          onLoad={
            arduino && !lesson.challenge.arduino?.solution
              ? undefined
              : (code) => {
                  if (!app.guided) setPhase("programa");
                  setTimeout(() => workbench.current?.load(code), 60);
                }
          }
        />
      </div>
    </div>
  );

  const check = (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Card as="section">
        <p className="t-overline mb-3 text-ink-accent">Checkpoint</p>
        <Quiz
          key={`${lesson.id}:${app.board}`}
          questions={lesson.checkpoint}
          onComplete={() => setQuizDone(true)}
        />
      </Card>
      <div className="flex flex-col gap-4">
        <Disclosure title="Resolver un problema" icon="stethoscope">
          <Troubles lesson={lesson} />
          <button
            type="button"
            onClick={() => app.navigate("/diagnostico")}
            className="focus-ring mt-3 inline-flex items-center gap-1.5 rounded-sm text-sm font-bold text-ink-accent hover:underline"
          >
            <Icon name="stethoscope" size={16} />
            Abrir el diagnóstico completo
          </button>
        </Disclosure>
        <Card as="section" tone="navy" className="flex flex-col gap-3">
          <p className="t-overline text-accent">Cierre</p>
          <h3 className="t-heading text-cream">
            {done
              ? "Esta actividad ya es parte de tu ruta"
              : "¿Lo lograste? Márcala como completada"}
          </h3>
          {!quizDone && !done && (
            <Checkbox checked={confirmed} onChange={setConfirmed} onDark>
              Probé la actividad en mi placa y puedo explicar qué ocurrió.
            </Checkbox>
          )}
          <Button
            variant="cream"
            size="lg"
            iconRight={done ? "arrowRight" : "check"}
            loading={saving}
            disabled={!done && !quizDone && !confirmed}
            onClick={() =>
              done
                ? app.navigate(
                    following ? `/taller/${following.id}` : "/planta",
                  )
                : void complete()
            }
          >
            {done
              ? following
                ? `Siguiente: ${following.title}`
                : "Ver mi planta"
              : "Completar actividad"}
          </Button>
          {!done && !quizDone && !confirmed && (
            <p className="text-[13px] font-semibold leading-[18px] text-accent-soft">
              Responde el checkpoint o marca la casilla para completar.
            </p>
          )}
        </Card>
      </div>
    </div>
  );

  const content: Record<Phase, ReactNode> = {
    entiende: understand,
    conecta: connect,
    programa: program,
    experimenta: experiment,
    comprueba: check,
  };

  return (
    <Page wide>
      {/* Cabecera de la actividad */}
      <header className="solarpunk-lesson-header relative isolate rounded-xl border border-border bg-surface px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() =>
                app.navigate(stage.id === "explora" ? "/explora" : "/")
              }
              className="focus-ring inline-flex min-h-8 items-center gap-1.5 rounded-sm text-xs font-bold text-ink-accent hover:underline"
            >
              <Icon name="chevronLeft" size={14} strokeWidth={2.6} />
              {stage.label} · {stage.title}
            </button>
            <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
              {lesson.title}
            </h1>
            <p className="mt-1.5 max-w-3xl text-sm leading-6 text-ink-soft">
              {lesson.summary}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Tag tone="neutral" icon="clock">
                {lesson.duration} min
              </Tag>
              <Tag tone="neutral" icon="route">
                Actividad {flow.index + 1} de {flow.total}
              </Tag>
              {done && (
                <Tag tone="success" icon="check">
                  Completada
                </Tag>
              )}
            </div>
          </div>
          <div className="flex w-full flex-col gap-2.5 sm:w-auto sm:min-w-[230px]">
            <label className="flex flex-col gap-1">
              <span className="text-xs font-bold text-ink-soft">Tu placa</span>
              <Select
                value={app.board}
                disabled={app.connected || app.connecting || app.busy}
                onChange={(event) => app.setBoard(event.target.value as Board)}
                className="h-11!"
              >
                {(Object.keys(BOARD_NAMES) as Board[]).map((board) => (
                  <option key={board} value={board}>
                    {BOARD_NAMES[board]}
                  </option>
                ))}
              </Select>
            </label>
            {app.connected && (
              <Button
                size="sm"
                variant="ghost"
                icon="usb"
                disabled={app.busy || app.connecting}
                onClick={() => void app.disconnect()}
              >
                Cambiar placa
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Segmented
                size="sm"
                label="Modo de la actividad"
                className="flex-1 [&>button]:flex-1"
                value={app.guided ? "guided" : "free"}
                onChange={(value) => app.setGuided(value === "guided")}
                options={[
                  { value: "guided", label: "Guiado", icon: "steps" },
                  { value: "free", label: "Libre", icon: "grid" },
                ]}
              />
              <Button
                size="sm"
                variant="ghost"
                icon="help"
                onClick={() => setHelp(true)}
              >
                Ayuda
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-soft">
        <p className="flex min-w-0 flex-1 items-start gap-2">
          <Icon
            name={app.connected ? "usb" : "lightbulb"}
            size={17}
            className="mt-0.5 shrink-0 text-ink-accent"
          />
          {app.connected
            ? `USB conectado · ${BOARD_NAMES[app.board]}`
            : app.serialSupported
              ? "Conecta tu placa para ver el experimento en el mundo real."
              : "Para programar la placa, usa Chrome o Edge de escritorio."}
        </p>
        {flow.previous && (
          <Button
            size="sm"
            variant="ghost"
            icon="arrowLeft"
            onClick={() => app.navigate(`/taller/${flow.previous!.id}`)}
          >
            Actividad anterior
          </Button>
        )}
      </div>

      {app.guided ? (
        <>
          {/* Fases: una cosa a la vez */}
          <nav
            aria-label="Partes de la actividad"
            className="sticky top-16 z-30 -mx-4 mt-4 border-b border-border bg-paper/92 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
          >
            <ol className="scrollbar-thin flex gap-1.5 overflow-x-auto">
              {phases.map((item, itemIndex) => {
                const current = item === active;
                const past = itemIndex < index;
                return (
                  <li
                    key={item}
                    className="flex shrink-0 items-center sm:min-w-0 sm:flex-1"
                  >
                    <button
                      type="button"
                      aria-current={current ? "step" : undefined}
                      onClick={() => setPhase(item)}
                      title={PHASES[item].hint}
                      className={cx(
                        "pressable focus-ring flex min-h-11 w-full items-center gap-2 whitespace-nowrap rounded-md px-2.5 text-left text-sm font-bold",
                        current
                          ? "bg-action text-action-ink"
                          : past
                            ? "bg-highlight text-ink-accent hover:brightness-95"
                            : "bg-surface-alt text-ink-soft hover:text-ink",
                      )}
                    >
                      <span
                        className={cx(
                          "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                          current
                            ? "bg-action-ink/15"
                            : past
                              ? "bg-surface text-ink-soft"
                              : "bg-surface",
                        )}
                      >
                        {itemIndex + 1}
                      </span>
                      <span className="truncate">{PHASES[item].label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
          </nav>
          <div
            ref={phasePanel}
            key={`${lesson.id}:${active}`}
            className="mt-4 scroll-mt-40 animate-fade"
          >
            <p
              className="mb-3 text-sm font-semibold text-ink-soft"
              role="status"
            >
              Paso {index + 1} de {phases.length}: {PHASES[active].hint}
            </p>
            {content[active]}
          </div>
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <Button
              variant="outline"
              icon="arrowLeft"
              disabled={index === 0}
              onClick={() => setPhase(phases[index - 1])}
            >
              {index > 0
                ? `Anterior: ${PHASES[phases[index - 1]].label}`
                : "Atrás"}
            </Button>
            {index < phases.length - 1 && (
              <Button
                variant="accent"
                iconRight="arrowRight"
                onClick={() => setPhase(phases[index + 1])}
              >
                Siguiente: {PHASES[phases[index + 1]].label}
              </Button>
            )}
          </div>
        </>
      ) : (
        /* Modo libre: todo a la vista, en el orden de las 14 partes */
        <div className="mt-5 flex flex-col gap-9">
          {phases.map((item, itemIndex) => (
            <section
              key={item}
              id={`phase-panel-${item}`}
              className="scroll-mt-24"
              aria-labelledby={`fase-${item}`}
            >
              <h2
                id={`fase-${item}`}
                className="t-title mb-3.5 flex items-center gap-3 text-ink"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-action font-display text-sm font-extrabold text-action-ink">
                  {itemIndex + 1}
                </span>
                {PHASES[item].label}
                <span className="text-sm font-semibold text-ink-soft">
                  {PHASES[item].hint}
                </span>
              </h2>
              {content[item]}
            </section>
          ))}
        </div>
      )}

      <Modal
        open={help}
        onClose={() => setHelp(false)}
        icon="help"
        kicker="Ayuda"
        title="¿Algo no funciona? Revisemos"
        size="md"
        footer={
          <>
            <Button variant="outline" onClick={() => setHelp(false)}>
              Cerrar
            </Button>
            <Button
              icon="stethoscope"
              onClick={() => {
                setHelp(false);
                app.navigate("/diagnostico");
              }}
            >
              Abrir diagnóstico
            </Button>
          </>
        }
      >
        <Troubles lesson={lesson} open />
      </Modal>

      <Modal
        open={celebrate}
        onClose={() => setCelebrate(false)}
        tone="navy"
        kicker={
          guidedRouteFinishedAfter
            ? "Ruta guiada completada"
            : stageFinishedAfter
              ? `${stage.label} completada`
              : "Actividad completada"
        }
        title={
          guidedRouteFinishedAfter
            ? "¡Tu ruta guiada está completa!"
            : stageFinishedAfter
              ? `¡Ganaste la medalla «${stage.title}»!`
              : "¡Bien hecho!"
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setCelebrate(false)}>
              Quedarme aquí
            </Button>
            <Button
              iconRight="arrowRight"
              onClick={() => {
                setCelebrate(false);
                app.navigate(following ? `/taller/${following.id}` : "/planta");
              }}
            >
              {following ? `Siguiente: ${following.title}` : "Ver mi planta"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <div className="flex items-end justify-center gap-2">
            <span className="flex size-[104px] items-center justify-center overflow-hidden rounded-full bg-night ring-2 ring-accent/35">
              <Rutix
                expression="celebrate"
                pose="celebrate"
                signal={4}
                size={98}
                shadow={false}
              />
            </span>
            {stageFinishedAfter && (
              <Medallion
                glyph={stage.glyph}
                tier="oro"
                ribbon
                size={92}
                className="animate-pop"
                label={`Medalla ${stage.title}`}
              />
            )}
          </div>
          <p className="max-w-sm text-[15px] leading-[22px] text-ink">
            Completaste{" "}
            <strong className="font-extrabold">«{lesson.title}»</strong>.{" "}
            {lesson.essential
              ? `Llevas ${Math.min(progress.expressDone + (done ? 0 : 1), progress.expressTotal)} de ${progress.expressTotal} actividades de la ruta exprés.`
              : "Cada actividad suma una nueva idea a tu proyecto."}
          </p>
          {closesGuidedRoute && (
            <p className="max-w-sm text-sm leading-6 text-ink-soft">
              Lleva a Mi planta tu demostración: dos lecturas recientes, origen
              Hardware, umbral y recuperación. Conserva tus datos en CSV antes
              de cerrar el taller. Si practicaste con Simulación, indícalo al
              presentar el resultado.
            </p>
          )}
        </div>
      </Modal>
    </Page>
  );
}

function Troubles({ lesson, open }: { lesson: LessonData; open?: boolean }) {
  return (
    <div className="mt-2 flex flex-col gap-2">
      {lesson.troubleshooting.map((trouble, index) => (
        <Disclosure
          key={trouble.symptom}
          tone="alt"
          icon="bug"
          title={trouble.symptom}
          defaultOpen={open && index === 0}
        >
          <ol className="flex list-decimal flex-col gap-1.5 pl-5">
            {trouble.checks.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
        </Disclosure>
      ))}
    </div>
  );
}

/** Desafío con pistas graduales de Rutix: de la más vaga a la más directa. */
function Challenge({
  lesson,
  arduino = false,
  ready = true,
  onLoad,
}: {
  lesson: LessonData;
  arduino?: boolean;
  ready?: boolean;
  onLoad?: (code: string) => void;
}) {
  const [shown, setShown] = useState(0);
  const [solution, setSolution] = useState(false);
  const challenge = arduino
    ? {
        ...lesson.challenge,
        ...lesson.challenge.arduino,
        solution: lesson.challenge.arduino?.solution,
      }
    : lesson.challenge;
  const hints = challenge.hints;
  return (
    <Card as="section" className="flex flex-col gap-3.5">
      <div>
        <p className="t-overline text-ink-accent">Desafío</p>
        <p className="mt-1.5 font-display text-[17px] font-bold leading-6 text-ink">
          {challenge.prompt}
        </p>
      </div>
      {shown > 0 && (
        <div className="flex flex-col gap-2.5 rounded-lg bg-night p-3.5">
          <CoachBubble
            mood="tip"
            title={`Pista de Rutix · ${shown} de ${hints.length}`}
            size={60}
          >
            {hints[shown - 1]}
          </CoachBubble>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {shown < hints.length && (
          <Button
            variant="subtle"
            size="sm"
            icon="lightbulb"
            onClick={() => setShown(shown + 1)}
          >
            {shown === 0 ? "Necesito una pista" : "Otra pista"}
          </Button>
        )}
        {shown >= hints.length && challenge.solution && !solution && (
          <Button
            variant="subtle"
            size="sm"
            icon="eye"
            onClick={() => setSolution(true)}
          >
            Ver una solución
          </Button>
        )}
      </div>
      {solution && challenge.solution && (
        <div>
          <pre className="t-mono scrollbar-thin max-h-72 overflow-auto rounded-sm bg-code px-3 py-2.5 text-cream-soft">
            {challenge.solution}
          </pre>
          {onLoad && (
            <Button
              className="mt-2.5"
              size="sm"
              variant="outline"
              icon="code"
              disabled={!ready}
              onClick={() => onLoad(challenge.solution!)}
            >
              Cargar en el editor
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
