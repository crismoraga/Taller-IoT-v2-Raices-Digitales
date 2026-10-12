import { lazy, Suspense, useState } from "react";
import { BreadboardView } from "../circuit/BreadboardView";
import type { Circuit } from "../circuit/model";
import { Segmented } from "../ui/Card";
import { readLocal, writeLocal } from "../lib/theme";

const CircuitExperience = lazy(() => import("../experience/CircuitExperience"));

/** A touchable model is the lesson's first explanation, rather than a materials checklist. */
export function BoardDiscovery({ circuit }: { circuit: Circuit }) {
  // Board variants share the same preference: choosing Uno must not silently
  // replace a learner's 2D plan with a different viewing mode.
  const baseId = circuit.id.replace(/-(?:uno|nano(?:-old)?)$/, "");
  const viewPreference = `raices.discovery.view.${baseId}`;
  const [view, setView] = useState<"3d" | "2d">(() => {
    const saved = readLocal<"3d" | "2d">(viewPreference, "3d");
    return saved === "2d" ? "2d" : "3d";
  });
  return (
    <section
      className="solarpunk-discovery-card min-w-0 overflow-hidden rounded-2xl border border-border bg-surface"
      aria-label="Explorador interactivo de la placa"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <div>
          <p className="t-overline text-ink-accent">
            Tu laboratorio, por dentro
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Arrastra para girar. Toca un pin, una pieza o un agujero.
          </p>
        </div>
        <Segmented
          size="sm"
          label="Vista del explorador"
          value={view}
          onChange={(value) => {
            setView(value);
            writeLocal(viewPreference, value);
          }}
          options={[
            { value: "3d", label: "Explorar en 3D", icon: "cube" },
            { value: "2d", label: "Plano 2D", icon: "layers" },
          ]}
        />
      </div>
      {view === "3d" ? (
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
