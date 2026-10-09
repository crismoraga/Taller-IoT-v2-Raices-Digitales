import { useState } from "react";
import { Icon } from "../brand/Graphics";
import type { QuizQuestion } from "../content/types";
import { Button } from "../ui/Button";
import { SegmentedProgress } from "../ui/Progress";
import { cx } from "../ui/cx";

const LETTERS = ["A", "B", "C", "D"];

/**
 * Checkpoint: una pregunta a la vez, sin reloj. Cada respuesta —acierte o no— muestra una
 * explicación corta: esa es la microlección. Acierto y error llevan ícono y palabra.
 */
export function Quiz({
  questions,
  onComplete,
}: {
  questions: QuizQuestion[];
  /** Se llama al terminar, con la cantidad de aciertos al primer intento. */
  onComplete: (correct: number) => void;
}) {
  const [index, setIndex] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [firstTry, setFirstTry] = useState(0);
  const [attempted, setAttempted] = useState(false);
  const [finished, setFinished] = useState(false);
  const question = questions[index];
  const right = picked === question.answer;

  const choose = (option: number) => {
    if (picked !== null && right) return;
    setPicked(option);
    if (option === question.answer && !attempted)
      setFirstTry((count) => count + 1);
    setAttempted(true);
  };
  const next = () => {
    if (index === questions.length - 1) {
      setFinished(true);
      onComplete(firstTry);
      return;
    }
    setIndex(index + 1);
    setPicked(null);
    setAttempted(false);
  };

  if (finished)
    return (
      <div className="flex items-center gap-3 rounded-[18px] border border-success/45 bg-success-soft p-4 text-success-ink">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-success text-white">
          <Icon name="check" size={18} strokeWidth={3} />
        </span>
        <p className="font-display text-[15px] font-bold leading-5">
          Checkpoint completado: {firstTry} de {questions.length} al primer
          intento.
        </p>
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="t-overline text-ink-accent">
          Pregunta {index + 1} de {questions.length}
        </p>
        <SegmentedProgress
          className="mt-2 max-w-48"
          total={questions.length}
          done={index}
          current={index}
          onDark={false}
          label="Avance del checkpoint"
        />
      </div>
      <h3 className="t-heading text-ink">{question.question}</h3>
      <div
        role="radiogroup"
        aria-label={question.question}
        className="flex flex-col gap-2.5"
      >
        {question.options.map((option, optionIndex) => {
          const selected = picked === optionIndex;
          const state = !selected
            ? "idle"
            : optionIndex === question.answer
              ? "right"
              : "wrong";
          return (
            <button
              key={option}
              type="button"
              role="radio"
              tabIndex={optionIndex === (picked ?? 0) ? 0 : -1}
              aria-checked={selected}
              disabled={right && !selected}
              onClick={() => choose(optionIndex)}
              onKeyDown={(event) => {
                if (
                  right ||
                  !["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"].includes(
                    event.key,
                  )
                )
                  return;
                event.preventDefault();
                const delta =
                  event.key === "ArrowDown" || event.key === "ArrowRight"
                    ? 1
                    : -1;
                const next =
                  (optionIndex + delta + question.options.length) %
                  question.options.length;
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
                  [next]?.focus();
                choose(next);
              }}
              className={cx(
                "pressable focus-ring flex min-h-[58px] items-center gap-3.5 rounded-md border-[1.5px] px-3.5 py-2.5 text-left text-base font-bold text-ink disabled:opacity-55",
                state === "idle" &&
                  "border-border bg-surface hover:border-border-strong hover:bg-surface-alt",
                state === "right" && "border-2 border-success bg-success-soft",
                state === "wrong" && "border-2 border-danger bg-danger-soft",
              )}
            >
              <span
                className={cx(
                  "flex size-8 shrink-0 items-center justify-center rounded-[10px] font-display text-sm font-extrabold",
                  state === "idle" && "bg-surface-alt text-ink-accent",
                  state === "right" && "bg-success text-white",
                  state === "wrong" && "bg-danger text-white",
                )}
              >
                {state === "right" ? (
                  <Icon name="check" size={16} strokeWidth={3} />
                ) : state === "wrong" ? (
                  <Icon name="close" size={16} strokeWidth={3} />
                ) : (
                  LETTERS[optionIndex]
                )}
              </span>
              <span className="min-w-0 flex-1 leading-[22px]">{option}</span>
            </button>
          );
        })}
      </div>
      {picked !== null && (
        <div
          role="status"
          className={cx(
            "flex animate-rise flex-col gap-2.5 rounded-[18px] border p-4",
            right
              ? "border-success bg-success-soft"
              : "border-danger bg-danger-soft",
          )}
        >
          <p
            className={cx(
              "flex items-center gap-2.5 font-display text-[17px] font-bold",
              right ? "text-success-ink" : "text-danger-ink",
            )}
          >
            <span
              className={cx(
                "flex size-8 items-center justify-center rounded-full text-white",
                right ? "bg-success" : "bg-danger",
              )}
            >
              <Icon
                name={right ? "check" : "close"}
                size={16}
                strokeWidth={3}
              />
            </span>
            {right ? "¡Correcto!" : "Casi. Inténtalo otra vez"}
          </p>
          {right ? (
            <p className="text-[15px] leading-[22px] text-success-ink">
              {question.explain}
            </p>
          ) : (
            <p className="text-[15px] leading-[22px] text-danger-ink">
              {question.explain} Revisa las alternativas y vuelve a intentarlo.
            </p>
          )}
          {right && (
            <Button
              className="self-start"
              iconRight="arrowRight"
              onClick={next}
            >
              {index === questions.length - 1
                ? "Terminar checkpoint"
                : "Siguiente pregunta"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
