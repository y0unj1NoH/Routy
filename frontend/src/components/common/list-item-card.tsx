import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { PlacePhoto } from "@/components/common/place-photo";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import type { PlacePhoto as PlacePhotoAsset } from "@/types/domain";

type ListItemCardPreviewPlace = {
  id: string;
  name: string | null;
  coverPhoto: PlacePhotoAsset | null;
};

type ListItemCardProps = {
  href: string;
  title: string;
  description: string;
  badge?: ReactNode;
  variant?: "default" | "featured";
  previewPlaces?: ListItemCardPreviewPlace[];
};

export function ListItemCard({
  href,
  title,
  description,
  badge,
  variant = "default",
  previewPlaces
}: ListItemCardProps) {
  const isFeatured = variant === "featured";
  const hasPreviewLayout = Array.isArray(previewPlaces);

  if (hasPreviewLayout) {
    const previewSlots = Array.from({ length: 4 }, (_, index) => previewPlaces[index] || null);

    return (
      <Link href={href} className="block h-full">
        <Card className="group h-full overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,251,255,0.96))] p-3 shadow-subtle transition-all hover:-translate-y-0.5 hover:shadow-surface md:rounded-xl md:p-3.5">
          <div className="flex h-full flex-col gap-3 md:gap-3.5">
            <div className="grid grid-cols-2 gap-2 md:gap-2.5">
              {previewSlots.map((place, index) =>
                place ? (
                  <PlacePhoto
                    key={place.id}
                    name={place.name}
                    coverPhoto={place.coverPhoto}
                    className="aspect-square w-full rounded-lg border border-border/85 bg-muted/78 md:rounded-xl"
                    imageClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                    sizes="(min-width: 1280px) 240px, (min-width: 1024px) 23vw, (min-width: 768px) 30vw, 42vw"
                    fallbackEmoji=""
                  />
                ) : (
                  <div
                    key={`placeholder-${index}`}
                    aria-hidden
                    className="aspect-square w-full rounded-lg border border-border/70 bg-muted/52 md:rounded-xl"
                  />
                )
              )}
            </div>

            <div className="flex min-h-full flex-col justify-between gap-2 md:gap-2.5">
              <div className="space-y-1.5">
                <h2 className="line-clamp-2 text-[0.95rem] font-black leading-[1.28] text-foreground md:text-[1rem]">
                  {title}
                </h2>
                <p className="text-[0.72rem] font-medium text-foreground/62 md:text-xs">{description}</p>
              </div>
              {badge ? <div className="shrink-0 self-start">{badge}</div> : null}
            </div>
          </div>
        </Card>
      </Link>
    );
  }

  return (
    <Link href={href} className="block">
      <Card
        className={cn(
          "group flex items-center gap-3 border-border/70 p-4 transition-all hover:-translate-y-0.5 hover:bg-muted/45 md:gap-4",
          isFeatured ? "bg-muted p-4 md:p-5" : "bg-card/92"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className={cn("truncate font-black", isFeatured ? "text-lg md:text-xl" : "text-sm md:text-base")}>{title}</h2>
              <p className="text-xs text-foreground/65 md:text-sm">{description}</p>
            </div>
            {badge ? <div className="shrink-0">{badge}</div> : null}
          </div>
        </div>
        <ArrowRight
          className={cn(
            "h-4 w-4 shrink-0 text-foreground/55 transition-transform group-hover:translate-x-0.5",
            isFeatured && "h-[18px] w-[18px]"
          )}
        />
      </Card>
    </Link>
  );
}
