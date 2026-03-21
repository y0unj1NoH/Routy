"use client";

import { ExternalLink, MapPin, Plus, Star, Trash2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";

import { CategoryBadge } from "@/components/common/category-badge";
import { GoogleMapsMark } from "@/components/common/google-maps-mark";
import { MustVisitIconBadge } from "@/components/common/must-visit-icon-badge";
import { NoteDisplayPanel, NoteEditorPanel } from "@/components/common/note-panels";
import { PlacePhoto } from "@/components/common/place-photo";
import { buttonStyles } from "@/components/ui/button-styles";
import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";
import { buildPlaceOpeningHint } from "@/lib/place-opening";
import type { PlaceListItem } from "@/types/domain";

type SavedListPlaceCardVariant = "classic" | "comparison";

type SavedListPlaceCardProps = {
  item: PlaceListItem;
  detailHref: string;
  isNoteSaving?: boolean;
  isPrioritySaving?: boolean;
  onTogglePriority: (item: PlaceListItem) => void;
  onRemove: (item: PlaceListItem) => void;
  onSaveNote: (itemId: string, note: string | null) => void;
  variant?: SavedListPlaceCardVariant;
};

function normalizeCopy(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function compactLocation(address: string) {
  const cleaned = address
    .split(",")
    .map((part) => part.replace(/\bThailand\b/gi, "").replace(/\b\d{5,6}\b/g, "").trim())
    .filter(Boolean);

  if (cleaned.length >= 2) {
    return `${cleaned[cleaned.length - 2]} · ${cleaned[cleaned.length - 1]}`;
  }

  return cleaned[0] || address;
}

function formatCompactReviewCount(value: number) {
  if (value >= 1000) {
    const shortValue = value >= 10000 ? Math.round(value / 1000) : Math.round((value / 1000) * 10) / 10;
    return `${shortValue}k`;
  }

  return new Intl.NumberFormat("ko-KR").format(value);
}

function DotDivider() {
  return <span className="h-1 w-1 rounded-full bg-slate-300" />;
}

function stopCardNavigation(event: ReactMouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

function stopCardPropagation(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function RatingInline({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
      <Star className="h-3.5 w-3.5 fill-[#FFB938] text-[#FFB938]" />
      {value.toFixed(1)}
    </span>
  );
}

function StatusInline({
  label,
  detail,
  tone,
  className
}: {
  label: string;
  detail?: string | null;
  tone: "open" | "closing" | "closed" | "unknown";
  className?: string;
}) {
  const toneClassName =
    {
      open: {
        dot: "bg-success",
        label: "text-[#197A55]",
        detail: "text-slate-500"
      },
      closing: {
        dot: "bg-[#E5484D]",
        label: "text-[#C9353D]",
        detail: "text-[#D84B52]"
      },
      closed: {
        dot: "bg-slate-400",
        label: "text-slate-500",
        detail: "text-slate-400"
      },
      unknown: {
        dot: "bg-slate-300",
        label: "text-slate-400",
        detail: "text-slate-400"
      }
    }[tone];

  return (
    <div className={cn("inline-flex items-center gap-1.5 text-xs font-semibold", className)}>
      <span className={cn("h-2 w-2 rounded-full", toneClassName.dot)} />
      <span className={toneClassName.label}>{label}</span>
      {detail ? (
        <>
          <span className="text-slate-300">·</span>
          <span className={toneClassName.detail}>{detail}</span>
        </>
      ) : null}
    </div>
  );
}

function CircleActionButton({
  active = false,
  busy = false,
  icon: Icon,
  label,
  onClick,
  tone = "default"
}: {
  active?: boolean;
  busy?: boolean;
  icon: LucideIcon;
  label: string;
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  tone?: "default" | "danger";
}) {
  return (
    <button
      type="button"
      aria-busy={busy}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "relative z-20 grid h-10 w-10 place-items-center rounded-full border border-white/12 bg-overlay/26 shadow-[0_18px_36px_-22px_rgba(15,23,42,0.8)] backdrop-blur-xs transition md:h-11 md:w-11",
        tone === "danger"
          ? "text-danger hover:border-danger/30 hover:bg-overlay/34 hover:text-danger-hover"
          : active
            ? "border-[#FFD36A]/45 text-star hover:border-[#FFD36A]/62"
            : "text-white/88 hover:border-[#FFD36A]/42 hover:text-star",
        busy ? "ring-2 ring-primary/12" : null
      )}
    >
      <Icon className="h-4 w-4" fill={Icon === Star && active ? "currentColor" : "none"} />
    </button>
  );
}

function GhostPillLink({ href, children, className }: { href: string; children: string; className?: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={stopCardPropagation}
      className={buttonStyles({
        variant: "ghost",
        size: "small",
        shape: "pill",
        className: cn(
          "relative z-20 border border-border text-foreground/78 hover:bg-muted/70 hover:text-foreground [&_svg]:shrink-0",
          className
        )
      })}
    >
      {children}
      <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

function AddNoteGhostPillButton({
  onClick,
  className
}: {
  onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonStyles({
        variant: "ghost",
        size: "small",
        shape: "pill",
        className: cn(
          "relative z-20 border border-border text-xs font-semibold leading-none text-foreground/78 hover:bg-muted/70 hover:text-foreground [&_svg]:shrink-0",
          className
        )
      })}
    >
      <Plus className="h-3.5 w-3.5" />
      {UI_COPY.routes.stopCard.addNote}
    </button>
  );
}

function ComparisonFooterButton({
  icon: Icon,
  label,
  onClick
}: {
  icon: LucideIcon;
  label: string;
  onClick?: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  const className = buttonStyles({
    variant: "ghost",
    size: "xsmall",
    shape: "pill",
    className: "relative z-20 justify-center gap-1.5 border border-border bg-white/92 text-foreground/78 hover:bg-muted/70 hover:text-foreground"
  });

  return (
    <button type="button" onClick={onClick} className={className}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function GoogleMapsIconButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={stopCardPropagation}
      aria-label="Google Maps"
      title="Google Maps"
      className={buttonStyles({
        variant: "ghost",
        size: "xsmall",
        shape: "pill",
        className:
          "relative z-20 w-8 px-0 justify-center border border-border text-foreground/78 hover:!border-border-strong hover:!bg-slate-50 hover:!text-foreground md:w-10"
      })}
    >
      <GoogleMapsMark />
    </a>
  );
}

export function SavedListPlaceCard({
  item,
  detailHref,
  isNoteSaving = false,
  isPrioritySaving = false,
  onTogglePriority,
  onRemove,
  onSaveNote,
  variant = "classic"
}: SavedListPlaceCardProps) {
  const openingHint = buildPlaceOpeningHint(item.place.openingHours);
  const statusTone =
    openingHint.status === "open"
      ? openingHint.warningText
        ? "closing"
        : "open"
      : openingHint.status === "closed"
        ? "closed"
        : "unknown";
  const statusLabel = openingHint.status === "unknown" ? "정보 없음" : openingHint.statusLabel;
  const savedNote = normalizeCopy(item.note);
  const hasNote = savedNote.length > 0;
  const hasRating = typeof item.place.rating === "number";
  const hasReviewCount = typeof item.place.userRatingCount === "number";
  const locationText = item.place.formattedAddress
    ? compactLocation(item.place.formattedAddress)
    : UI_COPY.saved.detail.placesSection.addressFallback;
  const savedCardBadgeSize = "card" as const;
  const [draftNote, setDraftNote] = useState(savedNote);
  const [isEditingNote, setIsEditingNote] = useState(false);
  const showExistingNoteEditor = hasNote && isEditingNote;
  const showInlineAddEditor = !hasNote && isEditingNote;
  const showFooterActions = (!hasNote && !isEditingNote) || Boolean(item.place.googleMapsUrl);

  useEffect(() => {
    setDraftNote(savedNote);
    setIsEditingNote(false);
  }, [savedNote, item.id]);

  const handleSaveNote = () => {
    onSaveNote(item.id, draftNote.trim() || null);
  };

  const handleDeleteNote = () => {
    onSaveNote(item.id, null);
  };

  const noteSection = showExistingNoteEditor ? (
    <NoteEditorPanel
      savedNote={savedNote}
      draftNote={draftNote}
      isSaving={isNoteSaving}
      onDraftChange={setDraftNote}
      onCancelEdit={() => {
        setDraftNote(savedNote);
        setIsEditingNote(false);
      }}
      onSave={handleSaveNote}
      onDelete={handleDeleteNote}
    />
  ) : hasNote ? (
    <NoteDisplayPanel
      note={savedNote}
      isBusy={isNoteSaving}
      onEdit={() => setIsEditingNote(true)}
      onDelete={handleDeleteNote}
    />
  ) : null;

  if (variant === "comparison") {
    const showAddNoteAction = !hasNote && !isEditingNote;
    const showMapAction = Boolean(item.place.googleMapsUrl);
    const comparisonMemoSection = showInlineAddEditor ? (
      <NoteEditorPanel
        savedNote={savedNote}
        draftNote={draftNote}
        isSaving={isNoteSaving}
        onDraftChange={setDraftNote}
        onCancelEdit={() => {
          setDraftNote(savedNote);
          setIsEditingNote(false);
        }}
        onSave={handleSaveNote}
        onDelete={handleDeleteNote}
      />
    ) : (
      noteSection
    );
    const mobileActionSection = showInlineAddEditor ? (
      item.place.googleMapsUrl ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <GoogleMapsIconButton href={item.place.googleMapsUrl} />
        </div>
      ) : null
    ) : showFooterActions ? (
      <div className="flex w-full flex-wrap items-center justify-end gap-2">
        {showAddNoteAction ? (
          <ComparisonFooterButton
            icon={Plus}
            label={UI_COPY.routes.stopCard.addNote}
            onClick={(event) => {
              stopCardNavigation(event);
              setIsEditingNote(true);
            }}
          />
        ) : null}
        {showMapAction && item.place.googleMapsUrl ? <GoogleMapsIconButton href={item.place.googleMapsUrl} /> : null}
      </div>
    ) : null;
    const desktopActionSection = showInlineAddEditor ? (
      item.place.googleMapsUrl ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-2.5">
          <GoogleMapsIconButton href={item.place.googleMapsUrl} />
        </div>
      ) : null
    ) : showFooterActions ? (
      <div className="flex w-full flex-wrap items-center justify-end gap-2.5">
        {!hasNote && !isEditingNote ? (
          <AddNoteGhostPillButton
            onClick={(event) => {
              stopCardNavigation(event);
              setIsEditingNote(true);
            }}
          />
        ) : null}
        {item.place.googleMapsUrl ? <GoogleMapsIconButton href={item.place.googleMapsUrl} /> : null}
      </div>
    ) : null;
    const hasSharedLowerSection = Boolean(comparisonMemoSection || mobileActionSection || desktopActionSection);

    return (
      <div className="group relative w-full overflow-hidden rounded-2xl border border-[#B9DAFF] bg-white/96 shadow-surface transition-[border-color,box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-raised md:rounded-3xl">
        <Link
          href={detailHref}
          aria-label={`${item.place.name || UI_COPY.saved.detail.placesSection.placeFallback} 상세 보기`}
          className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/15"
        />

        <div className="md:hidden">
          <div className="relative overflow-hidden border-b border-border/60">
            <PlacePhoto
              name={item.place.name}
              coverPhoto={item.place.coverPhoto}
              className="h-[184px] w-full rounded-none"
              imageClassName="object-cover"
              sizes="100vw"
            />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.06),rgba(15,23,42,0.02)_34%,rgba(15,23,42,0.44)_100%)]" />

            <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                {item.isMustVisit ? (
                  <MustVisitIconBadge size={savedCardBadgeSize} className="shadow-subtle" />
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <CircleActionButton
                  active={item.isMustVisit}
                  busy={isPrioritySaving}
                  icon={Star}
                  label={item.isMustVisit ? "Must Visit 해제" : "Must Visit 설정"}
                  onClick={(event) => {
                    stopCardNavigation(event);
                    onTogglePriority(item);
                  }}
                />
                <CircleActionButton
                  icon={Trash2}
                  label="장소 삭제"
                  tone="danger"
                  onClick={(event) => {
                    stopCardNavigation(event);
                    onRemove(item);
                  }}
                />
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 p-4">
              <div className="flex flex-wrap items-center gap-2">
                {hasRating ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-overlay/26 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_18px_36px_-22px_rgba(15,23,42,0.8)] backdrop-blur-xs">
                    <Star className="h-3.5 w-3.5 fill-[#FFB938] text-[#FFB938]" />
                    {item.place.rating?.toFixed(1)}
                  </span>
                ) : null}
                {hasReviewCount ? (
                  <span className="inline-flex items-center rounded-full border border-white/12 bg-overlay/26 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_18px_36px_-22px_rgba(15,23,42,0.8)] backdrop-blur-xs">
                    리뷰 {formatCompactReviewCount(item.place.userRatingCount as number)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3 p-4">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge value={item.place.categories[0] ?? null} size={savedCardBadgeSize} />
                <StatusInline label={statusLabel} detail={openingHint.warningText} tone={statusTone} className="text-[11px] md:text-xs" />
              </div>

              <h3 className="line-clamp-2 text-xl font-black leading-[1.2] tracking-tight text-slate-950 transition-colors group-hover:text-primary">
                {item.place.name || UI_COPY.saved.detail.placesSection.placeFallback}
              </h3>

              {locationText ? (
                <div className="text-xs font-medium text-slate-500">
                  <span className="inline-flex items-start gap-1.5">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span>{locationText}</span>
                  </span>
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="p-5">
            <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
              <PlacePhoto
                name={item.place.name}
                coverPhoto={item.place.coverPhoto}
                className="h-[120px] w-[120px] shrink-0 rounded-2xl"
                sizes="120px"
              />

              <div className="min-w-0 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <CategoryBadge value={item.place.categories[0] ?? null} size={savedCardBadgeSize} />
                      {item.isMustVisit ? (
                        <MustVisitIconBadge size={savedCardBadgeSize} />
                      ) : null}
                      <StatusInline label={statusLabel} detail={openingHint.warningText} tone={statusTone} />
                    </div>

                    <h3 className="line-clamp-2 text-[1.55rem] font-black leading-[1.2] tracking-tight text-slate-950 transition-colors group-hover:text-primary">
                      {item.place.name || UI_COPY.saved.detail.placesSection.placeFallback}
                    </h3>
                  </div>

                  <div className="relative z-20 flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      aria-busy={isPrioritySaving}
                      aria-label={item.isMustVisit ? "Must Visit 해제" : "Must Visit 설정"}
                      onClick={(event) => {
                        stopCardNavigation(event);
                        onTogglePriority(item);
                      }}
                      className={cn(
                        "grid h-9 w-9 place-items-center rounded-full border border-border/80 bg-white shadow-subtle transition",
                        item.isMustVisit
                          ? "text-star hover:border-[#FFD36A]"
                          : "text-slate-400 hover:border-[#FFD36A]/80 hover:text-star",
                        isPrioritySaving ? "ring-2 ring-primary/12" : null
                      )}
                    >
                      <Star fill={item.isMustVisit ? "currentColor" : "none"} className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="장소 삭제"
                      onClick={(event) => {
                        stopCardNavigation(event);
                        onRemove(item);
                      }}
                      className="grid h-9 w-9 place-items-center rounded-full border border-border/80 bg-white text-danger shadow-subtle transition hover:border-danger/30 hover:bg-danger/5"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 md:text-sm">
                  {hasRating ? <RatingInline value={item.place.rating as number} /> : null}
                  {hasReviewCount ? (
                    <>
                      {hasRating ? <DotDivider /> : null}
                      <span className="text-sm text-slate-400">리뷰 {formatCompactReviewCount(item.place.userRatingCount as number)}</span>
                    </>
                  ) : null}
                  {item.place.formattedAddress ? (
                    <>
                      {hasRating || hasReviewCount ? <DotDivider /> : null}
                      <span className="inline-flex items-center gap-1.5">
                        <MapPin className="h-3.5 w-3.5 text-primary" />
                        {compactLocation(item.place.formattedAddress)}
                      </span>
                    </>
                  ) : (
                    <span>{UI_COPY.saved.detail.placesSection.addressFallback}</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {hasSharedLowerSection ? (
          <div className="flex flex-col gap-3 px-4 pb-4 pt-3 md:px-5 md:pb-5 md:pt-4">
            {comparisonMemoSection ? comparisonMemoSection : null}
            {mobileActionSection ? <div className="md:hidden">{mobileActionSection}</div> : null}
            {desktopActionSection ? <div className="hidden md:block">{desktopActionSection}</div> : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="group relative w-full space-y-4 rounded-2xl border border-[#B9DAFF] bg-white/96 p-4 shadow-surface transition-[border-color,box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-raised md:rounded-3xl md:p-5">
      <Link
        href={detailHref}
        aria-label={`${item.place.name || UI_COPY.saved.detail.placesSection.placeFallback} 상세 보기`}
        className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/15"
      />
      <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)] md:items-start">
        <PlacePhoto
          name={item.place.name}
          coverPhoto={item.place.coverPhoto}
          className="h-[104px] w-[104px] shrink-0 rounded-xl md:h-[120px] md:w-[120px] md:rounded-2xl"
          sizes="120px"
        />

        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <CategoryBadge value={item.place.categories[0] ?? null} size={savedCardBadgeSize} />
                {item.isMustVisit ? (
                  <MustVisitIconBadge size={savedCardBadgeSize} />
                ) : null}
                <StatusInline label={statusLabel} detail={openingHint.warningText} tone={statusTone} />
              </div>

              <h3 className="line-clamp-2 text-xl font-black leading-[1.2] tracking-tight text-slate-950 transition-colors group-hover:text-primary md:text-[1.55rem]">
                {item.place.name || UI_COPY.saved.detail.placesSection.placeFallback}
              </h3>
            </div>

            <div className="relative z-20 flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-busy={isPrioritySaving}
                aria-label={item.isMustVisit ? "Must Visit 해제" : "Must Visit 설정"}
                onClick={(event) => {
                  stopCardNavigation(event);
                  onTogglePriority(item);
                }}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full border border-border/80 bg-white shadow-subtle transition",
                  item.isMustVisit
                    ? "text-star hover:border-[#FFD36A]"
                    : "text-slate-400 hover:border-[#FFD36A]/80 hover:text-star",
                  isPrioritySaving ? "ring-2 ring-primary/12" : null
                )}
              >
                <Star fill={item.isMustVisit ? "currentColor" : "none"} className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-label="장소 삭제"
                onClick={(event) => {
                  stopCardNavigation(event);
                  onRemove(item);
                }}
                className="grid h-9 w-9 place-items-center rounded-full border border-border/80 bg-white text-danger shadow-subtle transition hover:border-danger/30 hover:bg-danger/5"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-slate-500 md:text-sm">
            {hasRating ? <RatingInline value={item.place.rating as number} /> : null}
            {hasReviewCount ? (
              <>
                {hasRating ? <DotDivider /> : null}
                <span className="text-sm text-slate-400">리뷰 {formatCompactReviewCount(item.place.userRatingCount as number)}</span>
              </>
            ) : null}
            {item.place.formattedAddress ? (
              <>
                {hasRating || hasReviewCount ? <DotDivider /> : null}
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {compactLocation(item.place.formattedAddress)}
                </span>
              </>
            ) : (
              <span>{UI_COPY.saved.detail.placesSection.addressFallback}</span>
            )}
          </div>
        </div>
      </div>

      {showExistingNoteEditor ? (
        <NoteEditorPanel
          savedNote={savedNote}
          draftNote={draftNote}
          isSaving={isNoteSaving}
          onDraftChange={setDraftNote}
          onCancelEdit={() => {
            setDraftNote(savedNote);
            setIsEditingNote(false);
          }}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
        />
      ) : hasNote ? (
        <NoteDisplayPanel
          note={savedNote}
          isBusy={isNoteSaving}
          onEdit={() => setIsEditingNote(true)}
          onDelete={handleDeleteNote}
        />
      ) : null}

      {showInlineAddEditor ? (
        <div className="space-y-3">
          <NoteEditorPanel
            savedNote={savedNote}
            draftNote={draftNote}
            isSaving={isNoteSaving}
            onDraftChange={setDraftNote}
            onCancelEdit={() => {
              setDraftNote(savedNote);
              setIsEditingNote(false);
            }}
            onSave={handleSaveNote}
            onDelete={handleDeleteNote}
          />
          {item.place.googleMapsUrl ? (
            <div className="flex w-full flex-wrap items-center justify-end gap-2.5">
              <GhostPillLink href={item.place.googleMapsUrl}>{UI_COPY.routes.stopCard.mapAction}</GhostPillLink>
            </div>
          ) : null}
        </div>
      ) : showFooterActions ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-2.5">
          {!hasNote && !isEditingNote ? (
            <AddNoteGhostPillButton
              onClick={(event) => {
                stopCardNavigation(event);
                setIsEditingNote(true);
              }}
            />
          ) : null}
          {item.place.googleMapsUrl ? <GhostPillLink href={item.place.googleMapsUrl}>{UI_COPY.routes.stopCard.mapAction}</GhostPillLink> : null}
        </div>
      ) : null}
    </div>
  );
}
