import { BusFront, Footprints, TrainFront } from "lucide-react";

import type { RouteTravelInfo } from "@/lib/route-travel";

export function RouteTravelIcon({ kind }: { kind: RouteTravelInfo["icon"] }) {
  if (kind === "walk") return <Footprints className="h-4 w-4" />;
  if (kind === "subway") return <TrainFront className="h-4 w-4" />;
  return <BusFront className="h-4 w-4" />;
}
