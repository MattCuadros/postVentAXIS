import { cn } from "@/lib/cn";

export interface ProgressStepsProps {
  steps: string[];
  currentStep: number;
}

export function ProgressSteps({ steps, currentStep }: ProgressStepsProps) {
  if (steps.length === 0) return null;

  const activeStep = Math.min(Math.max(currentStep, 0), steps.length - 1);

  return (
    <div aria-label={`Paso ${activeStep + 1} de ${steps.length}: ${steps[activeStep]}`} className="w-full">
      <ol className="flex items-start">
        {steps.map((step, index) => {
          const complete = index < activeStep;
          const current = index === activeStep;

          return (
            <li key={step} className="flex min-w-0 flex-1 items-center last:flex-none">
              <div className="flex min-w-0 flex-col items-center">
                <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold", (complete || current) && "border-accent bg-accent text-white", !complete && !current && "border-line bg-surface-secondary text-ink-muted")} aria-current={current ? "step" : undefined}>
                  {complete ? "✓" : index + 1}
                </span>
                <span className="mt-2 hidden text-center text-xs font-bold text-ink-secondary sm:block">{step}</span>
              </div>
              {index < steps.length - 1 && <span aria-hidden="true" className={cn("mx-1 mt-[-1.25rem] h-0.5 min-w-2 flex-1", complete ? "bg-accent" : "bg-line")} />}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-center text-sm font-bold text-ink sm:hidden">{steps[activeStep]}</p>
    </div>
  );
}
