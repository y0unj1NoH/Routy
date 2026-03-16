"use client";

import {
  ArrowDown,
  ArrowUp,
  Clock3,
  ExternalLink,
  MapPin,
  NotebookPen,
  PencilLine,
  Plus,
  Sparkles,
  Star,
  Trash2
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState, type MouseEvent as ReactMouseEvent } from "react";

import { CategoryBadge } from "@/components/common/category-badge";
import { PlacePhoto } from "@/components/common/place-photo";
import { RouteLabelChip } from "@/components/routes/route-label-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MUST_VISIT_BADGE } from "@/constants/route-taxonomy";
import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";
import { buildPlaceOpeningHint } from "@/lib/place-opening";

type RouteStopPlace = {
  id: string;
  name: string | null;
  formattedAddress: string | null;
  openingHours?: unknown;
  category?: string | null;
  rating?: number | null;
  userRatingCount?: number | null;
  priceLevel?: number | null;
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
  showNoteSection?: boolean;
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
    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500">
      <Star className="h-3.5 w-3.5 fill-[#FFB938] text-[#FFB938]" />
      {value.toFixed(1)}
    </span>
  );
}

function StatusInline({
  label,
  detail,
  tone
}: {
  label: string;
  detail?: string | null;
  tone: "open" | "closing" | "closed" | "unknown";
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
    <div className="inline-flex items-center gap-1.5 text-[11px] font-semibold">
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
    <div className="rounded-[22px] border border-[#CFE4FF] bg-[linear-gradient(135deg,rgba(60,157,255,0.14),rgba(255,255,255,0.95)_52%,rgba(232,244,255,0.9)_100%)] px-4 py-3 shadow-[0_14px_30px_rgba(60,157,255,0.12)]">
      <div className="flex items-start gap-2.5">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p className="text-sm font-medium leading-6 text-slate-700">{children}</p>
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
  showNoteSection = true,
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
  const canEditNote = showNoteSection && Boolean(onToggleNote && onSaveNote);
  const [draftNote, setDraftNote] = useState(savedNote);
  const isNoteDirty = draftNote.trim() !== savedNote;
  const hasEditActions = Boolean(editActions);

  useEffect(() => {
    setDraftNote(savedNote);
  }, [savedNote, stop.id]);

  const handleToggleNote = (event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
    onToggleNote?.(stop.id);
  };

  const handleSaveNote = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!onSaveNote || isNoteSaving) return;
    onSaveNote(stop.id, draftNote.trim() || null);
  };

  const handleCancelNote = (event: ReactMouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setDraftNote(savedNote);
    onToggleNote?.(stop.id);
  };

  const handleDeleteNote = (event: ReactMouseEvent<HTMLButtonElement | HTMLElement>) => {
    event.stopPropagation();
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

  return (
    <Card
      className={cn(
        "space-y-4 rounded-[30px] bg-white/96 p-5 transition",
        isActive
          ? "border-[#B9DAFF] ring-4 ring-primary/15 shadow-[0_20px_44px_rgba(60,157,255,0.12)]"
          : "border-border/75 shadow-[0_18px_38px_rgba(15,23,42,0.08)] hover:border-primary-light/55"
      )}
      onClick={() => onFocus(stop.id)}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-500">
            {!hideGeneratedMeta ? (
              <>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5 text-primary" />
                  {stop.time || "--:--"}
                </span>
                <DotDivider />
                <RouteLabelChip value={stop.label || "VISIT"} />
                <StatusInline label={statusLabel} detail={openingHint.warningText} tone={statusTone} />
              </>
            ) : (
              <StatusInline label={statusLabel} detail={openingHint.warningText} tone={statusTone} />
            )}
          </div>

          <h3
            title={stop.place.name || UI_COPY.routes.stopCard.placeFallback}
            className="line-clamp-2 break-words text-[1.55rem] font-black leading-tight tracking-tight text-slate-950"
          >
            {stop.place.name || UI_COPY.routes.stopCard.placeFallback}
          </h3>

          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
            <CategoryBadge value={stop.place.category} />
            {typeof stop.place.rating === "number" ? (
              <>
                <DotDivider />
                <RatingInline value={stop.place.rating} />
              </>
            ) : null}
            {stop.place.formattedAddress ? (
              <>
                <DotDivider />
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-primary" />
                  {compactLocation(stop.place.formattedAddress)}
                </span>
              </>
            ) : null}
          </div>
        </div>

        <PlacePhoto
          name={stop.place.name}
          photos={stop.place.photos}
          className="h-[104px] w-[104px] shrink-0 rounded-[22px]"
          sizes="104px"
        />
      </div>

      {summaryText ? <VisitTipPanel>{summaryText}</VisitTipPanel> : null}

      {resolvedEditActions ? (
        <div
          className="rounded-[22px] border border-primary-light/45 bg-primary-soft/55 px-4 py-3"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="secondary"
              shape="pill"
              className="h-9 px-3 text-xs font-semibold"
              onClick={resolvedEditActions.onMoveUp}
              disabled={!resolvedEditActions.onMoveUp || resolvedEditActions.moveUpDisabled}
            >
              <ArrowUp className="mr-1.5 h-3.5 w-3.5" />
              위로
            </Button>
            <Button
              size="sm"
              variant="secondary"
              shape="pill"
              className="h-9 px-3 text-xs font-semibold"
              onClick={resolvedEditActions.onMoveDown}
              disabled={!resolvedEditActions.onMoveDown || resolvedEditActions.moveDownDisabled}
            >
              <ArrowDown className="mr-1.5 h-3.5 w-3.5" />
              아래로
            </Button>
            <Button
              size="sm"
              variant="ghost"
              shape="pill"
              className="h-9 border border-border px-3 text-xs font-semibold text-foreground/78"
              onClick={resolvedEditActions.onMoveDay}
              disabled={!resolvedEditActions.onMoveDay || resolvedEditActions.moveDayDisabled}
            >
              다른 날로 이동
            </Button>
            <Button
              size="sm"
              variant="ghost"
              shape="pill"
              className="h-9 border border-danger/18 px-3 text-xs font-semibold text-danger hover:bg-danger/8"
              onClick={resolvedEditActions.onDelete}
              disabled={!resolvedEditActions.onDelete || resolvedEditActions.deleteDisabled}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              삭제
            </Button>
          </div>
        </div>
      ) : null}

      {showSavedNote ? (
        <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-slate-400" />
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">memo</p>
            </div>
            {canEditNote ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleToggleNote}
                  className="inline-flex items-center gap-1 leading-none text-xs font-semibold text-primary transition hover:text-primary-hover"
                >
                  <PencilLine className="h-3.5 w-3.5 shrink-0" />
                  {UI_COPY.routes.stopCard.edit}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteNote}
                  className="inline-flex items-center gap-1 leading-none text-xs font-semibold text-danger transition hover:opacity-80"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  {UI_COPY.routes.stopCard.delete}
                </button>
              </div>
            ) : null}
          </div>
          <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{savedNote}</p>
        </div>
      ) : null}

      {showNoteEditor ? (
        <div
          className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <NotebookPen className="h-4 w-4 text-slate-400" />
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">memo edit</p>
            </div>
            <p className="text-xs text-slate-400">{UI_COPY.routes.stopCard.noteDescription}</p>
          </div>
          <Textarea
            rows={3}
            value={draftNote}
            onChange={(event) => setDraftNote(event.target.value)}
            onClick={(event) => event.stopPropagation()}
            placeholder={UI_COPY.routes.stopCard.notePlaceholder}
            className="mt-3 min-h-[96px] resize-none border-slate-200 bg-slate-50 shadow-none"
          />
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            {savedNote ? (
              <Button size="sm" variant="ghost" onClick={handleDeleteNote} disabled={isNoteSaving} className="h-9 px-3 text-xs font-semibold text-danger">
                {UI_COPY.routes.stopCard.delete}
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={handleCancelNote} disabled={isNoteSaving} className="h-9 px-3 text-xs font-semibold text-slate-500">
              {UI_COPY.routes.stopCard.cancel}
            </Button>
            <Button size="sm" shape="pill" onClick={handleSaveNote} disabled={isNoteSaving || !isNoteDirty} className="h-9 px-4 text-xs font-bold text-white">
              {isNoteSaving ? UI_COPY.routes.stopCard.saving : UI_COPY.routes.stopCard.save}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          {showAddNoteAction ? (
            <button
              type="button"
              onClick={handleToggleNote}
              className={buttonStyles({
                variant: "ghost",
                size: "sm",
                shape: "pill",
                className:
                  "border border-border text-xs font-semibold leading-none text-foreground/78 hover:bg-muted/70 hover:text-foreground [&_svg]:shrink-0"
              })}
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {UI_COPY.routes.stopCard.addNote}
            </button>
          ) : null}
          {stop.isMustVisit ? <Badge tone="primary">{MUST_VISIT_BADGE}</Badge> : null}
        </div>

        <div className={cn("flex items-center justify-end gap-2", !showAddNoteAction && !stop.isMustVisit ? "sm:ml-auto" : "sm:shrink-0")}>
          {showMapAction && stop.place.googleMapsUrl ? (
            <a
              href={stop.place.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(event) => event.stopPropagation()}
              className={buttonStyles({
                variant: "ghost",
                size: "sm",
                shape: "pill",
                className:
                  "border border-border text-xs font-semibold leading-none text-foreground/78 hover:bg-muted/70 hover:text-foreground [&_svg]:shrink-0"
              })}
            >
              {UI_COPY.routes.stopCard.mapAction}
              <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
            </a>
          ) : null}
          <Link
            href={detailHref}
            onClick={(event) => event.stopPropagation()}
            className={buttonStyles({ size: "sm", shape: "pill", className: "px-4 text-xs font-bold text-white" })}
          >
            {UI_COPY.routes.stopCard.placeInfoAction}
          </Link>
        </div>
      </div>
    </Card>
  );
}
