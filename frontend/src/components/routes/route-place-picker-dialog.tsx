"use client";

import { NotebookPen, Search } from "lucide-react";
import { useMemo, useState } from "react";

import { CategoryBadge } from "@/components/common/category-badge";
import { DialogShell } from "@/components/common/dialog-shell";
import { MustVisitIconBadge } from "@/components/common/must-visit-icon-badge";
import { PlacePhoto } from "@/components/common/place-photo";
import { buttonStyles } from "@/components/ui/button-styles";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import type { PlaceListItem } from "@/types/domain";

type RoutePlacePickerDialogProps = {
  open: boolean;
  availablePlaces: PlaceListItem[];
  selectedDayNumber: number | null;
  canAddGooglePlace?: boolean;
  onClose: () => void;
  onSelectPlace: (placeItem: PlaceListItem) => void;
  onStartGooglePlaceAdd?: () => void;
};

function compactLocation(address: string | null) {
  if (!address) return "주소 정보 없음";

  const cleaned = address
    .split(",")
    .map((part) => part.replace(/\bThailand\b/gi, "").replace(/\b\d{5,6}\b/g, "").trim())
    .filter(Boolean);

  if (cleaned.length >= 2) {
    return `${cleaned[cleaned.length - 2]} · ${cleaned[cleaned.length - 1]}`;
  }

  return cleaned[0] || address;
}

export function RoutePlacePickerDialog({
  open,
  availablePlaces,
  selectedDayNumber,
  canAddGooglePlace = false,
  onClose,
  onSelectPlace,
  onStartGooglePlaceAdd
}: RoutePlacePickerDialogProps) {
  const [query, setQuery] = useState("");

  const filteredPlaces = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return availablePlaces;

    return availablePlaces.filter((item) => {
      const haystack = [item.place.name, item.place.formattedAddress, item.note]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");

      return haystack.includes(normalizedQuery);
    });
  }, [availablePlaces, query]);

  return (
    <DialogShell
      open={open}
      onClose={() => {
        setQuery("");
        onClose();
      }}
      title={selectedDayNumber ? `${selectedDayNumber}일차에 장소 추가` : "장소 추가"}
      mascotVariant={null}
      headerClassName="bg-[linear-gradient(135deg,rgba(232,244,255,0.94),rgba(255,255,255,1)_72%)]"
      showCloseButton={false}
      size="lg"
      footer={
        <>
          <button
            type="button"
            className={buttonStyles({ variant: "secondary", size: "medium" })}
            onClick={() => {
              setQuery("");
              onClose();
            }}
          >
            닫기
          </button>
          {onStartGooglePlaceAdd ? (
            <button
              type="button"
              className={buttonStyles({ size: "medium" })}
              onClick={() => {
                onStartGooglePlaceAdd();
                setQuery("");
              }}
              disabled={!canAddGooglePlace}
            >
              Google 장소 추가
            </button>
          ) : null}
        </>
      }
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="장소 이름, 주소, 메모 검색"
            className="pl-9"
          />
        </div>

        <div className="space-y-3">
          {filteredPlaces.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border bg-card/80 px-4 py-8 text-center text-xs font-medium text-foreground/58 md:rounded-2xl md:text-sm">
              추가할 장소가 없어요
            </div>
          ) : (
            filteredPlaces.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectPlace(item);
                  setQuery("");
                }}
                className={cn(
                  "w-full rounded-xl border border-border/75 bg-white/96 px-4 py-4 text-left shadow-surface transition hover:border-primary-light/65 hover:bg-primary-soft/30 md:rounded-2xl"
                )}
              >
                <div className="flex items-start gap-4">
                  <PlacePhoto
                    name={item.place.name}
                    photos={item.place.photos}
                    className="h-20 w-20 shrink-0 rounded-lg md:h-[92px] md:w-[92px] md:rounded-xl"
                    sizes="(max-width: 767px) 80px, 92px"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {item.place.categories[0] ? <CategoryBadge size="card" value={item.place.categories[0]} /> : null}
                      {item.isMustVisit ? <MustVisitIconBadge size="card" /> : null}
                    </div>
                    <div className="space-y-1">
                      <p className="line-clamp-2 text-base font-black text-foreground">{item.place.name || "이름 없는 장소"}</p>
                      <p className="text-sm font-medium text-foreground/62">{compactLocation(item.place.formattedAddress)}</p>
                    </div>
                    {item.note ? (
                      <div className="flex items-start gap-2 text-sm leading-6 text-foreground/72">
                        <NotebookPen className="mt-1 h-4 w-4 shrink-0 text-foreground/42" />
                        <p className="min-w-0">{item.note}</p>
                      </div>
                    ) : null}
                  </div>
                  <span className={buttonStyles({ size: "small", shape: "pill", className: "shrink-0 text-white" })}>
                    추가
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </DialogShell>
  );
}

