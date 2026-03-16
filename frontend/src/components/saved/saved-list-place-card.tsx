"use client";

import { ExternalLink, MapPin, NotebookPen, PencilLine, Plus, Star, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CategoryBadge } from "@/components/common/category-badge";
import { PlacePhoto } from "@/components/common/place-photo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonStyles } from "@/components/ui/button-styles";
import { Textarea } from "@/components/ui/textarea";
import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";
import { buildPlaceOpeningHint } from "@/lib/place-opening";
import type { PlaceListItem } from "@/types/domain";

type SavedListPlaceCardProps = {
  item: PlaceListItem;
  detailHref: string;
  isNoteSaving?: boolean;
  isPrioritySaving?: boolean;
  onTogglePriority: (item: PlaceListItem) => void;
  onRemove: (item: PlaceListItem) => void;
  onSaveNote: (itemId: string, note: string | null) => void;
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

function MemoPanel({
  savedNote,
  isSaving,
  onStartEdit,
  onDelete
}: {
  savedNote: string;
  isSaving: boolean;
  onStartEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-slate-400" />
          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">memo</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onStartEdit}
            disabled={isSaving}
            className="relative z-20 inline-flex items-center gap-1 leading-none text-xs font-semibold text-primary transition hover:text-primary-hover disabled:pointer-events-none disabled:opacity-50"
          >
            <PencilLine className="h-3.5 w-3.5 shrink-0" />
            {UI_COPY.routes.stopCard.edit}
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isSaving}
            className="relative z-20 inline-flex items-center gap-1 leading-none text-xs font-semibold text-danger transition hover:opacity-80 disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5 shrink-0" />
            {UI_COPY.routes.stopCard.delete}
          </button>
        </div>
      </div>
      <p className="mt-2 text-sm font-medium leading-6 text-slate-700">{savedNote}</p>
    </div>
  );
}

function NoteEditorPanel({
  savedNote,
  draftNote,
  isSaving,
  onDraftChange,
  onCancelEdit,
  onSave,
  onDelete
}: {
  savedNote: string;
  draftNote: string;
  isSaving: boolean;
  onDraftChange: (nextValue: string) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete: () => void;
}) {
  const hasNote = savedNote.length > 0;
  const isDirty = draftNote.trim() !== savedNote;

  return (
    <div className="relative z-20 rounded-[22px] border border-slate-200 bg-white px-4 py-4 shadow-[0_12px_26px_rgba(15,23,42,0.05)]">
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
        onChange={(event) => onDraftChange(event.target.value)}
        placeholder={UI_COPY.routes.stopCard.notePlaceholder}
        className="mt-3 min-h-[96px] resize-none border-slate-200 bg-slate-50 shadow-none"
      />
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {hasNote ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={isSaving}
            onClick={onDelete}
            className="h-9 px-3 text-xs font-semibold text-danger"
          >
            {UI_COPY.routes.stopCard.delete}
          </Button>
        ) : null}
        <Button
          size="sm"
          variant="ghost"
          disabled={isSaving}
          onClick={onCancelEdit}
          className="h-9 px-3 text-xs font-semibold text-slate-500"
        >
          {UI_COPY.routes.stopCard.cancel}
        </Button>
        <Button
          size="sm"
          shape="pill"
          disabled={isSaving || !isDirty}
          onClick={onSave}
          className="h-9 px-4 text-xs font-bold text-white"
        >
          {isSaving ? UI_COPY.routes.stopCard.saving : UI_COPY.routes.stopCard.save}
        </Button>
      </div>
    </div>
  );
}

function GhostPillLink({ href, children }: { href: string; children: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={buttonStyles({
        variant: "ghost",
        size: "sm",
        shape: "pill",
        className:
          "relative z-20 border border-border text-xs font-semibold leading-none text-foreground/78 hover:bg-muted/70 hover:text-foreground [&_svg]:shrink-0"
      })}
    >
      {children}
      <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
    </a>
  );
}

function AddNoteGhostPillButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={buttonStyles({
        variant: "ghost",
        size: "sm",
        shape: "pill",
        className:
          "relative z-20 border border-border text-xs font-semibold leading-none text-foreground/78 hover:bg-muted/70 hover:text-foreground [&_svg]:shrink-0"
      })}
    >
      <Plus className="mr-1.5 h-3.5 w-3.5" />
      {UI_COPY.routes.stopCard.addNote}
    </button>
  );
}

export function SavedListPlaceCard({
  item,
  detailHref,
  isNoteSaving = false,
  isPrioritySaving = false,
  onTogglePriority,
  onRemove,
  onSaveNote
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

  return (
    <div className="group relative space-y-4 rounded-[30px] border border-[#B9DAFF] bg-white/96 p-5 shadow-[0_20px_44px_rgba(60,157,255,0.12)] transition-[border-color,box-shadow,transform,background-color] duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card hover:shadow-[0_22px_44px_rgba(15,23,42,0.14)]">
      <Link
        href={detailHref}
        aria-label={`${item.place.name || UI_COPY.saved.detail.placesSection.placeFallback} 상세 보기`}
        className="absolute inset-0 z-10 rounded-[inherit] focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/15"
      />
      <div className="grid gap-4 sm:grid-cols-[120px_minmax(0,1fr)] sm:items-start">
        <PlacePhoto
          name={item.place.name}
          photos={item.place.photos}
          className="h-[120px] w-[120px] shrink-0 rounded-[22px]"
          sizes="120px"
        />

        <div className="min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {item.isMustVisit ? <Badge>{UI_COPY.saved.detail.placesSection.mustVisitBadge}</Badge> : null}
                <CategoryBadge value={item.place.category} />
                <StatusInline label={statusLabel} detail={openingHint.warningText} tone={statusTone} />
              </div>

              <h3 className="line-clamp-2 text-[1.55rem] font-black leading-tight tracking-tight text-slate-950 transition-colors group-hover:text-primary">
                {item.place.name || UI_COPY.saved.detail.placesSection.placeFallback}
              </h3>
            </div>

            <div className="relative z-20 flex shrink-0 items-center gap-2">
              <button
                type="button"
                aria-busy={isPrioritySaving}
                aria-label={item.isMustVisit ? "Must Visit 해제" : "Must Visit 설정"}
                onClick={() => onTogglePriority(item)}
                className={cn(
                  "grid h-9 w-9 place-items-center rounded-full border border-border/80 bg-white shadow-[0_10px_20px_rgba(15,23,42,0.06)] transition",
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
                onClick={() => onRemove(item)}
                className="grid h-9 w-9 place-items-center rounded-full border border-border/80 bg-white text-danger shadow-[0_10px_20px_rgba(15,23,42,0.05)] transition hover:border-danger/30 hover:bg-danger/5"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-500">
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
        <MemoPanel
          savedNote={savedNote}
          isSaving={isNoteSaving}
          onStartEdit={() => setIsEditingNote(true)}
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
          {!hasNote && !isEditingNote ? <AddNoteGhostPillButton onClick={() => setIsEditingNote(true)} /> : null}
          {item.place.googleMapsUrl ? <GhostPillLink href={item.place.googleMapsUrl}>{UI_COPY.routes.stopCard.mapAction}</GhostPillLink> : null}
        </div>
      ) : null}
    </div>
  );
}
