import {
  Compass,
  Heart,
  House,
  Landmark,
  Leaf,
  Mountain,
  ShoppingBag,
  TreePine,
  User,
  Users,
  UsersRound,
  UtensilsCrossed,
  Zap
} from "lucide-react";
import type { ComponentType } from "react";

import type { BadgeIconName } from "@/lib/badge-theme";
import { cn } from "@/lib/cn";

const ICON_MAP = {
  Landmark,
  UtensilsCrossed,
  ShoppingBag,
  Trees: TreePine,
  Mountain,
  User,
  Users,
  Heart,
  Home: House,
  UsersRound,
  Zap,
  Compass,
  Leaf
} as const satisfies Record<BadgeIconName, ComponentType<{ className?: string }>>;

type BadgeIconProps = {
  name: BadgeIconName;
  className?: string;
};

export function BadgeIcon({ name, className }: BadgeIconProps) {
  const Icon = ICON_MAP[name];
  return <Icon aria-hidden="true" className={cn("shrink-0", className)} />;
}
