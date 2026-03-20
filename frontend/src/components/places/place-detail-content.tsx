"use client";

import {
  Clock3,
  ExternalLink,
  Globe,
  Navigation,
  Star,
  Wallet,
  type LucideIcon
} from "lucide-react";
import { useEffect, useState, type ReactNode, type PointerEvent as ReactPointerEvent, type TransitionEvent as ReactTransitionEvent } from "react";

import { CategoryBadge } from "@/components/common/category-badge";
import { PlacePhoto } from "@/components/common/place-photo";
import { buttonStyles, buttonVariantToneClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { UI_COPY } from "@/constants/ui-copy";
import { BADGE_HEIGHT_CLASS, BADGE_TEXT_CLASS } from "@/lib/badge-size";
import { cn } from "@/lib/cn";
import { buildMapEmbedUrl } from "@/lib/maps";
import { buildPlaceOpeningHint, parseOpeningHours, type PlaceOpeningHint } from "@/lib/place-opening";
import type { Place, PlacePhoto as PlacePhotoAsset } from "@/types/domain";

const MONDAY_FIRST_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const PHOTO_SLIDER_AUTOPLAY_MS = 5000;

type PlaceDetailContentProps = {
  place: Place;
  backAction?: ReactNode;
  visitDate?: string | null;
};

type InfoRowProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
};

type PhotoSliderProps = {
  name: string | null;
  photos: PlacePhotoAsset[];
  rating: number | null;
  reviewLabel: string;
};

type OpeningRow = {
  shortLabel: string;
  fullLabel: string;
  timeLabel: string;
  isToday: boolean;
  isVisitDate: boolean;
};

function buildGoogleMapUrl(params: { placeName: string; address: string; googleMapsUrl: string | null }) {
  const query = `${params.placeName} ${params.address}`.trim();
  const encodedQuery = encodeURIComponent(query || params.placeName || params.address || UI_COPY.places.detail.placeQueryFallback);

  return params.googleMapsUrl || `https://www.google.com/maps/search/?api=1&query=${encodedQuery}`;
}

function formatReviewCount(value: number | null | undefined) {
  if (typeof value !== "number") return UI_COPY.places.detail.reviewFallback;
  return UI_COPY.places.detail.reviewCount(value);
}

function getMondayFirstWeekdayIndexFromIsoDate(value: string | null | undefined) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;

  const [yearText, monthText, dayText] = value.split("-");
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;

  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (weekday + 6) % 7;
}

function formatPriceLevelLabel(value: number | null | undefined) {
  if (typeof value !== "number") return UI_COPY.places.detail.priceUnknown;
  if (value <= 0) return UI_COPY.places.detail.free;
  return UI_COPY.places.detail.priceLabels[Math.min(Math.max(value, 1), 4)];
}

function formatUpdatedAt(value: string) {
  return new Date(value).toLocaleString("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short"
  });
}

function formatUpdatedAtCaption(value: string) {
  return `${formatUpdatedAt(value)}에 업데이트`;
}

function buildOpeningRows(weekdayDescriptions: string[], visitDate?: string | null) {
  const todayIndex = (new Date().getDay() + 6) % 7;
  const visitIndex = getMondayFirstWeekdayIndexFromIsoDate(visitDate);

  return weekdayDescriptions.map((line, index) => {
    const colonIndex = line.indexOf(":");
    const fullLabel = colonIndex >= 0 ? line.slice(0, colonIndex).trim() : MONDAY_FIRST_WEEKDAYS[index] || "";
    const timeLabel = colonIndex >= 0 ? line.slice(colonIndex + 1).trim() : line.trim();

    return {
      shortLabel: MONDAY_FIRST_WEEKDAYS[index] || fullLabel.slice(0, 1),
      fullLabel,
      timeLabel: timeLabel || UI_COPY.places.detail.openingHours.empty,
      isToday: index === todayIndex,
      isVisitDate: visitIndex === index
    } satisfies OpeningRow;
  });
}

function getOpeningStatusStyles(status: PlaceOpeningHint["status"]) {
  if (status === "open") {
    return {
      badgeClassName: "border-success/18 bg-success-soft/90 text-success",
      dotClassName: "bg-success"
    };
  }

  if (status === "closed") {
    return {
      badgeClassName: "border-danger/18 bg-danger-soft/92 text-danger",
      dotClassName: "bg-danger"
    };
  }

  return {
    badgeClassName: "border-border/80 bg-card text-foreground/62",
    dotClassName: "bg-foreground/28"
  };
}

