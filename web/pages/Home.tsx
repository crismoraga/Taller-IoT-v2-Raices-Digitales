import {
  ArrowRight,
  ArrowUpRight,
  Clock,
  Code2,
  Leaf,
  Radio,
  BookOpen,
  Check,
  ChevronRight,
  Move,
  Network,
  Sprout,
  Usb,
} from "lucide-react";
import StationScene from "../components/StationScene";
import { useApp } from "../lib/context";
import { lessons } from "../data/lessons";
import { Button, Badge } from "../components/Common";
export default function Home() {
  const { session, navigate, openOnboarding } = useApp();
  const core = lessons.filter((x) =>
    ["welcome", "led", "blink", "sensors", "calibration", "cloud"].includes(
      x.id,
    ),
  );
  const next = core.find((x) => !session?.progress.includes(x.id)) || core[0];
  return (
    <div className="home-page">
      <div className="home-greeting">
        <div>
          <span className="eyebrow">
            <span className="live-dot" /> INGENIERÍA QUE CONECTA CON LA VIDA
          </span>
          <h1>
            {session
              ? `Hola, ${session.name || `equipo ${session.groupNumber}`}.`
              : "Pequeñas conexiones."}
            <br />
            <span>
              {session ? "Sigamos creciendo." : "Grandes descubrimientos."}
            </span>
          </h1>
        </div>
        <div className="edition-stamp">
          <span>APRENDE HACIENDO</span>
          <strong>
            Edición <span>02</span>
          </strong>
          <small>Un taller. Infinitas posibilidades.</small>
        </div>
      </div>
      <section className="hero-card">
        <div className="hero-content">
          <Badge tone="sage">
            <Sprout size={13} /> DE LA TIERRA A INTERNET
          </Badge>
          <h2>
            Tu primera
            <br />
            planta <span>conectada.</span>
          </h2>
          <p>
            Descubre cómo una planta puede contarte lo que necesita. Conecta
            sensores, escribe código y da vida a tu propia estación IoT.
          </p>
          <div className="hero-buttons">
            <Button
              onClick={() =>
                session ? navigate(`/taller/${next.id}`) : openOnboarding()
              }
            >
              {session ? "Continuar mi taller" : "Comenzar el taller"}
              <ArrowRight size={18} />
            </Button>
            <button
              className="text-button"
              onClick={() => navigate("/laboratorio")}
            >
              Quiero explorar <ArrowUpRight size={16} />
            </button>
          </div>
          <div className="hero-meta">
            <span>
              <Clock size={14} />
              60 minutos
            </span>
            <span>
              <Code2 size={14} />
              Desde cero
            </span>
            <span>
              <Leaf size={14} />
              Una planta real
            </span>
          </div>
        </div>
        <div className="hero-scene">
          <div className="scene-dots" />
          <StationScene
            variant="hero"
            onSelect={(label) => {
              document.getElementById("scene-selection")!.textContent = label;
            }}
          />
          <div className="scene-live-label">
            <span className="live-dot" />
            ESTACIÓN IoT <span>01</span>
          </div>
          <div className="scene-bottom-hint">
            <Move size={13} />
            <span id="scene-selection">
              Gira, acerca y descubre cada componente
            </span>
          </div>
          <span className="hero-orbit orbit-one" />
          <span className="hero-orbit orbit-two" />
        </div>
      </section>
      <div className="chain-strip">
        <span className="chain-intro">
          ASÍ SE CONECTA
          <br />
          <strong>TODO LO QUE APRENDERÁS</strong>
        </span>
        {[
          { name: "Planta", Icon: Leaf, sub: "Un mundo físico" },
          { name: "Sensores", Icon: Radio, sub: "Escuchar el entorno" },
          { name: "Código", Icon: Code2, sub: "Dar instrucciones" },
          { name: "Internet", Icon: Network, sub: "Conectar los datos" },
        ].map(({ name, Icon, sub }, i) => (
          <div className="chain-node" key={name}>
            <span className="chain-icon">
              <Icon size={20} />
            </span>
            <div>
              <strong>{name}</strong>
              <small>{sub}</small>
            </div>
            {i < 3 && <ChevronRight className="chain-chevron" size={18} />}
          </div>
        ))}
      </div>
      <section className="journey-section">
        <div className="section-heading">
          <div>
            <span className="eyebrow">PASO A PASO, RAÍZ A RAÍZ</span>
            <h2>
              Tu camino hacia el IoT<span className="small-period">.</span>
            </h2>
          </div>
          <span className="journey-count">
            6 etapas <span>·</span> 60 minutos
          </span>
        </div>
        <div className="journey-cards">
          {core.map((l, i) => (
            <button
              key={l.id}
              className={`journey-card ${session?.progress.includes(l.id) ? "completed" : ""}`}
              onClick={() =>
                session ? navigate(`/taller/${l.id}`) : openOnboarding()
              }
            >
              <div className="journey-card-top">
                <span className="card-number">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="card-time">
                  <Clock size={11} />
                  {l.duration} min
                </span>
              </div>
              <div className={`lesson-illustration illustration-${i}`}>
                <span>
                  {
                    [
                      <Sprout size={31} />,
                      <span className="led-drawing" />,
                      <span className="wave-drawing">∿</span>,
                      <Radio size={30} />,
                      <span className="calibration-drawing">↔</span>,
                      <Network size={31} />,
                    ][i]
                  }
                </span>
                <span className="illustration-dots" />
              </div>
              <h3>{l.title}</h3>
              <p>{l.description}</p>
              <div className="card-action">
                <span>
                  {session?.progress.includes(l.id)
                    ? "Completado"
                    : i === 0
                      ? "Empieza por aquí"
                      : "Descubrir etapa"}
                </span>
                {session?.progress.includes(l.id) ? (
                  <Check size={15} />
                ) : (
                  <ArrowRight size={15} />
                )}
              </div>
            </button>
          ))}
        </div>
      </section>
      <section className="home-bottom">
        <div className="explore-banner">
          <span className="explore-icon">
            <BookOpen size={23} />
          </span>
          <div>
            <h3>La curiosidad no tiene un solo camino.</h3>
            <p>Prueba todos los sensores de tu kit en el laboratorio libre.</p>
          </div>
          <button
            className="round-button"
            aria-label="Explorar laboratorio"
            onClick={() => navigate("/laboratorio")}
          >
            <ArrowUpRight size={21} />
          </button>
        </div>
        <div className="help-banner">
          <Usb size={22} />
          <div>
            <h3>¿Tu primera vez conectando?</h3>
            <button onClick={() => navigate("/diagnostico")}>
              Revisa la guía de conexión <ArrowUpRight size={13} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
