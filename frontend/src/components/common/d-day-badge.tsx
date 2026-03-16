import { Badge } from "@/components/ui/badge";
import { DDAY_BADGE_STYLE } from "@/lib/badge-theme";

type DDayBadgeProps = {
  label: string;
};

export function DDayBadge({ label }: DDayBadgeProps) {
  return (
    <Badge
      tone="primary"
      className="min-w-18 justify-center border-transparent px-3 py-1 text-xs font-semibold text-white shadow-[0_8px_16px_rgba(15,23,42,0.12)]"
      style={{ backgroundColor: DDAY_BADGE_STYLE.bg, color: DDAY_BADGE_STYLE.text }}
    >
      {label}
    </Badge>
  );
}
