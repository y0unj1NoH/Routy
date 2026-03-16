import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";

import { PlacePhoto } from "@/components/common/place-photo";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";

type ListItemCardPreviewPlace = {
  id: string;
  name: string | null;
  photos: string[] | null | undefined;
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
        <Card className="group h-full overflow-hidden border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(244,251,255,0.96))] p-4 transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_32px_rgba(56,123,194,0.12)]">
          <div className="flex h-full flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              {previewSlots.map((place, index) =>
                place ? (
                  <PlacePhoto
                    key={place.id}
                    name={place.name}
                    photos={place.photos}
                    className="aspect-square w-full rounded-[10px] border border-border/85 bg-muted/78 sm:rounded-[12px] xl:rounded-[16px]"
                    imageClassName="transition-transform duration-300 group-hover:scale-[1.03]"
                    sizes="(min-width: 1536px) 210px, (min-width: 1280px) 28vw, (min-width: 640px) 44vw, 42vw"
                    fallbackEmoji=""
                  />
                ) : (
                  <div
                    key={`placeholder-${index}`}
                    aria-hidden
                    className="aspect-square w-full rounded-[10px] border border-border/70 bg-muted/52 sm:rounded-[12px] xl:rounded-[16px]"
                  />
                )
              )}
            </div>

            <div className="space-y-1">
              <h2 className="line-clamp-2 text-[17px] font-black leading-snug text-foreground">{title}</h2>
              <div className="flex items-end justify-between gap-3">
                <p className="text-sm text-foreground/65">{description}</p>
                {badge ? <div className="shrink-0">{badge}</div> : null}
              </div>
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
          "group flex items-center gap-4 border-border/70 p-4 transition-all hover:-translate-y-0.5 hover:bg-muted/45",
          isFeatured ? "bg-muted px-5 py-5" : "bg-card/92"
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <h2 className={cn("truncate font-black", isFeatured ? "text-lg md:text-xl" : "text-base")}>{title}</h2>
              <p className="text-sm text-foreground/65">{description}</p>
            </div>
            {badge ? <div className="shrink-0">{badge}</div> : null}
          </div>
        </div>
        <ArrowRight
          className={cn(
            "h-4 w-4 shrink-0 text-foreground/55 transition-transform group-hover:translate-x-0.5",
            isFeatured && "h-5 w-5"
          )}
        />
      </Card>
    </Link>
  );
}
