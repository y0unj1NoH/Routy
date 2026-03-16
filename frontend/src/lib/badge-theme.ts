import {
  MUST_VISIT_BADGE,
  type PlaceCategoryValue,
  type ThemeValue
} from "@/constants/route-taxonomy";

export type BadgeIconName =
  | "Landmark"
  | "UtensilsCrossed"
  | "ShoppingBag"
  | "Trees"
  | "Mountain"
  | "User"
  | "Users"
  | "Heart"
  | "Home"
  | "UsersRound"
  | "Zap"
  | "Compass"
  | "Leaf";

export const BADGE_TEXT_COLOR = "#FFFFFF";

export const BADGE_COLORS = {
  primary: "#3C9DFF",

  meal: "#F08A4B",
  brunch: "#F3A35F",
  cafe: "#5B8CBE",
  snack: "#D56BA5",
  night: "#3E4A78",
  activity: "#4A8E85",
  landmark: "#4C7FEF",
  shopping: "#8B78F2",
  nature: "#4EAF7A",

  solo: "#4C8BF5",
  friends: "#3CB6E9",
  couple: "#E96C8D",
  family: "#47B881",
  group: "#F29A4A",

  intense: "#F07A4B",
  moderate: "#5C8EF3",
  relaxed: "#4DB6A6"
} as const;

export type CompanionValue = "SOLO" | "FRIENDS" | "COUPLE" | "FAMILY" | "GROUP";

export type PaceValue = "INTENSE" | "MODERATE" | "RELAXED";

export const BADGE_COLOR_MAP = {
  [MUST_VISIT_BADGE]: "#ED7B8D"
} as const;

export const CATEGORY_BADGE_MAP = {
  STAY: {
    label: "STAY",
    border: "#BFE8E2",
    bg: "#F1FCF9",
    text: "#1C8174"
  },
  MEAL: {
    label: "MEAL",
    border: "#FFDCC3",
    bg: "#FFF4EA",
    text: "#B85E23"
  },
  BRUNCH: {
    label: "BRUNCH",
    border: "#FFE3C7",
    bg: "#FFF5EB",
    text: "#B9721F"
  },
  CAFE: {
    label: "CAFE",
    border: "#D6E7F7",
    bg: "#F1F7FC",
    text: "#3E6F95"
  },
  SNACK: {
    label: "SNACK",
    border: "#F3D3E6",
    bg: "#FDF1F8",
    text: "#B04B82"
  },
  NIGHT: {
    label: "NIGHT",
    border: "#D7DCF5",
    bg: "#F2F4FD",
    text: "#4B568B"
  },
  ACTIVITY: {
    label: "ACTIVITY",
    border: "#CDE8E2",
    bg: "#EFFAF7",
    text: "#2F7A71"
  },
  LANDMARK: {
    label: "LANDMARK",
    border: "#CFD9FF",
    bg: "#F3F6FF",
    text: "#4D74D6"
  },
  SHOP: {
    label: "SHOP",
    border: "#E0D6FF",
    bg: "#F6F2FF",
    text: "#6F57D5"
  },
  NATURE: {
    label: "NATURE",
    border: "#CFE7D9",
    bg: "#F0FAF4",
    text: "#3E8C64"
  }
} as const satisfies Record<PlaceCategoryValue, { label: string; border: string; bg: string; text: string }>;

export const COMPANION_BADGE_MAP = {
  SOLO: {
    label: "나 홀로 여행",
    bg: BADGE_COLORS.solo,
    text: BADGE_TEXT_COLOR,
    icon: "User"
  },
  FRIENDS: {
    label: "친구와 함께",
    bg: BADGE_COLORS.friends,
    text: BADGE_TEXT_COLOR,
    icon: "Users"
  },
  COUPLE: {
    label: "연인과 로맨틱하게",
    bg: BADGE_COLORS.couple,
    text: BADGE_TEXT_COLOR,
    icon: "Heart"
  },
  FAMILY: {
    label: "가족과 오붓하게",
    bg: BADGE_COLORS.family,
    text: BADGE_TEXT_COLOR,
    icon: "Home"
  },
  GROUP: {
    label: "여럿이 북적북적",
    bg: BADGE_COLORS.group,
    text: BADGE_TEXT_COLOR,
    icon: "UsersRound"
  }
} as const satisfies Record<CompanionValue, { label: string; bg: string; text: string; icon: BadgeIconName }>;

