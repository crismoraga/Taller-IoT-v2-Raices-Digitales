import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Check,
  Lightbulb,
  RotateCcw,
  Box,
  Layers3,
  ChevronDown,
  ShieldCheck,
  FlaskConical,
} from "lucide-react";
import { useApp } from "../lib/context";
import { lessons } from "../data/lessons";
import StationScene from "../components/StationScene";
import CodeWorkbench from "../components/CodeWorkbench";
import CalibrationWizard from "../components/CalibrationWizard";
import { Button, Badge, Notice, EmptyState } from "../components/Common";
export default function Workshop() {
  const app = useApp();
  const id = decodeURIComponent(app.route.split("/")[2] || "welcome");
  const lesson = lessons.find((x) => x.id === id);
  const [step, setStep] = useState(0),
    [view, setView] = useState<"3d" | "2d">("3d"),
    [reset, setReset] = useState(0),
    [selected, setSelected] = useState(""),
    [observed, setObserved] = useState(false);
  useEffect(() => {
    setStep(0);
    setSelected("");
    setObserved(false);
  }, [id]);
  if (!lesson)
    return (
      <EmptyState
        title="No encontramos esa actividad"
        description="Vuelve al recorrido para continuar."
        action={
          <Button onClick={() => app.navigate("/")}>Volver al taller</Button>
        }
      />
    );
  const core = lessons.filter((x) =>
    ["welcome", "led", "blink", "sensors", "calibration", "cloud"].includes(
      x.id,
    ),
  );
  const index = core.findIndex((x) => x.id === id),
    isCore = index >= 0;
  const complete = async () => {
    try {
      if (!app.session) {
        app.openOnboarding();
        return;
      }
      await app.updateSession({
        progress: [...new Set([...app.session.progress, id])],
      });
      app.notify("¡Una nueva raíz! Etapa completada.");
      if (isCore && index < 5) app.navigate(`/taller/${core[index + 1].id}`);
      else app.navigate("/dashboard");
    } catch (e) {
      app.notify((e as Error).message, true);
    }
  };
  return (
    <div className="workshop-page">
      <div className="lesson-breadcrumb">
        <button onClick={() => app.navigate(isCore ? "/" : "/laboratorio")}>
          <ArrowLeft size={14} />
          {isCore ? "Mi recorrido" : "Laboratorio"}
        </button>
        <span>
          {isCore
            ? `ETAPA ${String(index + 1).padStart(2, "0")} DE 06`
            : "EXPERIMENTO LIBRE"}
        </span>
        <Badge>
          <Clock size={12} />
          {lesson.duration} min
        </Badge>
      </div>
      <div className="lesson-heading">
        <div>
          <span className="eyebrow">{lesson.kicker}</span>
          <h1>
            {lesson.title.replace(/\.$/, "")}
            <span className="small-period">.</span>
          </h1>
          <p>{lesson.objective}</p>
        </div>
        <div className="board-selector">
          <label htmlFor="board-choice">TU PLACA</label>
          <select
            id="board-choice"
            value={app.board}
            onChange={(e) => app.setBoard(e.target.value as typeof app.board)}
          >
            <option value="pico">Raspberry Pi Pico W</option>
            <option value="uno">Arduino Uno</option>
            <option value="nano">Arduino Nano</option>
            <option value="nano-old">Nano · bootloader antiguo</option>
          </select>
        </div>
      </div>
      <div className="materials-strip">
        <span>NECESITAS</span>
        {lesson.materials.map((x) => (
          <Badge key={x}>{x}</Badge>
        ))}
      </div>
      {id === "welcome" && (
        <Notice>
          <strong>Antes de empezar:</strong> desconecta la alimentación al
          cambiar cables. Los GPIO de Pico trabajan a 3,3 V. Revisa los nombres
          de pin antes de conectar.
        </Notice>
      )}
      <div className="lesson-columns">
        <section className="wiring-panel">
          <div className="panel-header">
            <div>
              <Box size={17} />
              <h3>Conecta y descubre</h3>
            </div>
            <div className="segmented">
              <button
                className={view === "3d" ? "active" : ""}
                onClick={() => setView("3d")}
              >
                3D
              </button>
              <button
                className={view === "2d" ? "active" : ""}
                onClick={() => setView("2d")}
              >
                2D
              </button>
            </div>
            <button
              className="icon-button"
              aria-label="Restablecer cámara"
              onClick={() => setReset((x) => x + 1)}
            >
              <RotateCcw size={15} />
            </button>
          </div>
          <div className="wiring-scene">
            <StationScene
              key={`${id}:${reset}`}
              variant="wiring"
              sensor={lesson.sensor || id}
              activeStep={step}
              view={view}
              board={app.board === "pico" ? "pico" : "uno"}
              onSelect={setSelected}
            />
            <div className="scene-bottom-hint">
              {selected || "Selecciona un componente para conocerlo"}
            </div>
          </div>
          <div className="wiring-steps">
            <span className="eyebrow">CONEXIÓN PASO A PASO</span>
            {lesson.steps.map((s, i) => (
              <button
                key={i}
                onClick={() => setStep(i)}
                className={`wiring-step ${step === i ? "current" : ""}`}
              >
                <span className="wiring-step-num">
                  {i < step ? <Check size={12} /> : i + 1}
                </span>
                <div>
                  <strong>{s.title}</strong>
                  <p>{s.detail}</p>
                  {s.from && (
                    <code>
                      {s.from} → {s.to}
                    </code>
                  )}
                </div>
              </button>
            ))}
          </div>
          <div className="why-block">
            <Lightbulb size={18} />
            <div>
              <strong>¿Por qué se conecta así?</strong>
              <p>{lesson.why}</p>
            </div>
          </div>
        </section>
        <section className="code-panel">
          <CodeWorkbench
            key={`${id}:${app.board}`}
            lessonId={id}
            code={lesson.code}
            arduinoCode={lesson.arduinoCode}
          />
        </section>
      </div>
      {id === "calibration" && <CalibrationWizard />}
      {id === "cloud" && (
        <div className="cloud-stage-cta">
          <div>
            <h3>Lleva tu planta a Internet.</h3>
            <p>
              Configura la red 2,4 GHz, vincula la placa a tu grupo y carga la
              estación modular.
            </p>
          </div>
          <Button onClick={() => app.navigate("/configuracion")}>
            Configurar estación <ArrowRight size={16} />
          </Button>
        </div>
      )}
      <div className="learning-cards">
        <section className="expected-card">
          <span className="eyebrow">
            <Check size={14} />
            OBSERVA EL RESULTADO
          </span>
          <h3>¿Qué debería pasar?</h3>
          <p>{lesson.expected}</p>
        </section>
        <section className="challenge-card">
          <span className="eyebrow">
            <FlaskConical size={14} />
            HAZLO TUYO
          </span>
          <h3>Un pequeño cambio. Un nuevo descubrimiento.</h3>
          <p>{lesson.challenge}</p>
          <details>
            <summary>
              Necesito una pista <ChevronDown size={14} />
            </summary>
            {lesson.hints.map((h, i) => (
              <p key={i}>{h}</p>
            ))}
          </details>
        </section>
      </div>
      <details className="troubleshooting">
        <summary>
          <ShieldCheck size={17} />
          ¿Algo no funciona? Revisemos juntos.
          <ChevronDown size={17} />
        </summary>
        <ul>
          {lesson.troubleshooting.map((t, i) => (
            <li key={i}>{t}</li>
          ))}
        </ul>
        <button
          className="text-button"
          onClick={() => app.navigate("/diagnostico")}
        >
          Abrir diagnóstico <ArrowUpIcon />
        </button>
      </details>
      <section className="checkpoint">
        <div>
          <span className="eyebrow">TU SIGUIENTE RAÍZ</span>
          <h3>
            {app.session?.progress.includes(id)
              ? "Esta etapa ya es parte de tu recorrido."
              : "Comprende, prueba y continúa."}
          </h3>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={observed}
              onChange={(e) => setObserved(e.target.checked)}
            />
            <span>Probé la actividad y puedo explicar qué ocurrió.</span>
          </label>
        </div>
        <Button onClick={() => void complete()} disabled={!observed}>
          {isCore && index < 5
            ? "Completar y continuar"
            : "Completar actividad"}
          <ArrowRight size={17} />
        </Button>
      </section>
    </div>
  );
}
function ArrowUpIcon() {
  return <ArrowRight size={15} />;
}