function OpeningStatusPill({ openingHint, className }: { openingHint: PlaceOpeningHint; className?: string }) {
  const styles = getOpeningStatusStyles(openingHint.status);

  return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 font-bold tracking-[0.01em]",
          BADGE_HEIGHT_CLASS.medium,
          BADGE_TEXT_CLASS.small,
          styles.badgeClassName,
          className
        )}
    >
      <span className={cn("h-2 w-2 rounded-full", styles.dotClassName)} />
      {openingHint.statusLabel}
    </span>
  );
}

function InfoRow({ icon: Icon, label, value }: InfoRowProps) {
  return (
    <div className="flex h-full w-full items-start gap-3 rounded-xl border border-border/85 bg-card/92 p-4 shadow-surface md:rounded-2xl">
      <div className="mt-0.5 rounded-xl bg-primary-soft/80 p-2.5 text-primary md:rounded-2xl">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-2xs font-black uppercase tracking-[0.16em] text-foreground/42 md:text-xs">{label}</p>
        <div className="min-w-0 wrap-break-word text-sm font-semibold leading-6 text-foreground/82">{value}</div>
      </div>
    </div>
  );
}

function PhotoSlider({ name, photos, rating, reviewLabel }: PhotoSliderProps) {
  const slides: Array<PlacePhotoAsset | null> = photos.length > 0 ? photos : [null];
  const hasMultiplePhotos = photos.length > 1;
  const loopedSlides = hasMultiplePhotos ? [slides[slides.length - 1], ...slides, slides[0]] : slides;
  const [activeIndex, setActiveIndex] = useState(0);
  const [trackIndex, setTrackIndex] = useState(hasMultiplePhotos ? 1 : 0);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isTrackAnimating, setIsTrackAnimating] = useState(true);
  const [dragState, setDragState] = useState<{ pointerId: number; startX: number } | null>(null);
  const [isAutoAdvanceEnabled, setIsAutoAdvanceEnabled] = useState(true);

  const safeIndex = slides[activeIndex] ? activeIndex : 0;
  const activePhoto = slides[safeIndex] ?? null;

  const scrollToIndex = (index: number) => {
    const nextIndex = Math.max(0, Math.min(index, slides.length - 1));
    setIsTrackAnimating(true);
    setActiveIndex(nextIndex);
    setTrackIndex(hasMultiplePhotos ? nextIndex + 1 : nextIndex);
    setDragOffset(0);
    setIsDragging(false);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!hasMultiplePhotos) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (event.target instanceof Element && event.target.closest("button")) return;

    setIsAutoAdvanceEnabled(false);
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragState({ pointerId: event.pointerId, startX: event.clientX });
    setDragOffset(0);
    setIsDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const deltaX = event.clientX - dragState.startX;
    setDragOffset(Math.max(-160, Math.min(160, deltaX)));
  };

  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const threshold = 48;
    let nextTrackIndex = trackIndex;

    if (dragOffset <= -threshold) {
      nextTrackIndex += 1;
    } else if (dragOffset >= threshold) {
      nextTrackIndex -= 1;
    }

    if (hasMultiplePhotos) {
      nextTrackIndex = Math.max(0, Math.min(nextTrackIndex, slides.length + 1));
      if (nextTrackIndex === 0) {
        setActiveIndex(slides.length - 1);
      } else if (nextTrackIndex === slides.length + 1) {
        setActiveIndex(0);
      } else {
        setActiveIndex(nextTrackIndex - 1);
      }
      setIsTrackAnimating(true);
      setTrackIndex(nextTrackIndex);
    }

    setDragState(null);
    setDragOffset(0);
    setIsDragging(false);
  };

  const handleTrackTransitionEnd = (_event: ReactTransitionEvent<HTMLDivElement>) => {
    if (!hasMultiplePhotos) return;

    if (trackIndex === 0) {
      setIsTrackAnimating(false);
      setTrackIndex(slides.length);
      return;
    }

    if (trackIndex === slides.length + 1) {
      setIsTrackAnimating(false);
      setTrackIndex(1);
      return;
    }

    if (!isTrackAnimating) {
      setIsTrackAnimating(true);
    }
  };

  useEffect(() => {
    if (!hasMultiplePhotos || !isAutoAdvanceEnabled || isDragging || dragState) return;

    const timer = window.setTimeout(() => {
      setIsTrackAnimating(true);
      setActiveIndex((current) => (current + 1) % slides.length);
      setTrackIndex((current) => current + 1);
    }, PHOTO_SLIDER_AUTOPLAY_MS);

    return () => window.clearTimeout(timer);
  }, [dragState, hasMultiplePhotos, isAutoAdvanceEnabled, isDragging, slides.length, trackIndex]);

  return (
    <div className="flex h-full flex-col border-b border-border/80">
      <div
        className={cn(
          "relative min-h-[240px] flex-1 overflow-hidden bg-muted touch-pan-y md:min-h-[260px] lg:min-h-[280px] xl:min-h-[300px]",
          hasMultiplePhotos ? (isDragging ? "cursor-grabbing" : "cursor-grab") : "cursor-default"
        )}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        <div
          className={cn("flex h-full", isDragging ? "" : isTrackAnimating ? "transition-transform duration-300 ease-out" : "")}
          onTransitionEnd={handleTrackTransitionEnd}
          style={{ transform: `translate3d(calc(${trackIndex * -100}% + ${dragOffset}px), 0, 0)` }}
        >
          {loopedSlides.map((photo, index) => (
            <div key={`${photo?.name || "fallback"}-${index}`} className="h-full min-h-[240px] flex-[0_0_100%] md:min-h-[260px] lg:min-h-[280px] xl:min-h-[300px]">
              <PlacePhoto
                name={name}
                coverPhoto={photo || null}
                className="h-full min-h-[240px] w-full rounded-none md:min-h-[260px] lg:min-h-[280px] xl:min-h-[300px]"
                imageClassName="object-cover"
                sizes="(max-width: 1024px) 100vw, 896px"
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-overlay/78 via-overlay/18 to-transparent" />

        {hasMultiplePhotos ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end p-2.5 md:p-3">
            <div className={cn("inline-flex items-center rounded-full bg-white/14 px-2 font-bold text-white backdrop-blur-xs", BADGE_HEIGHT_CLASS.small, BADGE_TEXT_CLASS.label)}>
              {safeIndex + 1} / {photos.length}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-1 p-2.5 pb-5 md:p-3 md:pb-6">
          {typeof rating === "number" ? (
            <div
              className={cn(
                "inline-flex items-center gap-1 rounded-full bg-white/15 px-2 font-black text-white backdrop-blur-xs",
                BADGE_HEIGHT_CLASS.small,
                BADGE_TEXT_CLASS.label
              )}
            >
              <Star className="h-3 w-3 text-white" />
              {rating.toFixed(1)}
            </div>
          ) : null}
          <div
            className={cn(
              "inline-flex items-center rounded-full bg-white/15 px-2 font-semibold text-white backdrop-blur-xs",
              BADGE_HEIGHT_CLASS.small,
              BADGE_TEXT_CLASS.label
            )}
          >
            {reviewLabel}
          </div>
        </div>

        {activePhoto?.displayName ? (
          <div className="pointer-events-none absolute bottom-5 right-2.5 max-w-[68%] md:bottom-6 md:right-3">
            <p className={cn("truncate rounded-full bg-white/14 px-2 py-1 font-medium text-white/88 backdrop-blur-xs", BADGE_TEXT_CLASS.xxs)}>
              {activePhoto.displayName}
            </p>
          </div>
        ) : null}

        {hasMultiplePhotos ? (
          <div className="absolute inset-x-0 bottom-3 flex items-center justify-center px-4">
            <div className="flex items-center justify-center gap-1 rounded-full bg-overlay/26 px-2 py-1 backdrop-blur-xs">
              {slides.map((photo, index) => (
                <button
                  key={`${photo?.name || "fallback"}-${index}-indicator`}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsAutoAdvanceEnabled(false);
                    scrollToIndex(index);
                  }}
                  className={cn(
                  "h-1.5 w-1.5 rounded-full bg-white transition-opacity",
                  index === safeIndex ? "opacity-100" : "opacity-55 hover:opacity-80"
                )}
                  aria-label={`${index + 1}번째 사진 보기`}
                />
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function PlaceDetailContent({ place, backAction, visitDate = null }: PlaceDetailContentProps) {
  const mapEmbedUrl = buildMapEmbedUrl({
    lat: place.lat,
    lng: place.lng,
    query: place.name || place.formattedAddress || ""
  });
  const openingHours = parseOpeningHours(place.openingHours);
  const openingHint = buildPlaceOpeningHint(place.openingHours);
  const openingRows = buildOpeningRows(openingHours.weekdayDescriptions, visitDate);
  const googleMapUrl = buildGoogleMapUrl({
    placeName: place.name || "",
    address: place.formattedAddress || "",
    googleMapsUrl: place.googleMapsUrl || null
  });
  const photoGallery = Array.isArray(place.photos) ? place.photos.filter((photo) => Boolean(photo?.name)).slice(0, 5) : [];

  return (
    <div className="space-y-5">
      {backAction ? <div className="flex items-center gap-3">{backAction}</div> : null}

      <section className="mx-auto w-full max-w-4xl space-y-5">
        <div className="space-y-5">
          <Card className="overflow-hidden p-0">
            <div className="flex flex-col">
              <PhotoSlider
                key={place.id}
                name={place.name}
                photos={photoGallery}
                rating={place.rating}
                reviewLabel={formatReviewCount(place.userRatingCount)}
              />

              <div className="space-y-4 p-4 md:p-5">
                <CategoryBadge value={place.categories[0] ?? null} fallbackTone="primary" />

                <div className="space-y-2">
                  <h1 className="text-2xl font-black leading-[1.2] tracking-[-0.03em] text-foreground md:text-3xl">
                    {place.name || UI_COPY.places.detail.placeFallback}
                  </h1>
                  <p className="text-xs leading-6 text-foreground/68 md:text-sm">{place.formattedAddress || UI_COPY.places.detail.addressFallback}</p>
                </div>

                <div className="grid gap-3">
                  <InfoRow
                    icon={Wallet}
                    label={UI_COPY.places.detail.quickInfo.priceLevel}
                    value={formatPriceLevelLabel(place.priceLevel)}
                  />
                  <InfoRow
                    icon={Clock3}
                    label={UI_COPY.places.detail.stats.openingStatus}
                    value={
                      <div className="space-y-1">
                        <OpeningStatusPill openingHint={openingHint} className="w-fit" />
                        {openingHint.warningText ? <p className="text-xs font-semibold text-warning">{openingHint.warningText}</p> : null}
                      </div>
                    }
                  />
                  <InfoRow
                    icon={Globe}
                    label={UI_COPY.places.detail.quickInfo.website}
                    value={
                      place.website ? (
                        <a href={place.website} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                          {UI_COPY.places.detail.quickInfo.websiteAction}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        UI_COPY.places.detail.quickInfo.websiteFallback
                      )
                    }
                  />
                  <InfoRow
                    icon={Navigation}
                    label={UI_COPY.places.detail.actions.directions}
                    value={
                      <a href={googleMapUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary">
                        {UI_COPY.places.detail.map.openInGoogleMaps}
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    }
                  />
                </div>

                <p className="text-right text-xs font-medium tracking-[0.01em] text-foreground/42">
                  {formatUpdatedAtCaption(place.updatedAt)}
                </p>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-4 md:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black">{UI_COPY.places.detail.openingHours.title}</h2>
              <OpeningStatusPill openingHint={openingHint} />
            </div>

            {openingRows.length > 0 ? (
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card/88 md:rounded-2xl">
                {openingRows.map((row) => (
                  <div
                    key={row.fullLabel}
                    className={cn(
                      "flex items-center justify-between gap-4 border-b border-border/65 px-4 py-3 text-sm last:border-b-0",
                      row.isToday || row.isVisitDate ? "bg-primary-soft/82" : "bg-transparent"
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "inline-flex min-w-8 items-center justify-center rounded-full px-2.5 font-black",
                          BADGE_HEIGHT_CLASS.small,
                          BADGE_TEXT_CLASS.label,
                          row.isToday || row.isVisitDate ? buttonVariantToneClasses.primary : "bg-muted text-foreground/68"
                        )}
                        title={row.fullLabel}
                      >
                        {row.shortLabel}
                      </span>
                      {row.isToday ? <span className="text-2xs font-bold text-primary md:text-xs">오늘</span> : null}
                      {row.isVisitDate ? <span className="text-2xs font-bold text-primary md:text-xs">방문 예정</span> : null}
                    </div>
                    <span className={cn("text-right font-semibold", row.isToday || row.isVisitDate ? "text-primary" : "text-foreground/78")}>
                      {row.timeLabel}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border-strong bg-muted/24 px-4 py-5 text-sm text-foreground/60">
                {UI_COPY.places.detail.openingHours.empty}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border/80 px-4 py-4 md:px-5">
              <h2 className="text-lg font-black">{UI_COPY.places.detail.map.title}</h2>
            </div>
            <iframe
              title={`${place.name || UI_COPY.places.detail.placeFallback} 지도`}
              src={mapEmbedUrl}
              className="h-[220px] w-full md:h-[240px] lg:h-[260px]"
              loading="lazy"
            />
            <div className="space-y-3 px-4 py-4 md:px-5">
              <a
                href={googleMapUrl}
                target="_blank"
                rel="noreferrer"
                className={buttonStyles({ className: "h-auto w-full px-4 py-3 font-bold" })}
              >
                {UI_COPY.places.detail.map.openInGoogleMaps}
              </a>
            </div>
          </Card>
        </aside>
      </section>
    </div>
  );
}