export const PACE_BADGE_MAP = {
  INTENSE: {
    label: "알차게",
    bg: BADGE_COLORS.intense,
    text: BADGE_TEXT_COLOR,
    icon: "Zap"
  },
  MODERATE: {
    label: "적당히",
    bg: BADGE_COLORS.moderate,
    text: BADGE_TEXT_COLOR,
    icon: "Compass"
  },
  RELAXED: {
    label: "느긋하게",
    bg: BADGE_COLORS.relaxed,
    text: BADGE_TEXT_COLOR,
    icon: "Leaf"
  }
} as const satisfies Record<PaceValue, { label: string; bg: string; text: string; icon: BadgeIconName }>;

export const THEME_BADGE_MAP = {
  FOODIE: {
    label: "식도락이 1순위",
    shortLabel: "식도락",
    bg: BADGE_COLORS.meal,
    text: BADGE_TEXT_COLOR,
    icon: "UtensilsCrossed"
  },
  LANDMARK: {
    label: "대표 명소 정복",
    shortLabel: "명소",
    bg: BADGE_COLORS.landmark,
    text: BADGE_TEXT_COLOR,
    icon: "Landmark"
  },
  SHOPPING: {
    label: "취향 가득 쇼핑",
    shortLabel: "쇼핑",
    bg: BADGE_COLORS.shopping,
    text: BADGE_TEXT_COLOR,
    icon: "ShoppingBag"
  },
  NATURE: {
    label: "자연 속에서 힐링",
    shortLabel: "자연",
    bg: BADGE_COLORS.nature,
    text: BADGE_TEXT_COLOR,
    icon: "Trees"
  }
} as const satisfies Record<ThemeValue, { label: string; shortLabel: string; bg: string; text: string; icon: BadgeIconName }>;

export const DDAY_BADGE_STYLE = {
  bg: BADGE_COLORS.primary,
  text: BADGE_TEXT_COLOR
} as const;

const CATEGORY_BADGE_ALIASES: Record<string, PlaceCategoryValue> = {
  STAY: "STAY",
  숙소: "STAY",
  MEAL: "MEAL",
  식사: "MEAL",
  BRUNCH: "BRUNCH",
  브런치: "BRUNCH",
  아침: "BRUNCH",
  CAFE: "CAFE",
  카페: "CAFE",
  SNACK: "SNACK",
  간식: "SNACK",
  디저트: "SNACK",
  NIGHT: "NIGHT",
  밤: "NIGHT",
  바: "NIGHT",
  ACTIVITY: "ACTIVITY",
  액티비티: "ACTIVITY",
  체험: "ACTIVITY",
  오락: "ACTIVITY",
  LANDMARK: "LANDMARK",
  명소: "LANDMARK",
  SHOP: "SHOP",
  쇼핑: "SHOP",
  NATURE: "NATURE",
  자연: "NATURE"
};

export function resolveBadgeColor(value: string | null | undefined) {
  if (!value) return null;
  const key = value.trim().replace(/[\s_-]+/g, "").toUpperCase() as keyof typeof BADGE_COLOR_MAP;
  return BADGE_COLOR_MAP[key] || null;
}

export type { PlaceCategoryValue, ThemeValue } from "@/constants/route-taxonomy";

export function resolveCategoryBadgeTheme(value: string | null | undefined) {
  if (!value) return null;
  const key = CATEGORY_BADGE_ALIASES[value.trim()] || CATEGORY_BADGE_ALIASES[value.trim().toUpperCase()];
  return key ? CATEGORY_BADGE_MAP[key] : null;
}
