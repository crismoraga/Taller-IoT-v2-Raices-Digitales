import { useState } from "react";
import { Icon } from "../brand/Graphics";
import { lessons, stageOf } from "../content";
import { sensors } from "../data/lessons";
import { useApp } from "../lib/context";
import { useProgress } from "../lib/progress";
import { Button } from "../ui/Button";
import { CardButton, Segmented, Tag } from "../ui/Card";
import { Page, PageHeader } from "../ui/Layout";

export default function Lab() {
  const app = useApp(),
    progress = useProgress();
  const [search, setSearch] = useState(""),
    [category, setCategory] = useState<"all" | "sensors" | "kit">("all");
  const catalog = lessons.filter(
    (lesson) =>
      ![
        "welcome",
        "calibration",
        "station",
        "cloud",
        "dashboard",
        "alerts",
      ].includes(lesson.id),
  );
  const visible = catalog.filter((lesson) => {
    const sensor = sensors.find((item) => item.lessonId === lesson.id);
    const text = [
      lesson.title,
      lesson.summary,
      sensor?.model,
      ...lesson.materials.map((item) => item.name),
    ]
      .join(" ")
      .toLocaleLowerCase("es");
    return (
      text.includes(search.toLocaleLowerCase("es")) &&
      (category === "all" ||
        (category === "sensors" ? Boolean(sensor) : !sensor))
    );
  });
  return (
    <Page>
      <PageHeader
        kicker="ZONA EXPLORA"
        title="¿Y si pruebas algo nuevo?"
        subtitle="Cada pieza transforma una pregunta en un experimento. Explora tu kit, cambia el código y observa lo que sucede."
        actions={
          <Tag tone="cream" icon="flask">
            {catalog.length} actividades reales
          </Tag>
        }
      />
      <div className="mt-6 grid gap-3 rounded-xl border border-border bg-surface p-5 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="t-heading text-ink">
            Tú haces las preguntas. El circuito responde.
          </h2>
          <p className="mt-1 text-ink-soft">
            Cada actividad incluye materiales, conexiones, código editable y un
            reto. Usa tu espacio de grupo para conservar lo que descubres.
          </p>
        </div>
        <Button
          variant="outline"
          icon="chart"
          onClick={() => app.navigate("/planta")}
        >
          Practicar con datos
        </Button>
      </div>
      <div className="my-6 flex flex-wrap items-center justify-between gap-4">
        <Segmented
          label="Tipo de experimento"
          value={category}
          onChange={setCategory}
          options={[
            { value: "all", label: "Todos" },
            { value: "sensors", label: "Sensores" },
            { value: "kit", label: "Actuadores y kit" },
          ]}
        />
        <label className="flex min-h-12 w-full items-center gap-3 rounded-md border border-border bg-surface px-4 text-ink-soft sm:w-80">
          <Icon name="search" size={19} />
          <input
            className="min-w-0 flex-1 bg-transparent py-3 text-ink outline-none"
            aria-label="Buscar experimentos"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Sensor, componente o pregunta…"
          />
        </label>
      </div>
      <p className="mb-3 text-sm font-bold text-ink-soft" role="status">
        {visible.length} experimentos para explorar
      </p>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((lesson) => {
          const sensor = sensors.find((item) => item.lessonId === lesson.id),
            done = progress.done.has(lesson.id);
          return (
            <CardButton
              className="experiment-card group flex flex-col gap-4 p-6"
              key={lesson.id}
              onClick={() =>
                app.session
                  ? app.navigate(`/taller/${lesson.id}`)
                  : app.openOnboarding(`/taller/${lesson.id}`)
              }
            >
              <div className="flex items-center justify-between">
                <span className="grid size-14 place-items-center rounded-lg bg-highlight text-ink-accent transition-transform group-hover:-rotate-6">
                  <Icon name={lesson.icon} size={27} />
                </span>
                <Icon
                  name="arrowRight"
                  size={20}
                  className="text-ink-soft transition-transform group-hover:translate-x-1"
                />
              </div>
              <div>
                <span className="t-overline text-ink-accent">
                  {sensor?.model || stageOf(lesson).label}
                </span>
                <h2 className="t-heading mt-2 text-ink">{lesson.title}</h2>
                <p className="mt-2 text-[15px] leading-6 text-ink-soft">
                  {lesson.summary}
                </p>
              </div>
              <div className="mt-auto flex items-center justify-between border-t border-border pt-3">
                <Tag
                  tone={done ? "success" : "neutral"}
                  icon={done ? "check" : "cable"}
                >
                  {done ? "Completado" : sensor?.type || "Kit MCI"}
                </Tag>
                <span className="flex items-center gap-1 text-sm font-bold text-ink-soft">
                  <Icon name="clock" size={14} />
                  {lesson.duration} min
                </span>
              </div>
            </CardButton>
          );
        })}
      </div>
      {!visible.length && (
        <div className="my-12 text-center text-ink">
          <Icon
            name="search"
            size={36}
            className="mx-auto mb-3 text-ink-accent"
          />
          <h2 className="t-heading">Todavía no encontramos esa pregunta.</h2>
          <p className="mt-2 text-ink-soft">
            Prueba con el modelo, como DHT11, o con el nombre del componente.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSearch("");
              setCategory("all");
            }}
          >
            Mostrar todo el kit
          </Button>
        </div>
      )}
      <div className="mt-8 flex flex-wrap items-center gap-3 rounded-xl bg-primary px-6 py-5 text-cream">
        <Icon name="board" size={24} />
        <div>
          <strong>10 estaciones · 2 repuestos por sensor comprado</strong>
          <p className="mt-1 text-sm text-on-dark">
            La estación usa los tres ADC de Pico: suelo, luz y agua. El LM35 se
            explora por separado.
          </p>
        </div>
      </div>
    </Page>
  );
}
