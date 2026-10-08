import { useState } from "react";
import {
  Search,
  ArrowUpRight,
  Radio,
  FlaskConical,
  Clock,
  Leaf,
  Sun,
  Droplets,
  Thermometer,
  Ruler,
  Activity,
  Code2,
} from "lucide-react";
import { useApp } from "../lib/context";
import { lessons, sensors } from "../data/lessons";
import { PageHeading, Badge, Button } from "../components/Common";
export default function Lab() {
  const app = useApp();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState("Todos");
  const extra = lessons.filter(
    (l) =>
      !["welcome", "led", "blink", "sensors", "calibration", "cloud"].includes(
        l.id,
      ),
  );
  const isSensor = (l: (typeof extra)[number]) =>
    sensors.some((s) => s.lessonId === l.id);
  const filtered = extra.filter(
    (l) =>
      (!search ||
        `${l.title} ${l.description} ${l.materials.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase())) &&
      (category === "Todos" ||
        (category === "Sensores" && isSensor(l)) ||
        (category === "Actuadores y kit" && !isSensor(l))),
  );
  return (
    <div className="lab-page">
      <PageHeading
        eyebrow="UN ESPACIO PARA PREGUNTARSE ¿Y SI…?"
        title="La curiosidad echa raíces."
        description="Cada sensor es una nueva forma de escuchar al mundo. Elige uno, conéctalo y experimenta."
        action={
          <Badge tone="sage">
            <FlaskConical size={14} /> MODO LIBRE
          </Badge>
        }
      />
      <div className="lab-intro">
        <div>
          <Radio size={27} />
          <div>
            <strong>Tu kit tiene mucho que contar.</strong>
            <p>
              Los siete sensores comprados, componentes básicos y desafíos del
              kit MCI. Sin cambiar el trabajo de otros equipos.
            </p>
          </div>
        </div>
        <Button variant="secondary" onClick={() => app.navigate("/dashboard")}>
          Probar sin hardware <ArrowUpRight size={15} />
        </Button>
      </div>
      <div className="lab-filters">
        <div className="segmented">
          {["Todos", "Sensores", "Actuadores y kit"].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="search-field">
          <Search size={16} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Busca un sensor o componente…"
            aria-label="Buscar experimentos"
          />
        </div>
      </div>
      <div className="experiment-grid">
        {filtered.map((l, i) => {
          const sensor = sensors.find((s) => s.lessonId === l.id);
          return (
            <button
              className="experiment-card"
              key={l.id}
              onClick={() =>
                app.session
                  ? app.navigate(`/taller/${l.id}`)
                  : app.openOnboarding()
              }
            >
              <div className="experiment-top">
                <span className={`sensor-icon sensor-tone-${i % 4}`}>
                  {l.id.includes("soil") ? (
                    <Leaf size={24} />
                  ) : l.id.includes("dht") ||
                    l.id.includes("ds18") ||
                    l.id.includes("lm35") ? (
                    <Thermometer size={24} />
                  ) : l.id === "ldr" ? (
                    <Sun size={24} />
                  ) : l.id === "distance" ? (
                    <Ruler size={24} />
                  ) : l.id === "motion" ? (
                    <Activity size={24} />
                  ) : l.id.includes("water") || l.id === "rain" ? (
                    <Droplets size={24} />
                  ) : (
                    <Code2 size={24} />
                  )}
                </span>
                <ArrowUpRight size={17} />
              </div>
              <span className="eyebrow">
                {sensor?.model || "KIT MCI · EXPLORA"}
              </span>
              <h3>{l.title}</h3>
              <p>{l.description}</p>
              <div className="experiment-bottom">
                <Badge>{sensor?.type || "Experimento"}</Badge>
                <span>
                  <Clock size={12} />
                  {l.duration} min
                </span>
              </div>
              {app.session?.progress.includes(l.id) && (
                <span className="completed-label">Completado ✓</span>
              )}
            </button>
          );
        })}
      </div>
      {!filtered.length && (
        <p className="empty-text">No hay experimentos para esa búsqueda.</p>
      )}
      <div className="lab-inventory">
        <strong>10 estaciones listas para aprender.</strong>
        <span>
          12 sensores por modelo: 10 operativos + 2 repuestos. Usa el LM35
          individualmente: la estación final ocupa los tres ADC de Pico.
        </span>
      </div>
    </div>
  );
}
