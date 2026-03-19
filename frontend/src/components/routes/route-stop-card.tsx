"use client";

import {
  ArrowDown,
  ArrowUp,
  MapPin,
  Plus,
  Sparkles,
  Star,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";

import { CategoryBadge } from "@/components/common/category-badge";
import { GoogleMapsMark } from "@/components/common/google-maps-mark";
import { MustVisitIconBadge } from "@/components/common/must-visit-icon-badge";
import { NoteDisplayPanel, NoteEditorPanel } from "@/components/common/note-panels";
import { PlacePhoto } from "@/components/common/place-photo";
import { RouteLabelChip } from "@/components/routes/route-label-chip";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";
import { buildPlaceOpeningHint } from "@/lib/place-opening";

type RouteStopPlace = {
  id: string;
  name: string | null;
  formattedAddress: string | null;
  openingHours?: unknown;
  categories: string[];
  rating?: number | null;
  userRatingCount?: number | null;
  priceLevel?: number | null;
  typesRaw?: string[] | null;
  googleMapsUrl?: string | null;
  photos?: string[] | null;
};

export type RouteStopCardData = {
  id: string;
  stopOrder: number;
  time: string | null;
  label: string | null;
  isMustVisit: boolean;
  visitTip?: string | null;
  note?: string | null;
  place: RouteStopPlace;
};

export type RouteStopCardEditActions = {
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onMoveDay?: () => void;
  onDelete?: () => void;
  moveUpDisabled?: boolean;
  moveDownDisabled?: boolean;
  moveDayDisabled?: boolean;
  deleteDisabled?: boolean;
};

type RouteStopCardProps = {
  stop: RouteStopCardData;
  detailHref: string;
  isActive: boolean;
  onFocus: (stopId: string) => void;
  showMapAction?: boolean;
  showPlaceInfoAction?: boolean;
  showNoteSection?: boolean;
  showNoteActions?: boolean;
  isNoteOpen?: boolean;
  isNoteSaving?: boolean;
  onToggleNote?: (stopId: string) => void;
  onSaveNote?: (stopId: string, note: string | null) => void;
  editActions?: RouteStopCardEditActions | null;
  hideGeneratedMeta?: boolean;
};

function normalizeCopy(value: string | null | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeBadgeValue(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toUpperCase();
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

function DotDivider() {
  return <span className="h-1 w-1 rounded-full bg-slate-300" />;
}

function RatingInline({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
      <Star className="h-3 w-3 fill-[#FFB938] text-[#FFB938]" />
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
    <div className={cn("inline-flex items-center gap-1 text-2xs font-semibold md:text-xs", className)}>
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

function VisitTipPanel({ children }: { children: string }) {
  return (
    <div className="rounded-lg border border-[#CFE4FF] bg-[linear-gradient(135deg,rgba(60,157,255,0.14),rgba(255,255,255,0.95)_52%,rgba(232,244,255,0.9)_100%)] px-4 py-3 shadow-surface md:rounded-xl">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-xs font-medium leading-5 text-slate-700 md:text-sm">{children}</p>
      </div>
    </div>
  );
}

export function RouteStopCard({
  stop,
  detailHref,
  isActive,
  onFocus,
  showMapAction = true,
  showPlaceInfoAction = true,
  showNoteSection = true,
  showNoteActions = true,
  isNoteOpen = false,
  isNoteSaving = false,
  onToggleNote,
  onSaveNote,
  editActions = null,
  hideGeneratedMeta = false
}: RouteStopCardProps) {
  const openingHint = buildPlaceOpeningHint(stop.place.openingHours);
  const summaryText = hideGeneratedMeta ? "" : normalizeCopy(stop.visitTip);
  const savedNote = showNoteSection ? normalizeCopy(stop.note) : "";
  const canEditNote = showNoteSection && showNoteActions && Boolean(onToggleNote && onSaveNote);
  const [draftNote, setDraftNote] = useState(savedNote);
  const hasEditActions = Boolean(editActions);

  useEffect(() => {
    setDraftNote(savedNote);
  }, [savedNote, stop.id]);

  const handleToggleNote = (event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onToggleNote?.(stop.id);
  };

  const handleSaveNote = () => {
    if (!onSaveNote || isNoteSaving) return;
    onSaveNote(stop.id, draftNote.trim() || null);
  };

  const handleCancelNote = () => {
    setDraftNote(savedNote);
    onToggleNote?.(stop.id);
  };

  const handleDeleteNote = () => {
    if (!onSaveNote || isNoteSaving) return;
    onSaveNote(stop.id, null);
  };

  const statusTone =
    openingHint.status === "open"
      ? openingHint.warningText
        ? "closing"
        : "open"
      : openingHint.status === "closed"
        ? "closed"
        : "unknown";
  const statusLabel = openingHint.status === "unknown" ? "정보 없음" : openingHint.statusLabel;
  const showSavedNote = showNoteSection && !isNoteOpen && savedNote;
  const showNoteEditor = showNoteSection && isNoteOpen;
  const showAddNoteAction = canEditNote && !savedNote && !isNoteOpen && !hasEditActions;
  const resolvedEditActions = editActions;
  const hasMapAction = showMapAction && Boolean(stop.place.googleMapsUrl);
  const hasPlaceInfoAction = showPlaceInfoAction;
  const hasRating = typeof stop.place.rating === "number";
  const cardUtilityActionButtonClassName =
    "border border-border text-foreground/78 hover:!border-border-strong hover:!bg-slate-50 hover:!text-foreground";
  const cardMapIconButtonClassName = `w-8 px-0 justify-center md:w-10 ${cardUtilityActionButtonClassName}`;
  const primaryCategory = Array.isArray(stop.place.categories) ? (stop.place.categories[0] ?? null) : null;
  const shouldHideRedundantCategoryBadge =
    !hideGeneratedMeta &&
    Boolean(stop.label) &&
    Boolean(primaryCategory) &&
    normalizeBadgeValue(stop.label) === normalizeBadgeValue(primaryCategory);
  const renderCategoryBadge = () => {
    if (!primaryCategory || shouldHideRedundantCategoryBadge) {
      return null;
    }

    return <CategoryBadge value={primaryCategory} size="card" />;
  };

  return (
    <Card
      className={cn(
        "flex flex-col gap-3.5 rounded-xl bg-white/96 p-4 transition md:rounded-2xl md:p-5",
        isActive
          ? "border-[#B9DAFF] ring-4 ring-primary/15 shadow-raised"
          : "border-border/75 shadow-surface hover:border-primary-light/55"
      )}
      onClick={() => onFocus(stop.id)}
    >
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 flex flex-col gap-1.5 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {!hideGeneratedMeta && stop.label ? <RouteLabelChip value={stop.label} size="card" /> : null}
              {renderCategoryBadge()}
              {stop.isMustVisit ? <MustVisitIconBadge size="card" /> : null}
            </div>
            <h3
              title={stop.place.name || UI_COPY.routes.stopCard.placeFallback}
              className="line-clamp-2 break-words text-lg font-black leading-[1.2] tracking-[-0.03em] text-slate-950"
            >
              {stop.place.name || UI_COPY.routes.stopCard.placeFallback}
            </h3>
          </div>

          <div className="relative shrink-0">
            <PlacePhoto
              name={stop.place.name}
              photos={stop.place.photos}
              className="h-[76px] w-[76px] rounded-lg"
              sizes="76px"
            />
            {hasRating ? (
              <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full border border-white/14 bg-overlay/34 px-2 py-1 text-3xs font-semibold text-white shadow-[0_18px_36px_-22px_rgba(15,23,42,0.8)] backdrop-blur-xs">
                <Star className="h-3 w-3 fill-[#FFB938] text-[#FFB938]" />
                {stop.place.rating?.toFixed(1)}
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
          <StatusInline
            label={statusLabel}
            detail={openingHint.warningText}
            tone={statusTone}
            className="ml-0.5 max-w-full flex-wrap gap-x-1.5 gap-y-0.5 leading-none"
          />
          {stop.place.formattedAddress ? (
            <>
              <DotDivider />
              <span className="inline-flex items-start gap-1.5">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="line-clamp-2">{compactLocation(stop.place.formattedAddress)}</span>
              </span>
            </>
          ) : null}
        </div>

        {summaryText ? (
          <div className="rounded-[20px] border border-[#CFE4FF] bg-[linear-gradient(135deg,rgba(60,157,255,0.14),rgba(255,255,255,0.96)_56%,rgba(235,244,255,0.94)_100%)] px-3 py-2.5 shadow-surface">
            <div className="flex items-start gap-2">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-2xs font-medium leading-5 text-slate-700">{summaryText}</p>
            </div>
          </div>
        ) : null}

        {showNoteEditor ? (
          <NoteEditorPanel
            savedNote={savedNote}
            draftNote={draftNote}
            isSaving={isNoteSaving}
            onDraftChange={setDraftNote}
            onCancelEdit={handleCancelNote}
            onSave={handleSaveNote}
            onDelete={savedNote ? handleDeleteNote : undefined}
            className="md:hidden"
          />
        ) : null}

        {showSavedNote ? (
          <NoteDisplayPanel
            note={savedNote}
            isBusy={isNoteSaving}
            onEdit={canEditNote ? () => onToggleNote?.(stop.id) : undefined}
            onDelete={canEditNote ? handleDeleteNote : undefined}
            className="md:hidden"
          />
        ) : null}

        <div
          className={cn(
            "flex items-center gap-3",
            showAddNoteAction ? "justify-between" : "justify-end"
          )}
          onClick={(event) => event.stopPropagation()}
        >
          {showAddNoteAction ? (
            <div className="shrink-0">
              <button
                type="button"
                onClick={handleToggleNote}
                className={buttonStyles({
                  variant: "ghost",
                  size: "xsmall",
                  shape: "pill",
                  className: `${cardUtilityActionButtonClassName} [&_svg]:shrink-0`
                })}
              >
                <Plus />
                {UI_COPY.routes.stopCard.addNote}
              </button>
            </div>
          ) : null}

          <div className={cn("flex items-center justify-end gap-2", hasMapAction || hasPlaceInfoAction ? "shrink-0" : undefined)}>
            {hasMapAction ? (
              <a
                href={stop.place.googleMapsUrl || undefined}
                target="_blank"
                rel="noreferrer"
                aria-label="Google Maps"
                title="Google Maps"
                className={buttonStyles({
                  variant: "ghost",
                  size: "xsmall",
                  shape: "pill",
                  className: cardMapIconButtonClassName
                })}
              >
                <GoogleMapsMark />
              </a>
            ) : null}
            {hasPlaceInfoAction ? (
              <Link
                href={detailHref}
                onClick={(event) => event.stopPropagation()}
                className={buttonStyles({
                  size: "xsmall",
                  shape: "pill",
                  className: "text-white"
                })}
              >
                {UI_COPY.routes.stopCard.placeInfoAction}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className="hidden md:block">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {!hideGeneratedMeta && stop.label ? <RouteLabelChip value={stop.label} size="card" /> : null}
              {renderCategoryBadge()}
              {stop.isMustVisit ? <MustVisitIconBadge size="card" /> : null}
            </div>

            <h3
              title={stop.place.name || UI_COPY.routes.stopCard.placeFallback}
              className="line-clamp-2 break-words text-lg font-black leading-[1.2] tracking-tight text-slate-950 md:text-xl"
            >
              {stop.place.name || UI_COPY.routes.stopCard.placeFallback}
            </h3>

            <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500">
              <StatusInline label={statusLabel} detail={openingHint.warningText} tone={statusTone} className="ml-0.5" />
              {hasRating ? (
                <>
                  <DotDivider />
                  <RatingInline value={stop.place.rating as number} />
                </>
              ) : null}
              {stop.place.formattedAddress ? (
                <>
                  <DotDivider />
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-primary" />
                    {compactLocation(stop.place.formattedAddress)}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <PlacePhoto
            name={stop.place.name}
            photos={stop.place.photos}
            className="h-20 w-20 shrink-0 rounded-lg md:h-[92px] md:w-[92px] md:rounded-xl"
            sizes="(min-width: 640px) 92px, 84px"
          />
        </div>
      </div>

      {summaryText ? <div className="hidden md:block"><VisitTipPanel>{summaryText}</VisitTipPanel></div> : null}

      {resolvedEditActions ? (
        <div
          className="rounded-lg border border-primary-light/45 bg-primary-soft/55 px-4 py-3 md:rounded-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="xsmall"
              variant="secondary"
              shape="pill"
              onClick={resolvedEditActions.onMoveUp}
              disabled={!resolvedEditActions.onMoveUp || resolvedEditActions.moveUpDisabled}
            >
              <ArrowUp className="h-3.5 w-3.5" />
              위로
            </Button>
            <Button
              size="xsmall"
              variant="secondary"
              shape="pill"
              onClick={resolvedEditActions.onMoveDown}
              disabled={!resolvedEditActions.onMoveDown || resolvedEditActions.moveDownDisabled}
            >
              <ArrowDown className="h-3.5 w-3.5" />
              아래로
            </Button>
            <Button
              size="xsmall"
              variant="ghost"
              shape="pill"
              className="border border-border text-foreground/78"
              onClick={resolvedEditActions.onMoveDay}
              disabled={!resolvedEditActions.onMoveDay || resolvedEditActions.moveDayDisabled}
            >
              다른 날로 이동
            </Button>
            <Button
              size="xsmall"
              variant="ghost"
              shape="pill"
              className="border border-danger/18 text-danger hover:bg-danger/8"
              onClick={resolvedEditActions.onDelete}
              disabled={!resolvedEditActions.onDelete || resolvedEditActions.deleteDisabled}
            >
              <Trash2 className="h-3.5 w-3.5" />
              삭제
            </Button>
          </div>
        </div>
      ) : null}

      {showSavedNote ? (
        <NoteDisplayPanel
          note={savedNote}
          isBusy={isNoteSaving}
          onEdit={canEditNote ? () => onToggleNote?.(stop.id) : undefined}
          onDelete={canEditNote ? handleDeleteNote : undefined}
          className="hidden md:block"
        />
      ) : null}

      {showNoteEditor ? (
        <NoteEditorPanel
          savedNote={savedNote}
          draftNote={draftNote}
          isSaving={isNoteSaving}
          onDraftChange={setDraftNote}
          onCancelEdit={handleCancelNote}
          onSave={handleSaveNote}
          onDelete={savedNote ? handleDeleteNote : undefined}
          className="hidden md:block"
        />
      ) : null}

      <div className={cn("hidden md:flex flex-wrap items-center gap-3", showAddNoteAction ? "justify-between" : "justify-end")}>
        {showAddNoteAction ? (
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleNote}
              className={buttonStyles({
                variant: "ghost",
                size: "xsmall",
                shape: "pill",
                className: `${cardUtilityActionButtonClassName} [&_svg]:shrink-0`
              })}
            >
              <Plus />
              {UI_COPY.routes.stopCard.addNote}
            </button>
          </div>
        ) : null}

        <div className="flex items-center justify-end gap-2 md:shrink-0">
          {showMapAction && stop.place.googleMapsUrl ? (
            <a
              href={stop.place.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              aria-label="Google Maps"
              title="Google Maps"
              className={buttonStyles({
                variant: "ghost",
                size: "xsmall",
                shape: "pill",
                className: `w-10 px-0 justify-center ${cardUtilityActionButtonClassName}`
              })}
            >
              <GoogleMapsMark />
            </a>
          ) : null}
          {showPlaceInfoAction ? (
            <Link
              href={detailHref}
              onClick={(event) => event.stopPropagation()}
              className={buttonStyles({ size: "xsmall", shape: "pill", className: "text-white" })}
            >
              {UI_COPY.routes.stopCard.placeInfoAction}
            </Link>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

