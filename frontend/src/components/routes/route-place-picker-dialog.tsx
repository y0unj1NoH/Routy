"use client";

import { MapPin, NotebookPen, Search } from "lucide-react";
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
      contentClassName="flex min-h-0 flex-col overflow-hidden p-4 md:p-5"
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
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/35" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="장소 이름, 주소, 메모 검색"
            className="pl-9"
          />
        </div>

        <div className="min-h-0 max-h-[50dvh] overflow-y-auto pr-1">
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
                  "w-full rounded-xl border px-4 py-3 text-left shadow-surface transition-[background-color,border-color,box-shadow] md:rounded-2xl md:px-5 md:py-4",
                  "border-border/75 bg-white hover:border-primary/25 hover:bg-primary/5"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <PlacePhoto
                    name={item.place.name}
                    photos={item.place.photos}
                    className="h-16 w-16 shrink-0 rounded-lg md:h-20 md:w-20 md:rounded-xl"
                    sizes="(min-width: 640px) 80px, 64px"
                  />

                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                        {item.place.categories[0] ? <CategoryBadge size="compact" value={item.place.categories[0]} /> : null}
                        {item.isMustVisit ? <MustVisitIconBadge size="compact" /> : null}
                      </div>
                      <span
                        className={buttonStyles({
                          size: "small",
                          shape: "pill",
                          className:
                            "min-h-6 px-2 py-0.5 text-3xs font-black tracking-[0.06em] text-white shrink-0 self-start md:min-h-7 md:px-2.5 md:py-1 md:font-bold md:text-2xs"
                        })}
                      >
                        추가
                      </span>
                    </div>

                    <p className="line-clamp-2 break-keep text-xs font-black leading-[1.35] text-foreground md:text-sm">
                      {item.place.name || "이름 없는 장소"}
                    </p>

                    <div className="flex items-center gap-1.5 text-2xs font-medium text-foreground/60 md:text-xs">
                      <MapPin className="h-3 w-3 shrink-0 text-primary" />
                      <span className="line-clamp-2 break-keep leading-[1.4]">
                        {compactLocation(item.place.formattedAddress)}
                      </span>
                    </div>

                    {item.note ? (
                      <div className="flex items-center gap-1.5 text-2xs text-foreground/62 md:text-xs">
                        <NotebookPen className="h-3 w-3 shrink-0 text-foreground/38" />
                        <p className="line-clamp-2 break-keep leading-[1.4]">{item.note}</p>
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            ))
          )}
          </div>
        </div>
      </div>
    </DialogShell>
  );
}

