import { cn } from "@/lib/cn";

export const MASCOT_SIZE_CLASS = {
  compact: "h-28 w-28",
  featuredPage: "h-48 w-48 md:h-56 md:w-56"
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

  return (
    <div className={cn("relative h-44 w-44", className)}>
      <div
        role="img"
        aria-label={asset.alt}
        style={{ backgroundImage: `url("${asset.src}")` }}
        className={cn(
          "h-full w-full bg-contain bg-center bg-no-repeat drop-shadow-[0_18px_30px_rgba(15,23,42,0.12)]",
          floating && "motion-safe:animate-mascot-float motion-reduce:animate-none",
          imageClassName
        )}
      />
    </div>
  );
}
