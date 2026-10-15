import {
  Fragment,
  lazy,
  Suspense,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { BreadboardView } from "../circuit/BreadboardView";
import type { Circuit } from "../circuit/model";
import { Segmented } from "../ui/Card";
import { Button } from "../ui/Button";
import { cx } from "../ui/cx";
import { readLocal, writeLocal } from "../lib/theme";
import { configureDhtPinOrder } from "./assembly";
import { useDhtPinOrder } from "./dhtLayout";
import { useApp, type Board } from "../lib/context";
import { isPoint, parsePoint, type PointId } from "../circuit/breadboard";
import {
  assessDiscoveryChoice,
  DISCOVERY_STEPS,
  discoveryConnectedHoles,
  discoveryPinRoles,
  discoverySignalPath,
} from "./breadboardDiscovery";

const CircuitExperience = lazy(() => import("../experience/CircuitExperience"));

const FOUNDATION_COPY = [
  {
    title: "Cinco agujeros, una conexión",
    detail:
      "Dentro de la protoboard, a–e comparten una tira metálica en cada número.",
    action: "Toca otro agujero que esté unido a a26.",
  },
  {
    title: "El canal central separa los dos lados",
    detail:
      "Aunque tengan el mismo número, e26 y f26 están separados por el canal.",
    action: "Toca otro agujero que esté unido a e26.",
  },
  {
    title: "Los rieles reparten la alimentación",
    detail:
      "Cada línea lateral es independiente. Este plano representa rieles cortados entre 31 y 33; el montaje añadirá un puente cuando lo necesite.",
    action: "Toca otro agujero que esté unido al riel azul, número 30.",
  },
  {
    title: "Cada pin tiene una función",
    detail:
      "El programa controla las salidas; los sensores entregan señales a las entradas. La alimentación y GND completan las conexiones.",
    action:
      "Elige la salida digital que controlará el LED del próximo montaje.",
  },
  {
    title: "La señal llega por el cable",
    detail:
      "Un jumper lleva una señal desde la placa hasta un grupo de la protoboard. Todo ese grupo comparte la conexión.",
    action:
      "El cable llegará a a22. Toca otro agujero que recibirá la misma señal.",
  },
];

/** A real electrical-node exercise; it does not simulate a connected USB board. */
function BreadboardFoundations({ board }: { board: Board }) {
  const app = useApp();
  const storageKey = `raices.discovery.foundations.${app.session?.id ?? "anon"}.step`;
  const readStep = () => {
    const stored = readLocal<unknown>(storageKey, 0);
    return typeof stored === "number" &&
      Number.isInteger(stored) &&
      stored >= 0 &&
      stored <= DISCOVERY_STEPS.length
      ? stored
      : 0;
  };
  const [index, setIndex] = useState(readStep);
  const [selected, setSelected] = useState<string | null>(null);
  const [answer, setAnswer] = useState<{
    correct: boolean;
    message: string;
  } | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const titleId = useId();
  const stage = DISCOVERY_STEPS[index];
  const copy = FOUNDATION_COPY[index];
  const signal = useMemo(() => discoverySignalPath(board), [board]);
  const shared =
    selected && isPoint(selected) ? discoveryConnectedHoles(selected) : [];
  const anchor =
    stage === "groups"
      ? "a26"
      : stage === "gap"
        ? "e26"
        : stage === "rails"
          ? "tn:30"
          : signal.to;

  useEffect(() => {
    if (firstRender.current) firstRender.current = false;
    else heading.current?.focus();
  }, [index]);
  useEffect(() => {
    setSelected(null);
    setAnswer(null);
  }, [board]);
  useEffect(() => {
    setIndex(readStep());
    setSelected(null);
    setAnswer(null);
  }, [storageKey]);

  function moveTo(next: number) {
    setIndex(next);
    writeLocal(storageKey, next);
    setSelected(null);
    setAnswer(null);
  }
  function choose(choice: string) {
    setSelected(choice);
    setAnswer(assessDiscoveryChoice(stage, choice, board));
  }
  function hole(point: PointId) {
    const parsed = parsePoint(point);
    const rail = parsed.kind === "rail";
    const label = rail
      ? `Riel ${parsed.rail.endsWith("n") ? "azul (−)" : "rojo (+)"}, número ${parsed.column}`
      : `Agujero ${point}`;
    return (
      <button
        key={point}
        type="button"
        aria-label={label}
        aria-pressed={selected === point}
        onClick={() => choose(point)}
        className={cx(
          "focus-ring relative flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-md border px-2 py-1.5 font-mono text-sm font-bold transition-colors",
          shared.includes(point)
            ? "border-ink-accent bg-accent-soft text-primary"
            : "border-border bg-surface text-ink",
          point === anchor &&
            "ring-2 ring-ink-accent ring-offset-2 ring-offset-surface-alt",
          selected === point && "outline-2 outline-offset-2 outline-ink-accent",
        )}
      >
        <span
          aria-hidden="true"
          className={cx(
            "size-2.5 shrink-0 rounded-full border-2",
            shared.includes(point)
              ? "border-primary bg-primary"
              : "border-ink-soft bg-primary-deep",
          )}
        />
        {rail ? parsed.column : point}
      </button>
    );
  }

  if (!stage)
    return (
      <div
        className="flex min-h-[400px] flex-col items-center justify-center gap-5 px-6 py-10 text-center"
        role="region"
        aria-label="Conexiones de Arduino a la protoboard"
      >
        <span
          aria-hidden="true"
          className="grid size-16 place-items-center rounded-full bg-accent text-3xl text-primary"
        >
          ✓
        </span>
        <h2
          ref={heading}
          tabIndex={-1}
          className="t-title text-ink focus:outline-none"
        >
          Ya entiendes las conexiones
        </h2>
        <p className="max-w-lg text-base leading-7 text-ink-soft">
          Un grupo de cinco comparte conexión. El canal separa los lados. Un
          cable lleva la señal de la placa al grupo que elijas.
        </p>
        <p className="text-sm font-bold text-ink-accent">
          Ahora puedes conectar tu primer LED, una pata y un cable a la vez.
        </p>
        <Button variant="outline" size="sm" onClick={() => moveTo(0)}>
          Repasar las conexiones
        </Button>
      </div>
    );

  return (
    <div
      role="region"
      aria-label="Conexiones de Arduino a la protoboard"
      className="border-t border-border px-4 py-5 sm:px-5"
    >
      <div
        className="mb-5 flex items-center gap-3"
        aria-label={`Conexión ${index + 1} de ${DISCOVERY_STEPS.length}`}
      >
        <span className="t-overline shrink-0 text-ink-accent">
          {index + 1} / {DISCOVERY_STEPS.length}
        </span>
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {DISCOVERY_STEPS.map((step, stepIndex) => (
            <span
              key={step}
              className={cx(
                "h-1.5 flex-1 rounded-full",
                stepIndex <= index ? "bg-action" : "bg-border",
              )}
            />
          ))}
        </div>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(230px,0.85fr)]">
        <div className="min-w-0 rounded-xl border border-border bg-surface-alt p-3 sm:p-4">
          {stage === "rails" ? (
            <div
              role="group"
              aria-label="Detalle de los rieles superior rojo y azul"
              className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-x-2 gap-y-4"
            >
              <span />
              {[30, 31, 33].map((column) => (
                <span
                  key={column}
                  className="text-center font-mono text-xs text-ink-soft"
                >
                  {column}
                </span>
              ))}
              {(["tp", "tn"] as const).map((rail) => (
                <Fragment key={rail}>
                  <span
                    className={cx(
                      "text-lg font-bold",
                      rail === "tp" ? "text-danger-text" : "text-ink-accent",
                    )}
                    aria-hidden="true"
                  >
                    {rail === "tp" ? "+" : "−"}
                  </span>
                  {[30, 31, 33].map((column) => (
                    <div
                      key={column}
                      className={cx(
                        column === 33 &&
                          "border-l-2 border-dashed border-ink-soft pl-2",
                      )}
                    >
                      {hole(`${rail}:${column}`)}
                    </div>
                  ))}
                </Fragment>
              ))}
              <p className="col-span-4 mt-1 text-sm leading-6 text-ink-soft">
                La línea punteada representa el corte entre las dos mitades. En
                la protoboard real, revisa cómo están divididos sus rieles.
              </p>
            </div>
          ) : stage === "pins" ? (
            <div
              role="group"
              aria-label="Funciones de los pines de la placa"
              className="flex flex-col gap-2"
            >
              {discoveryPinRoles(board).map(({ pin, role }) => (
                <button
                  key={pin}
                  type="button"
                  aria-label={`Pin ${pin}`}
                  aria-pressed={selected === pin}
                  onClick={() => choose(pin)}
                  className={cx(
                    "focus-ring grid min-h-14 grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 rounded-lg border px-3 py-2 text-left",
                    selected === pin
                      ? "border-ink-accent bg-accent-soft text-primary"
                      : "border-border bg-surface text-ink",
                  )}
                >
                  <span className="font-mono text-base font-bold">{pin}</span>
                  <span className="text-sm leading-5">{role}</span>
                </button>
              ))}
            </div>
          ) : (
            <div
              role="group"
              aria-label="Detalle de los grupos de la protoboard"
            >
              {stage === "path" && (
                <p className="mb-4 rounded-lg bg-primary px-3 py-2 text-center text-sm font-bold leading-6 text-cream">
                  {signal.pin} → cable {signal.color} → {signal.to}
                </p>
              )}
              <div className="grid grid-cols-[auto_repeat(3,minmax(0,1fr))] items-center gap-2">
                <span />
                {(stage === "path" ? [22, 23, 24] : [26, 27, 28]).map(
                  (column) => (
                    <span
                      key={column}
                      className="text-center font-mono text-xs text-ink-soft"
                    >
                      {column}
                    </span>
                  ),
                )}
                {(stage === "gap"
                  ? ["j", "i", "h", "g", "f", "e", "d", "c", "b", "a"]
                  : ["e", "d", "c", "b", "a"]
                ).map((letter) => (
                  <Fragment key={letter}>
                    {stage === "gap" && letter === "e" && (
                      <div className="col-span-4 my-1 rounded-sm border-y border-dashed border-ink-soft py-2 text-center text-xs font-bold text-ink-soft">
                        Canal central · sin unión interna
                      </div>
                    )}
                    <span className="font-mono text-xs text-ink-soft">
                      {letter}
                    </span>
                    {(stage === "path" ? [22, 23, 24] : [26, 27, 28]).map(
                      (column) => hole(`${letter}${column}` as PointId),
                    )}
                  </Fragment>
                ))}
              </div>
              <p className="mt-3 text-xs leading-5 text-ink-soft">
                El borde marcado señala el punto de partida. Al tocar un agujero
                se ilumina su grupo real.
              </p>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <h2
            id={titleId}
            ref={heading}
            tabIndex={-1}
            className="t-title text-ink focus:outline-none"
          >
            {copy.title}
          </h2>
          <p className="text-sm leading-6 text-ink-soft">{copy.detail}</p>
          <p className="rounded-lg border border-border bg-surface-alt px-4 py-3 text-base font-bold leading-6 text-ink">
            {copy.action}
          </p>
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={cx(
              "min-h-16 text-sm leading-6",
              answer?.correct ? "font-bold text-ink-accent" : "text-ink-soft",
            )}
          >
            {answer?.message ??
              "Toca una opción. También puedes recorrerlas con Tab y elegir con Enter o Espacio."}
          </p>
          <div className="flex flex-wrap gap-2">
            {index > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => moveTo(index - 1)}
              >
                Anterior conexión
              </Button>
            )}
            <Button
              size="sm"
              variant="accent"
              iconRight="arrowRight"
              disabled={!answer?.correct}
              onClick={() => moveTo(index + 1)}
            >
              {index === DISCOVERY_STEPS.length - 1
                ? "Terminar conexiones"
                : "Siguiente conexión"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A touchable model is the lesson's first explanation, rather than a materials checklist. */
export function BoardDiscovery({
  circuit: source,
  foundations = false,
}: {
  circuit: Circuit;
  foundations?: boolean;
}) {
  const [dhtPinOrder] = useDhtPinOrder();
  const circuit = useMemo(
    () => configureDhtPinOrder(source, dhtPinOrder),
    [source, dhtPinOrder],
  );
  // Board variants share the same preference: choosing Uno must not silently
  // replace a learner's 2D plan with a different viewing mode.
  const baseId = circuit.id.replace(/-(?:uno|nano(?:-old|-168)?)$/, "");
  const viewPreference = `raices.discovery.${foundations ? "foundations.view" : `view.${baseId}`}`;
  const [view, setView] = useState<"3d" | "2d" | "learn">(() => {
    const saved = readLocal<string>(
      viewPreference,
      foundations ? "learn" : "3d",
    );
    return saved === "2d"
      ? "2d"
      : foundations && saved === "learn"
        ? "learn"
        : "3d";
  });
  return (
    <section
      className="solarpunk-discovery-card min-w-0 overflow-hidden rounded-2xl border border-border bg-surface"
      aria-label="Explorador interactivo de la placa"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <p className="t-overline text-ink-accent">
            {foundations
              ? "Primero, entiende las conexiones"
              : "Tu laboratorio, por dentro"}
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {view === "learn"
              ? "Una idea y una acción a la vez. Sin conectar aún el LED."
              : "Arrastra para girar. Toca un pin, una pieza o un agujero."}
          </p>
        </div>
        <Segmented
          size="sm"
          equalWidth={foundations}
          className={foundations ? "w-full" : undefined}
          label="Vista del explorador"
          value={view}
          onChange={(value) => {
            setView(value);
            writeLocal(viewPreference, value);
          }}
          options={[
            ...(foundations
              ? [
                  {
                    value: "learn" as const,
                    label: "Aprender conexiones",
                    icon: "lightbulb" as const,
                  },
                ]
              : []),
            {
              value: "3d" as const,
              label: foundations ? "Ver en 3D" : "Explorar en 3D",
              icon: "cube" as const,
            },
            {
              value: "2d" as const,
              label: "Plano 2D",
              icon: "layers" as const,
            },
          ]}
        />
      </div>
      {view === "learn" && foundations ? (
        <BreadboardFoundations board={circuit.board ?? "pico"} />
      ) : view === "3d" ? (
        <Suspense
          fallback={
            <div className="grid min-h-[440px] place-items-center text-ink-soft">
              Tu laboratorio está tomando forma…
            </div>
          }
        >
          <CircuitExperience
            circuit={circuit}
            mode="all"
            className="rd-lesson-preview"
          />
        </Suspense>
      ) : (
        <div className="h-[440px] xl:h-[560px]">
          <BreadboardView
            circuit={circuit}
            stepIndex={0}
            complete
            className="rounded-none"
          />
        </div>
      )}
    </section>
  );
}
