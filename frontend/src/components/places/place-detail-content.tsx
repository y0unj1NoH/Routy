"use client";

import {
  Clock3,
  ExternalLink,
  Globe,
  Navigation,
  Phone,
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
import type { Place } from "@/types/domain";

const MONDAY_FIRST_WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const PHOTO_SLIDER_AUTOPLAY_MS = 5000;

type PlaceDetailContentProps = {
  place: Place;
  backAction: ReactNode;
  visitDate?: string | null;
};

type InfoRowProps = {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
};

type PhotoSliderProps = {
  name: string | null;
  photos: string[];
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

function formatPriceLevelBadge(value: number | null | undefined) {
  if (typeof value !== "number") return null;
  if (value <= 0) return UI_COPY.places.detail.free;
  return "₩".repeat(Math.min(Math.max(value, 1), 4));
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

function formatReviewDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function truncateReviewText(value: string | null | undefined, maxLength = 140) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
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
    <div className="flex h-full items-start gap-3 rounded-[24px] border border-border/85 bg-card/92 p-3.5 shadow-[0_12px_24px_rgba(60,157,255,0.06)]">
      <div className="mt-0.5 rounded-2xl bg-primary-soft/80 p-2.5 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-foreground/42">{label}</p>
        <div className="min-w-0 wrap-break-word text-sm font-semibold leading-6 text-foreground/82">{value}</div>
      </div>
    </div>
  );
}

function PhotoSlider({ name, photos, rating, reviewLabel }: PhotoSliderProps) {
  const slides = photos.length > 0 ? photos : [""];
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
          "relative min-h-[340px] flex-1 overflow-hidden bg-muted touch-pan-y",
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
            <div key={`${photo || "fallback"}-${index}`} className="h-full min-h-[340px] flex-[0_0_100%]">
              <PlacePhoto
                name={name}
                photos={photo ? [photo] : []}
                className="h-full min-h-[340px] w-full rounded-none"
                imageClassName="object-cover"
                sizes="(max-width: 1024px) 100vw, 896px"
              />
            </div>
          ))}
        </div>
        <div className="pointer-events-none absolute inset-0 bg-linear-to-t from-overlay/78 via-overlay/18 to-transparent" />

        {hasMultiplePhotos ? (
          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end p-4">
            <div
              className={cn(
                "inline-flex items-center rounded-full bg-white/14 px-3 font-bold text-white backdrop-blur-xs",
                BADGE_HEIGHT_CLASS.medium,
                BADGE_TEXT_CLASS.small
              )}
            >
              {safeIndex + 1} / {photos.length}
            </div>
          </div>
        ) : null}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-2 p-5 pb-12">
          {typeof rating === "number" ? (
            <div
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 font-black text-white backdrop-blur-xs",
                BADGE_HEIGHT_CLASS.medium,
                BADGE_TEXT_CLASS.medium
              )}
            >
              <Star className="h-4 w-4 text-white" />
              {rating.toFixed(1)}
            </div>
          ) : null}
          <div
            className={cn(
              "inline-flex items-center rounded-full bg-white/15 px-3 font-semibold text-white backdrop-blur-xs",
              BADGE_HEIGHT_CLASS.medium,
              BADGE_TEXT_CLASS.medium
            )}
          >
            {reviewLabel}
          </div>
        </div>

        {hasMultiplePhotos ? (
          <div className="absolute inset-x-0 bottom-4 flex items-center justify-center px-4">
            <div className="flex items-center justify-center gap-2 rounded-full bg-overlay/26 px-3 py-2 backdrop-blur-xs">
              {slides.map((photo, index) => (
                <button
                  key={`${photo || "fallback"}-${index}-indicator`}
                  type="button"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsAutoAdvanceEnabled(false);
                    scrollToIndex(index);
                  }}
                  className={cn(
                    "h-2.5 w-2.5 rounded-full bg-white transition-opacity",
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
  const priceLevelBadge = formatPriceLevelBadge(place.priceLevel);
  const googleMapUrl = buildGoogleMapUrl({
    placeName: place.name || "",
    address: place.formattedAddress || "",
    googleMapsUrl: place.googleMapsUrl || null
  });
  const googleReviewsUrl = place.googlePlaceId
    ? `https://www.google.com/maps/search/?api=1&query_place_id=${encodeURIComponent(place.googlePlaceId)}&query=${encodeURIComponent(
        place.name || place.formattedAddress || UI_COPY.places.detail.placeQueryFallback
      )}`
    : googleMapUrl;
  const photoGallery = Array.isArray(place.photos) ? place.photos.filter(Boolean).slice(0, 5) : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        {backAction}
        <p className="text-sm font-semibold text-foreground/60">{UI_COPY.places.detail.title}</p>
      </div>

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

              <div className="space-y-5 p-5 sm:p-6">
                <CategoryBadge value={place.category} fallbackTone="primary" />

                <div className="space-y-2">
                  <h1 className="text-3xl font-black tracking-tight text-foreground">
                    {place.name || UI_COPY.places.detail.placeFallback}
                  </h1>
                  <p className="text-sm leading-6 text-foreground/68">{place.formattedAddress || UI_COPY.places.detail.addressFallback}</p>
                </div>

                <div className="grid gap-3">
                  <InfoRow
                    icon={Wallet}
                    label={UI_COPY.places.detail.quickInfo.priceLevel}
                    value={
                      priceLevelBadge ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-black text-foreground">{priceLevelBadge}</span>
                          <span className="text-sm text-foreground/62">{formatPriceLevelLabel(place.priceLevel)}</span>
                        </div>
                      ) : (
                        formatPriceLevelLabel(place.priceLevel)
                      )
                    }
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
                    icon={Phone}
                    label={UI_COPY.places.detail.quickInfo.phone}
                    value={place.phone || UI_COPY.places.detail.quickInfo.phoneFallback}
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

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-black">{UI_COPY.places.detail.openingHours.title}</h2>
              <OpeningStatusPill openingHint={openingHint} />
            </div>

            {openingRows.length > 0 ? (
              <div className="overflow-hidden rounded-[28px] border border-border/80 bg-card/88">
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
                      {row.isToday ? <span className="text-[11px] font-bold text-primary">오늘</span> : null}
                      {row.isVisitDate ? <span className="text-[11px] font-bold text-primary">방문 예정</span> : null}
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

          <Card className="space-y-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-black">{UI_COPY.places.detail.reviews.title}</h2>
                <p className="text-sm text-foreground/62">{UI_COPY.places.detail.reviews.description}</p>
              </div>
              <a
                href={googleReviewsUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center text-xs font-semibold text-primary underline underline-offset-4"
              >
                {UI_COPY.places.detail.actions.moreReviews}
                <ExternalLink className="ml-1 h-3.5 w-3.5" />
              </a>
            </div>

            {Array.isArray(place.reviews) && place.reviews.length > 0 ? (
              <div className="grid gap-3">
                {place.reviews.map((review, index) => (
                  <article key={`${review.authorName ?? "author"}-${index}`} className="rounded-2xl border border-border/80 bg-muted/35 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-foreground">{review.authorName || UI_COPY.places.detail.reviews.anonymous}</p>
                        <p className="text-xs text-foreground/56">
                          {formatReviewDate(review.publishTime) || UI_COPY.places.detail.reviews.missingDate}
                        </p>
                      </div>
                      {typeof review.rating === "number" ? (
                        <div
                          className={cn(
                            "inline-flex items-center gap-1 rounded-full bg-card px-2.5 font-bold text-foreground shadow-soft",
                            BADGE_HEIGHT_CLASS.small,
                            BADGE_TEXT_CLASS.small
                          )}
                        >
                          <Star fill="currentColor" className="h-3.5 w-3.5 text-star" />
                          {review.rating.toFixed(1)}
                        </div>
                      ) : null}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-foreground/76">
                      {truncateReviewText(review.text) || UI_COPY.places.detail.reviews.missingText}
                    </p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border-strong bg-muted/24 px-4 py-5 text-sm text-foreground/60">
                {UI_COPY.places.detail.reviews.empty}
              </div>
            )}
          </Card>
        </div>

        <aside className="space-y-5">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border/80 px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-foreground/45">{UI_COPY.places.detail.map.eyebrow}</p>
              <h2 className="mt-1 text-lg font-black">{UI_COPY.places.detail.map.title}</h2>
            </div>
            <iframe
              title={`${place.name || UI_COPY.places.detail.placeFallback} 지도`}
              src={mapEmbedUrl}
              className="h-[320px] w-full"
              loading="lazy"
            />
            <div className="space-y-3 px-5 py-4">
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
