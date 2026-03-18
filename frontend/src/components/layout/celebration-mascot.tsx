import { cn } from "@/lib/cn";
import { Mascot } from "@/components/layout/mascot";

type CelebrationMascotProps = {
  className?: string;
};

export function CelebrationMascot({ className }: CelebrationMascotProps) {
  return <Mascot variant="celebration" className={cn("h-[var(--mascot-celebration-size)] w-[var(--mascot-celebration-size)]", className)} />;
}
