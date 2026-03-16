import { cn } from "@/lib/cn";

type ProgressHeaderProps = {
  currentStep: number;
  totalSteps?: number;
  className?: string;
};

export function ProgressHeader({ currentStep, totalSteps = 5, className }: ProgressHeaderProps) {
  return (
    <header
      className={cn("mx-auto grid w-full max-w-[1194px] gap-3", className)}
      style={{ gridTemplateColumns: `repeat(${totalSteps}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: totalSteps }).map((_, index) => {
        const active = index + 1 <= currentStep;
        return (
          <div
            key={index}
            className={cn(
              "h-4 rounded-full transition-colors",
              active ? "bg-primary shadow-[0_8px_18px_rgba(60,157,255,0.18)]" : "bg-primary/14"
            )}
          />
        );
      })}
    </header>
  );
}
