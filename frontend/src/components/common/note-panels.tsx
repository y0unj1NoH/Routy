"use client";

import { NotebookPen, PencilLine, Trash2 } from "lucide-react";
import type { MouseEvent as ReactMouseEvent } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { UI_COPY } from "@/constants/ui-copy";
import { cn } from "@/lib/cn";

function stopPanelClick(event: ReactMouseEvent<HTMLElement>) {
  event.stopPropagation();
}

function stopPanelAction(event: ReactMouseEvent<HTMLElement>) {
  event.preventDefault();
  event.stopPropagation();
}

type NoteDisplayPanelProps = {
  note: string;
  isBusy?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  className?: string;
};

export function NoteDisplayPanel({ note, isBusy = false, onEdit, onDelete, className }: NoteDisplayPanelProps) {
  return (
    <div className={cn("relative z-20 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-subtle md:rounded-xl", className)} onClick={stopPanelClick}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-slate-400" />
          <p className="text-2xs font-black uppercase tracking-[0.16em] text-slate-400 md:text-xs">memo</p>
        </div>
        {onEdit || onDelete ? (
          <div className="flex items-center gap-2">
            {onEdit ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={(event) => {
                  stopPanelAction(event);
                  onEdit();
                }}
                className="inline-flex items-center gap-1 leading-none text-2xs font-semibold text-primary transition hover:text-primary-hover disabled:pointer-events-none disabled:opacity-50 md:text-xs"
              >
                <PencilLine className="h-3.5 w-3.5 shrink-0" />
                {UI_COPY.routes.stopCard.edit}
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={(event) => {
                  stopPanelAction(event);
                  onDelete();
                }}
                className="inline-flex items-center gap-1 leading-none text-2xs font-semibold text-danger transition hover:opacity-80 disabled:pointer-events-none disabled:opacity-50 md:text-xs"
              >
                <Trash2 className="h-3.5 w-3.5 shrink-0" />
                {UI_COPY.routes.stopCard.delete}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <p className="mt-2 text-xs font-medium leading-5 text-slate-700 md:text-sm">{note}</p>
    </div>
  );
}

type NoteEditorPanelProps = {
  savedNote: string;
  draftNote: string;
  isSaving?: boolean;
  onDraftChange: (nextValue: string) => void;
  onCancelEdit: () => void;
  onSave: () => void;
  onDelete?: () => void;
  className?: string;
};

export function NoteEditorPanel({
  savedNote,
  draftNote,
  isSaving = false,
  onDraftChange,
  onCancelEdit,
  onSave,
  onDelete,
  className
}: NoteEditorPanelProps) {
  const hasNote = savedNote.length > 0;
  const isDirty = draftNote.trim() !== savedNote;

  return (
    <div
      className={cn("relative z-20 rounded-lg border border-slate-200 bg-white px-4 py-3 shadow-subtle md:rounded-xl", className)}
      onClick={stopPanelClick}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-4 w-4 text-slate-400" />
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">memo edit</p>
        </div>
        <p className="text-2xs text-slate-400 md:text-xs">{UI_COPY.routes.stopCard.noteDescription}</p>
      </div>
      <Textarea
        rows={3}
        value={draftNote}
        onChange={(event) => onDraftChange(event.target.value)}
        onClick={stopPanelClick}
        placeholder={UI_COPY.routes.stopCard.notePlaceholder}
        className="mt-3 min-h-[88px] resize-none border-slate-200 bg-slate-50 text-xs leading-4 shadow-none"
      />
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        {hasNote && onDelete ? (
          <Button
            size="xsmall"
            variant="ghost"
            disabled={isSaving}
            onClick={(event) => {
              stopPanelAction(event);
              onDelete();
            }}
            className="text-danger"
          >
            {UI_COPY.routes.stopCard.delete}
          </Button>
        ) : null}
        <Button
          size="xsmall"
          variant="ghost"
          disabled={isSaving}
          onClick={(event) => {
            stopPanelAction(event);
            onCancelEdit();
          }}
          className="text-slate-500"
        >
          {UI_COPY.routes.stopCard.cancel}
        </Button>
        <Button
          size="xsmall"
          shape="pill"
          disabled={isSaving || !isDirty}
          onClick={(event) => {
            stopPanelAction(event);
            onSave();
          }}
          className="text-white"
        >
          {isSaving ? UI_COPY.routes.stopCard.saving : UI_COPY.routes.stopCard.save}
        </Button>
      </div>
    </div>
  );
}
