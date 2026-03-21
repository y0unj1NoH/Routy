import { cn } from "@/lib/cn";

type ProgressHeaderProps = {
  currentStep: number;
  totalSteps?: number;
  className?: string;
};

export function ProgressHeader({ currentStep, totalSteps = 5, className }: ProgressHeaderProps) {
  return (
    <header
      className={cn("mx-auto grid w-full max-w-[var(--page-content-max-width)] gap-2.5 md:gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: totalSteps }).map((_, index) => {
        const active = index + 1 <= currentStep;
        return (
          <div
            key={index}
            className={cn(
              "h-3 rounded-full transition-colors md:h-3.5",
              active ? "bg-primary shadow-subtle" : "bg-primary/14"
            )}
          />
        );
      })}
    </header>
  );
}
