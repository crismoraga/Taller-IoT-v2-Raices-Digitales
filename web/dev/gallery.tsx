import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import "../index.css";
import { BreadboardView } from "../circuit/BreadboardView";
import { circuits, type CircuitId } from "../circuit/layouts";
import { analyze } from "../circuit/netlist";
import { Button } from "../ui/Button";
import { Segmented } from "../ui/Card";

/** Galería interna para revisar cada montaje paso a paso. No forma parte del taller. */
function Gallery() {
  const params = new URLSearchParams(location.search);
  const [id, setId] = useState<CircuitId>((params.get("c") as CircuitId) || "led");
  const [step, setStep] = useState(Number(params.get("step") ?? 0));
  const [complete, setComplete] = useState(params.has("all"));
  const circuit = circuits[id];
  const current = circuit.steps[Math.min(step, circuit.steps.length - 1)];
  const issues = analyze(circuit, { splitRails: true, vbus: 5.25 }).issues;
  return (
    <div className="mx-auto flex min-h-dvh max-w-[1500px] flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(circuits) as CircuitId[]).map((key) => (
          <button
            key={key}
            onClick={() => {
              setId(key);
              setStep(0);
            }}
            className={`rounded-pill border px-3 py-1 text-sm font-bold ${key === id ? "border-action bg-action text-action-ink" : "border-border bg-surface text-ink"}`}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="h-[560px]">
        <BreadboardView circuit={circuit} stepIndex={step} complete={complete} lit={{ led: true }} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" onClick={() => setStep(Math.max(0, step - 1))}>Anterior</Button>
        <Button size="sm" onClick={() => setStep(Math.min(circuit.steps.length - 1, step + 1))}>Siguiente</Button>
        <Segmented
          label="Vista"
          value={complete ? "all" : "step"}
          onChange={(value) => setComplete(value === "all")}
          options={[{ value: "step", label: "Paso a paso" }, { value: "all", label: "Completo" }]}
        />
        <p className="t-label">Paso {step + 1} de {circuit.steps.length}: {current?.title}</p>
      </div>
      <p className="text-sm text-ink-soft">{current?.detail}</p>
      <pre className="t-mono whitespace-pre-wrap text-danger-text">{issues.map((issue) => `${issue.level} ${issue.code}: ${issue.message}`).join("\n") || "Revisión eléctrica: sin problemas."}</pre>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
