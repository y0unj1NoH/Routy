import { cn } from "@/lib/cn";

export const MASCOT_SIZE_CLASS = {
  dialog: "h-[var(--mascot-dialog-size)] w-[var(--mascot-dialog-size)]",
  compactAside: "h-[var(--mascot-compact-aside-size)] w-[var(--mascot-compact-aside-size)]",
  funnel: "h-[var(--mascot-funnel-size)] w-[var(--mascot-funnel-size)]",
  emptyState: "h-[var(--mascot-empty-size)] w-[var(--mascot-empty-size)]",
  loading: "h-[var(--mascot-loading-size)] w-[var(--mascot-loading-size)]",
  pageHero: "h-[var(--mascot-page-hero-size)] w-[var(--mascot-page-hero-size)]",
  celebration: "h-[var(--mascot-celebration-size)] w-[var(--mascot-celebration-size)]",
  compact: "h-[var(--mascot-compact-size)] w-[var(--mascot-compact-size)]",
  featuredPage: "h-[var(--mascot-featured-size)] w-[var(--mascot-featured-size)]"
} as const;

const MASCOT_ASSETS = {
  airplane: {
    src: "/airplane_dog.png",
    alt: "비행기를 타고 여행하는 강아지"
  },
  calendar: {
    src: "/calendar_dog.png",
    alt: "달력을 보며 여행 날짜를 고르는 강아지"
  },
  celebration: {
    src: "/celebration_dog.png",
    alt: "축하하는 강아지"
  },
  detective: {
    src: "/detective_dog.png",
    alt: "리스트를 살펴보는 강아지"
  },
  friend: {
    src: "/friend_dog.png",
    alt: "함께 여행할 친구를 기다리는 강아지"
  },
  greeting: {
    src: "/greeting_dog.png",
    alt: "반갑게 인사하는 강아지"
  },
  hotel: {
    src: "/hotel_dog.png",
    alt: "호텔을 보며 묵을 곳을 고르는 강아지"
  },
  map: {
    src: "/map_dog.png",
    alt: "지도를 보고 여행 경로를 확인하는 강아지"
  },
  sad: {
    src: "/sad_dog.png",
    alt: "떠나는 걸 아쉬워하는 강아지"
  },
  surprise: {
    src: "/surprise_dog.png",
    alt: "깜짝 놀라 길 안내를 도와주는 강아지"
  }
} as const;

export type MascotVariant = keyof typeof MASCOT_ASSETS;

type MascotProps = {
  variant?: MascotVariant;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  floating?: boolean;
};

export function Mascot({
  variant = "airplane",
  className,
  imageClassName,
  floating = false
}: MascotProps) {
  const asset = MASCOT_ASSETS[variant];
  const shouldFloat = floating && variant === "airplane";

  return (
    <div className={cn("relative h-[var(--mascot-page-hero-size)] w-[var(--mascot-page-hero-size)]", className)}>
      <div
        role="img"
        aria-label={asset.alt}
        style={{ backgroundImage: `url("${asset.src}")` }}
        className={cn(
          "h-full w-full bg-contain bg-center bg-no-repeat drop-shadow-mascot",
          shouldFloat && "motion-safe:animate-mascot-float motion-reduce:animate-none",
          imageClassName
        )}
      />
    </div>
  );
}
