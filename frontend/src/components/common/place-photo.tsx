"use client";

import { useState } from "react";
import Image from "next/image";

import { cn } from "@/lib/cn";
import { resolvePlacePhotoUrl } from "@/lib/photos";

type PlacePhotoProps = {
  name: string | null;
  photos: string[] | null | undefined;
  className?: string;
  imageClassName?: string;
  sizes?: string;
  fallbackEmoji?: string;
};

export function PlacePhoto({
  name,
  photos,
  className,
  imageClassName,
  sizes = "160px",
  fallbackEmoji = "📍"
}: PlacePhotoProps) {
  const [isBroken, setIsBroken] = useState(false);
  const rawSrc = Array.isArray(photos) && photos.length > 0 ? photos[0] : "";
  const src = resolvePlacePhotoUrl(rawSrc, 1280);

  if (!src || isBroken) {
    return (
      <div className={cn("grid place-items-center rounded-xl bg-muted text-2xl", className)}>
        {fallbackEmoji}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-xl bg-muted", className)}>
      <Image
        src={src}
        alt={name || "장소 이미지"}
        fill
        unoptimized
        draggable={false}
        sizes={sizes}
        className={cn("object-cover", imageClassName)}
        onError={() => setIsBroken(true)}
      />
    </div>
  );
}
