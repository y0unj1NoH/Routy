"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Compass,
  Handshake,
  Heart,
  Home,
  Landmark,
  Leaf,
  MapPin,
  NotebookPen,
  PartyPopper,
  Plus,
  ShoppingBag,
  TreePine,
  UserRound,
  UtensilsCrossed,
  Zap,
  type LucideIcon
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { DialogFieldHint, DialogFieldLabel } from "@/components/common/dialog-field";
import { DialogShell } from "@/components/common/dialog-shell";
import { LinkInput } from "@/components/common/link-input";
import { LoadingPanel } from "@/components/common/loading-panel";
import { MustVisitIconBadge } from "@/components/common/must-visit-icon-badge";
import { PageEmptyState } from "@/components/common/page-empty-state";
import { PlacePhoto } from "@/components/common/place-photo";
import { ImportListModal } from "@/components/import/import-list-modal";
import { Mascot, type MascotVariant } from "@/components/layout/mascot";
import { PageContainer } from "@/components/layout/page-container";
import { ProgressHeader } from "@/components/layout/progress-header";
import { SelectableOptionCard } from "@/components/routes/selectable-option-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { buttonVariantToneClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import {
  mapFunnelQueryToRenderStep,
  mapRenderToQueryStep,
  normalizeFunnelStep,
  type FunnelQueryStep
} from "@/constants/funnel";
import { type ThemeValue } from "@/constants/route-taxonomy";
import { UI_COPY } from "@/constants/ui-copy";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { cn } from "@/lib/cn";
import { AppGraphQLError } from "@/lib/graphql/client";
import { resolveAiScheduleQuotaMessage } from "@/lib/graphql/ai-schedule-errors";
import { addPlaceListItem, createSchedule, fetchMyPlaceLists, fetchPlaceListDetail, importPlaceFromGoogleLink } from "@/lib/graphql/api";
import { resolveImportErrorMessage } from "@/lib/graphql/import-errors";
import { queryKeys } from "@/lib/query-keys";
import { useCreateScheduleStore } from "@/stores/create-schedule-store";
import { useUiStore } from "@/stores/ui-store";
import type { PlaceListItem } from "@/types/domain";

type FunnelContext = {
  title?: string;
  placeListId?: string;
  startDate?: string;
  endDate?: string;
  stayMode?: "booked" | "unbooked" | null;
  stayPlaceId?: string | null;
  companions?: string | null;
  pace?: string | null;
  themes?: string[];
};

type RenderStep = "List" | "Date" | "Stay" | "Companions" | "Style";

const STEP_INDEX: Record<FunnelQueryStep, number> = {
  list: 1,
  date: 2,
  stay: 3,
  companions: 4,
  style: 5
};
const MAX_SCHEDULE_DAYS = 7;
const DATE_STEP_MUST_VISIT_PER_DAY_LIMIT = 7;
const FINAL_MUST_VISIT_MULTIPLIER_BY_PACE: Record<string, number> = {
  RELAXED: 5,
  MODERATE: 6,
  INTENSE: 7
};

const COMPANION_ICONS: Record<string, LucideIcon> = {
  SOLO: UserRound,
  FRIENDS: Handshake,
  COUPLE: Heart,
  FAMILY: Home,
  GROUP: PartyPopper
};

const PACE_ICONS: Record<string, LucideIcon> = {
  INTENSE: Zap,
  RELAXED: Leaf,
  MODERATE: Compass
};

const THEME_ICONS: Record<ThemeValue, LucideIcon> = {
  FOODIE: UtensilsCrossed,
  LANDMARK: Landmark,
  SHOPPING: ShoppingBag,
  NATURE: TreePine
};

const FUNNEL_MASCOT_CLASS_MAP: Partial<Record<MascotVariant, string>> = {
  calendar: "h-20 w-20",
  hotel: "h-20 w-24",
  friend: "h-20 w-28",
  map: "h-20 w-24"
};

function parseIsoDate(value?: string) {
  if (!value) return null;
  const [yearRaw, monthRaw, dayRaw] = value.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isMonthBefore(left: Date, right: Date) {
  if (left.getFullYear() !== right.getFullYear()) {
    return left.getFullYear() < right.getFullYear();
  }

  return left.getMonth() < right.getMonth();
}

function isSameMonth(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}

function getInclusiveDayCount(startDate: string | undefined, endDate: string | undefined) {
  const start = parseIsoDate(startDate);
  const end = parseIsoDate(endDate);
  if (!start || !end) return null;

  const diffMs = startOfDay(end).getTime() - startOfDay(start).getTime();
  if (diffMs < 0) return null;
  return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

function addDaysToIsoDate(dateIso: string, days: number) {
  const parsed = parseIsoDate(dateIso);
  if (!parsed) return "";
  return toIsoDate(addDays(parsed, days));
}

function countSchedulableMustVisits(items: PlaceListItem[] | undefined) {
  return (items || []).reduce((count, item) => {
    if (!item.isMustVisit) return count;
    if (item.place.categories.includes("STAY")) return count;
    return count + 1;
  }, 0);
}

function resolveFinalMustVisitLimit(dayCount: number | null, pace: string | null | undefined) {
  if (!dayCount) return null;
  const multiplier = FINAL_MUST_VISIT_MULTIPLIER_BY_PACE[String(pace || "").trim().toUpperCase()] || null;
  if (!multiplier) return null;
  return dayCount * multiplier;
}

function isMustVisitLimitExceededError(error: unknown): error is AppGraphQLError & {
  details: { kind: "MUST_VISIT_LIMIT_EXCEEDED"; dayCount: number; mustVisitCount: number; limit: number };
} {
  return (
    error instanceof AppGraphQLError &&
    error.code === "BAD_USER_INPUT" &&
    typeof error.details === "object" &&
    error.details !== null &&
    (error.details as { kind?: unknown }).kind === "MUST_VISIT_LIMIT_EXCEEDED"
  );
}

function normalizeDateRange(startDate: string | undefined, endDate: string | undefined, minSelectableDate: string) {
  if (!startDate || startDate < minSelectableDate) {
    return { startDate: "", endDate: "" };
  }

  if (!endDate || endDate < startDate || endDate < minSelectableDate) {
    return { startDate, endDate: "" };
  }

  const selectedDayCount = getInclusiveDayCount(startDate, endDate);
  if (!selectedDayCount || selectedDayCount > MAX_SCHEDULE_DAYS) {
    return { startDate, endDate: "" };
  }

  return { startDate, endDate };
}

function formatMonthTitle(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function formatSelectedDateLabel(dateIso: string | undefined) {
  const parsed = parseIsoDate(dateIso);
  if (!parsed) return UI_COPY.routes.new.dateStep.unselectedDate;
  return `${parsed.getMonth() + 1}.${parsed.getDate()}`;
}

function buildMonthCells(monthDate: Date) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const firstWeekday = firstDay.getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const cells: Array<{ date: Date; iso: string } | null> = [];

  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    const date = new Date(year, month, day);
    cells.push({ date, iso: toIsoDate(date) });
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function FunnelHeader({
  title,
  description,
  emoji,
  mascotVariant,
  mascotClassName
}: {
  title: string;
  description?: string;
  emoji?: string;
  mascotVariant?: MascotVariant;
  mascotClassName?: string;
}) {
  return (
    <div className="space-y-2.5 text-center">
      {mascotVariant ? (
        <Mascot
          variant={mascotVariant}
          className={cn("mx-auto h-[var(--mascot-funnel-size)]", FUNNEL_MASCOT_CLASS_MAP[mascotVariant] ?? "w-[var(--mascot-funnel-size)]", mascotClassName)}
        />
      ) : (
        <div className="mx-auto grid h-24 w-24 place-items-center rounded-full border border-border-strong bg-card/92 text-3xl text-primary shadow-surface">
          {emoji}
        </div>
      )}
      <h1 className="break-keep text-xl font-black leading-[1.2] tracking-[-0.02em] md:text-2xl xl:text-3xl">{title}</h1>
      {description ? <p className="break-keep text-xs leading-[1.5] text-foreground/65">{description}</p> : null}
    </div>
  );
}

function FunnelContent({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cn("flex w-full flex-col gap-[var(--page-block-gap)]", className)}>{children}</div>;
}

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

function StayOptionCard({
  item,
  selected,
  isNewlyAdded,
  onSelect
}: {
  item: PlaceListItem;
  selected: boolean;
  isNewlyAdded: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full rounded-xl border px-4 py-3 text-left shadow-surface transition-[background-color,border-color,box-shadow] md:rounded-2xl md:px-5 md:py-4",
        selected
          ? "border-primary bg-primary/10 shadow-raised"
          : "border-border/75 bg-white hover:border-primary/25 hover:bg-primary/5"
      )}
    >
      <div className="flex items-start gap-2.5">
        <PlacePhoto
          name={item.place.name}
          coverPhoto={item.place.coverPhoto}
          className="h-16 w-16 shrink-0 rounded-lg md:h-20 md:w-20 md:rounded-xl"
          sizes="(min-width: 640px) 80px, 64px"
        />

        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              <p className="line-clamp-2 break-keep text-xs font-black leading-[1.35] text-foreground md:text-sm">
                {item.place.name || UI_COPY.saved.detail.placesSection.placeFallback}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                {item.isMustVisit ? <MustVisitIconBadge size="card" /> : null}
                {isNewlyAdded ? <Badge size="card" className="bg-white/90">Google 추가</Badge> : null}
              </div>
            </div>

            <span
              className={cn(
                "mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                selected ? "border-primary bg-primary text-white" : "border-border bg-white text-transparent"
              )}
            >
              <Check className="h-3 w-3" />
            </span>
          </div>

          <div className="flex items-start gap-1.5 text-2xs font-medium text-foreground/60 md:text-xs">
            <MapPin className="mt-[2px] h-3 w-3 shrink-0 text-primary" />
            <span className="line-clamp-2 break-keep leading-[1.4]">{compactLocation(item.place.formattedAddress)}</span>
          </div>

          {item.note ? (
            <div className="flex items-start gap-1.5 text-2xs text-foreground/62 md:text-xs">
              <NotebookPen className="mt-[2px] h-3 w-3 shrink-0 text-foreground/38" />
              <p className="line-clamp-2 break-keep leading-[1.4]">{item.note}</p>
            </div>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function AddStayDialog({
  open,
  googleUrl,
  errorMessage,
  isSubmitting,
  onClose,
  onChangeUrl,
  onConfirm
}: {
  open: boolean;
  googleUrl: string;
  errorMessage: string | null;
  isSubmitting: boolean;
  onClose: () => void;
  onChangeUrl: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <DialogShell
      open={open}
      onClose={onClose}
      title="Google 링크로 숙소 추가"
      mascotVariant={null}
      busy={isSubmitting}
      showCloseButton={false}
      size="lg"
      headerClassName="bg-[linear-gradient(135deg,rgba(232,244,255,0.96),rgba(255,255,255,1)_72%)]"
      contentClassName="break-keep"
      footer={
        <>
          <Button variant="secondary" size="medium" className="break-keep" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button
            size="medium"
            className="break-keep"
            onClick={onConfirm}
            disabled={isSubmitting || !googleUrl.trim()}
          >
            {isSubmitting ? "추가 중" : "추가하고 선택"}
          </Button>
        </>
      }
    >
      <div className="space-y-2">
        <div className="space-y-2">
          <DialogFieldLabel htmlFor="stay-google-url" required className="break-keep">
            Google Maps 링크
          </DialogFieldLabel>
          <LinkInput
            id="stay-google-url"
            value={googleUrl}
            onChange={(event) => onChangeUrl(event.target.value)}
            placeholder="https://maps.app.goo.gl/..."
          />
          <DialogFieldHint error={Boolean(errorMessage)} className="break-keep">
            {errorMessage || "호텔, 레지던스, 료칸처럼 실제로 묵을 숙소 링크를 넣어 주세요"}
          </DialogFieldHint>
        </div>
      </div>
    </DialogShell>
  );
}

function MonthCalendar({
  month,
  minSelectableDate,
  startDate,
  endDate,
  onSelectDate
}: {
  month: Date;
  minSelectableDate: string;
  startDate?: string;
  endDate?: string;
  onSelectDate: (isoDate: string) => void;
}) {
  const cells = useMemo(() => buildMonthCells(month), [month]);

  return (
    <div className="space-y-3">
      <p className="text-center text-base font-black md:text-lg">{formatMonthTitle(month)}</p>
      <div className="grid grid-cols-7 text-center text-xs text-foreground/55">
        {UI_COPY.routes.new.dateStep.dayNames.map((name) => (
          <span key={name}>{name}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {cells.map((cell, index) => {
          if (!cell) {
            return <span key={`empty-${index}`} className="h-12 w-full" aria-hidden="true" />;
          }

          const isStart = Boolean(startDate && cell.iso === startDate);
          const isEnd = Boolean(endDate && cell.iso === endDate);
          const isInRange = Boolean(startDate && endDate && cell.iso > startDate && cell.iso < endDate);
          const isSingleDay = Boolean(isStart && isEnd);
          const hasRange = Boolean(startDate && endDate);
          const isDisabled = cell.iso < minSelectableDate;

          return (
            <div key={cell.iso} className="relative flex h-12 items-center justify-center">
              {isInRange ? <div className="absolute inset-x-0 inset-y-1.5 bg-primary/30" aria-hidden="true" /> : null}
              {hasRange && isStart && !isSingleDay ? (
                <div className="absolute inset-y-1.5 left-1/2 right-0 bg-primary/30" aria-hidden="true" />
              ) : null}
              {hasRange && isEnd && !isSingleDay ? (
                <div className="absolute inset-y-1.5 left-0 right-1/2 bg-primary/30" aria-hidden="true" />
              ) : null}

              <button
                type="button"
                onClick={() => onSelectDate(cell.iso)}
                disabled={isDisabled}
                className={cn(
                  "relative z-10 grid place-items-center rounded-full transition",
                  isStart || isEnd
                    ? cn("h-10 w-10 text-sm font-black shadow-surface md:h-11 md:w-11 md:text-base", buttonVariantToneClasses.primary)
                    : isDisabled
                      ? "h-9 w-9 cursor-not-allowed text-xs text-foreground/25 md:text-sm"
                      : isInRange
                        ? "h-9 w-9 text-xs font-semibold text-foreground md:text-sm"
                        : "h-9 w-9 text-xs text-foreground hover:bg-primary-soft md:text-sm"
                )}
              >
                {cell.date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function NewRoutePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  const today = useMemo(() => startOfDay(new Date()), []);
  const minSelectableDate = useMemo(() => toIsoDate(today), [today]);
  const minViewMonth = useMemo(() => startOfMonth(today), [today]);

  const [queryStep, setQueryStep] = useState<FunnelQueryStep>("list");
  const [currentStep, setCurrentStep] = useState<RenderStep>("List");
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const pushToast = useUiStore((state) => state.pushToast);
  const storeValues = useCreateScheduleStore((state) => state.values);
  const setStoreValues = useCreateScheduleStore((state) => state.setValues);
  const resetStoreValues = useCreateScheduleStore((state) => state.resetValues);
  const initialDateRange = normalizeDateRange(storeValues.startDate, storeValues.endDate, minSelectableDate);

  const [context, setContext] = useState<FunnelContext>(() => ({
    title: storeValues.title || "",
    placeListId: storeValues.placeListId || "",
    ...initialDateRange,
    stayMode: storeValues.stayMode,
    stayPlaceId: storeValues.stayPlaceId,
    companions: storeValues.companions,
    pace: storeValues.pace,
    themes: storeValues.themes
  }));

  const [viewMonthStart, setViewMonthStart] = useState(() =>
    startOfMonth(parseIsoDate(initialDateRange.startDate) || minViewMonth)
  );
  const [isAddStayModalOpen, setIsAddStayModalOpen] = useState(false);
  const [googleStayUrl, setGoogleStayUrl] = useState("");
  const [googleStayUrlError, setGoogleStayUrlError] = useState<string | null>(null);
  const [newlyAddedStayPlaceIds, setNewlyAddedStayPlaceIds] = useState<string[]>([]);
  const [isTransitioningToRecommendation, setIsTransitioningToRecommendation] = useState(false);
  const [isDateStepMustVisitBlocked, setIsDateStepMustVisitBlocked] = useState(false);
  const [isStyleStepMustVisitBlocked, setIsStyleStepMustVisitBlocked] = useState(false);

  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;

  const placeListsQuery = useQuery({
    queryKey: queryKeys.myPlaceLists,
    queryFn: () => fetchMyPlaceLists(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  const selectedListDetailQuery = useQuery({
    queryKey: queryKeys.placeListDetail(context.placeListId || "missing"),
    queryFn: () => fetchPlaceListDetail(context.placeListId || "", accessToken ?? ""),
    enabled: Boolean(accessToken && context.placeListId)
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      title: string;
      placeListId: string;
      startDate: string;
      endDate: string;
      stayPlaceId: string | null;
      companions: string | null;
      pace: string | null;
      themes: string[];
    }) =>
      createSchedule(accessToken ?? "", input),
    onMutate: () => {
      setIsTransitioningToRecommendation(true);
    },
    onSuccess: (data) => {
      resetStoreValues();
      router.push(`/routes/recommendation?scheduleId=${encodeURIComponent(data.id)}&status=success`);
    },
    onError: (error: Error) => {
      setIsTransitioningToRecommendation(false);
      console.error(error);
      const aiQuotaMessage = resolveAiScheduleQuotaMessage(error);
      if (aiQuotaMessage) {
        pushToast({ kind: "error", message: aiQuotaMessage });
        return;
      }
      if (isMustVisitLimitExceededError(error)) {
        const copy = UI_COPY.routes.new.toast.mustVisitLimitExceeded(error.details.dayCount, error.details.limit);
        setIsStyleStepMustVisitBlocked(true);
        pushToast({
          kind: "error",
          message: (
            <>
              <span>{copy.title}</span>
              <br />
              <span>{copy.description}</span>
            </>
          )
        });
        return;
      }
      pushToast({ kind: "error", message: UI_COPY.routes.new.toast.error });
      router.push("/routes/recommendation?status=error");
    }
  });

  const addStayByLinkMutation = useMutation({
    mutationFn: async (url: string) => {
      if (!context.placeListId) {
        throw new Error(UI_COPY.routes.new.toast.missingSelection);
      }

      const places = await importPlaceFromGoogleLink(accessToken ?? "", url);
      if (!places || places.length === 0) {
        throw new Error(UI_COPY.saved.detail.addPlaceNotFound);
      }

      const stayPlaces = places.filter((place) => place.categories.includes("STAY"));
      if (stayPlaces.length === 0) {
        throw new Error(UI_COPY.routes.new.toast.addedStayTypeError);
      }

      for (const place of stayPlaces) {
        await addPlaceListItem(accessToken ?? "", {
          listId: context.placeListId as string,
          placeId: place.id,
          note: null,
          isMustVisit: false
        });
      }

      return stayPlaces;
    },
    onSuccess: (places) => {
      const primaryPlace = places[0];
      selectedListDetailQuery.refetch();
      placeListsQuery.refetch();
      setNewlyAddedStayPlaceIds((current) => [...new Set([...current, ...places.map((place) => place.id)])]);
      setStoreValues({
        stayMode: "booked",
        stayPlaceId: primaryPlace?.id ?? null
      });
      setContext((current) => ({
        ...current,
        stayMode: "booked",
        stayPlaceId: primaryPlace?.id ?? null
      }));
      setGoogleStayUrl("");
      setGoogleStayUrlError(null);
      setIsAddStayModalOpen(false);
      pushToast({
        kind: "success",
        message: UI_COPY.routes.new.toast.addedStaySuccess(
          primaryPlace?.name || UI_COPY.saved.detail.placesSection.placeFallback
        )
      });
    },
    onError: (error: Error) => {
      console.error(error);
      const message =
        error.message === UI_COPY.saved.detail.addPlaceNotFound || error.message === UI_COPY.routes.new.toast.addedStayTypeError
          ? error.message
          : resolveImportErrorMessage(error, UI_COPY.routes.new.toast.addedStayError);
      setGoogleStayUrlError(message);
      pushToast({ kind: "error", message });
    }
  });

  useEffect(() => {
    const step = normalizeFunnelStep(stepParam);
    setQueryStep(step);
    setCurrentStep(mapFunnelQueryToRenderStep(step));

    if (!stepParam) {
      router.replace("/routes/new?step=list");
    }
  }, [stepParam, router]);

  useEffect(() => {
    const normalizedContextDates = normalizeDateRange(context.startDate, context.endDate, minSelectableDate);
    if (
      normalizedContextDates.startDate !== (context.startDate || "") ||
      normalizedContextDates.endDate !== (context.endDate || "")
    ) {
      setContext((current) => ({ ...current, ...normalizedContextDates }));
    }
  }, [context.startDate, context.endDate, minSelectableDate]);

  useEffect(() => {
    const normalizedStoreDates = normalizeDateRange(storeValues.startDate, storeValues.endDate, minSelectableDate);
    if (
      normalizedStoreDates.startDate !== (storeValues.startDate || "") ||
      normalizedStoreDates.endDate !== (storeValues.endDate || "")
    ) {
      setStoreValues(normalizedStoreDates);
    }
  }, [minSelectableDate, setStoreValues, storeValues.startDate, storeValues.endDate]);

  useEffect(() => {
    if (isMonthBefore(viewMonthStart, minViewMonth)) {
      setViewMonthStart(minViewMonth);
    }
  }, [minViewMonth, viewMonthStart]);

  const stayItems = useMemo(
    () => (selectedListDetailQuery.data?.items || []).filter((item) => item.place.categories.includes("STAY")),
    [selectedListDetailQuery.data?.items]
  );

  useEffect(() => {
    if (context.stayMode !== "booked") return;
    if (!context.stayPlaceId) return;
    if (stayItems.some((item) => item.place.id === context.stayPlaceId)) return;

    setStoreValues({ stayPlaceId: null });
    setContext((current) => ({ ...current, stayPlaceId: null }));
  }, [context.stayMode, context.stayPlaceId, setStoreValues, stayItems]);

  const closeAddStayModal = () => {
    if (addStayByLinkMutation.isPending) return;
    setGoogleStayUrl("");
    setGoogleStayUrlError(null);
    setIsAddStayModalOpen(false);
  };

  const handleConfirmAddStay = () => {
    const trimmedUrl = googleStayUrl.trim();
    const isValidGoogleMapsUrl = /^https?:\/\/(www\.)?(maps\.app\.goo\.gl|maps\.google\.com|goo\.gl\/maps)\//i.test(trimmedUrl);

    if (!isValidGoogleMapsUrl) {
      setGoogleStayUrlError("Google Maps 링크를 확인해 주세요");
      return;
    }

    setGoogleStayUrlError(null);
    addStayByLinkMutation.mutate(trimmedUrl);
  };

  const moveStep = (step: RenderStep, nextContext: FunnelContext = context) => {
    setContext(nextContext);
    setCurrentStep(step);
    const nextQueryStep = mapRenderToQueryStep(step);
    setQueryStep(nextQueryStep);
    router.replace(`/routes/new?step=${nextQueryStep}`);
  };

  const applySelectedList = (listId: string, title: string) => {
    const next = { ...context, placeListId: listId, title, stayMode: null, stayPlaceId: null };
    setNewlyAddedStayPlaceIds([]);
    setStoreValues({
      placeListId: listId,
      title,
      stayMode: null,
      stayPlaceId: null
    });
    setContext(next);
  };

  const clearSelectedList = () => {
    const next = { ...context, placeListId: "", title: "", stayMode: null, stayPlaceId: null };
    setNewlyAddedStayPlaceIds([]);
    setStoreValues({
      placeListId: "",
      title: "",
      stayMode: null,
      stayPlaceId: null
    });
    setContext(next);
  };

  const applyDateRange = (nextStartDate: string, nextEndDate: string) => {
    const normalizedDates = normalizeDateRange(nextStartDate, nextEndDate, minSelectableDate);
    const next = { ...context, ...normalizedDates };
    setStoreValues(normalizedDates);
    setContext(next);
  };

  const handleCalendarDateSelect = (selectedIsoDate: string) => {
    if (selectedIsoDate < minSelectableDate) {
      return;
    }

    const currentStart = context.startDate || "";
    const currentEnd = context.endDate || "";

    if (!currentStart || (currentStart && currentEnd)) {
      applyDateRange(selectedIsoDate, "");
      return;
    }

    if (selectedIsoDate < currentStart) {
      applyDateRange(selectedIsoDate, "");
      return;
    }

    const maxSelectableEndDate = addDaysToIsoDate(currentStart, MAX_SCHEDULE_DAYS - 1);
    if (maxSelectableEndDate && selectedIsoDate > maxSelectableEndDate) {
      applyDateRange(selectedIsoDate, "");
      return;
    }

    applyDateRange(currentStart, selectedIsoDate);
  };

  const lists = placeListsQuery.data || [];
  const hasLists = lists.length > 0;
  const selectedList = lists.find((list) => list.id === context.placeListId);
  const selectedListDetail = selectedListDetailQuery.data;
  const selectedDayCount = getInclusiveDayCount(context.startDate, context.endDate);
  const mustVisitCount = countSchedulableMustVisits(selectedListDetail?.items);
  const dateStepMustVisitLimit = selectedDayCount ? selectedDayCount * DATE_STEP_MUST_VISIT_PER_DAY_LIMIT : null;
  const finalMustVisitLimit = resolveFinalMustVisitLimit(selectedDayCount, context.pace);
  const isDateStepMustVisitOverflow = Boolean(dateStepMustVisitLimit && mustVisitCount > dateStepMustVisitLimit);
  const isStyleStepMustVisitOverflow = Boolean(finalMustVisitLimit && mustVisitCount > finalMustVisitLimit);

  useEffect(() => {
    setIsDateStepMustVisitBlocked(false);
  }, [context.placeListId, context.startDate, context.endDate, mustVisitCount]);

  useEffect(() => {
    setIsStyleStepMustVisitBlocked(false);
  }, [context.placeListId, context.startDate, context.endDate, context.pace, mustVisitCount]);

  const pushMustVisitLimitToast = (dayCount: number, limit: number) => {
    const copy = UI_COPY.routes.new.toast.mustVisitLimitExceeded(dayCount, limit);
    pushToast({
      kind: "error",
      message: (
        <>
          <span>{copy.title}</span>
          <br />
          <span>{copy.description}</span>
        </>
      )
    });
  };

  const isCreateFlowBusy = createMutation.isPending || isTransitioningToRecommendation;
  const hasInvalidDateRange = Boolean(
    context.startDate && context.endDate && context.endDate < context.startDate
  );
  const hasPastDateSelection = Boolean(
    (context.startDate && context.startDate < minSelectableDate) ||
      (context.endDate && context.endDate < minSelectableDate)
  );
  const hasTooLongDateRange = Boolean(selectedDayCount && selectedDayCount > MAX_SCHEDULE_DAYS);
  const hasBlockedDateSelection = hasInvalidDateRange || hasPastDateSelection || hasTooLongDateRange;
  const canViewPreviousMonth = !isSameMonth(viewMonthStart, minViewMonth);
  const dateSelectionErrorMessage = hasTooLongDateRange
    ? UI_COPY.routes.new.dateStep.maxDurationError(MAX_SCHEDULE_DAYS)
    : hasInvalidDateRange
      ? UI_COPY.routes.new.dateStep.invalidRange
      : "";

  if (isAuthLoading || !isAuthed) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.common.loading.authCheck} />
      </PageContainer>
    );
  }

  if (placeListsQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.routes.new.loading.lists} />
      </PageContainer>
    );
  }

  if (currentStep === "List" && !hasLists) {
    return (
      <PageContainer className="flex min-h-full flex-1 flex-col gap-[var(--page-section-gap)]">
        <div className="min-h-[var(--page-title-block-height)]">
          <ProgressHeader currentStep={STEP_INDEX[queryStep]} totalSteps={5} />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="-translate-y-[calc(var(--bottom-nav-offset)/2)]">
            <PageEmptyState
              mascotVariant="detective"
              mascotSize="featured"
              title={UI_COPY.routes.new.listStep.emptyTitle}
              description={UI_COPY.routes.new.listStep.emptyDescription}
              className="mx-auto"
              action={
                <Button
                  size="large"
                  shape="pill"
                  fullWidth
                  className="font-semibold md:w-auto md:min-w-48"
                  onClick={() => setIsImportModalOpen(true)}
                >
                  {UI_COPY.routes.new.listStep.addAction}
                </Button>
              }
            />
          </div>
        </div>
        <ImportListModal
          isOpen={isImportModalOpen}
          accessToken={accessToken ?? ""}
          onClose={() => setIsImportModalOpen(false)}
          onImported={(list) => {
            applySelectedList(list.id, list.name);
          }}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex min-h-full flex-1 flex-col gap-[var(--page-section-gap)]">
      <ProgressHeader currentStep={STEP_INDEX[queryStep]} totalSteps={5} />

      {currentStep === "List" ? (
        <>
          <FunnelHeader
            title={UI_COPY.routes.new.listStep.title}
            description={UI_COPY.routes.new.listStep.description}
            mascotVariant="detective"
          />

          <FunnelContent>
            <div className="grid gap-2.5">
              {lists.map((list) => {
                const active = context.placeListId === list.id;
                return (
                  <SelectableOptionCard
                    key={list.id}
                    title={`${list.name} | ${list.city}`}
                    description={UI_COPY.routes.new.listStep.listCount(list.itemCount)}
                    active={active}
                    onClick={() => {
                      if (active) {
                        clearSelectedList();
                        return;
                      }

                      applySelectedList(list.id, list.name);
                    }}
                    className="w-full"
                  />
                );
              })}
            </div>

            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="mx-auto flex w-fit break-keep text-center text-xs font-semibold text-primary underline underline-offset-4 decoration-primary/45 transition-colors hover:text-primary-hover hover:decoration-primary focus-visible:outline-hidden focus-visible:text-primary-hover md:text-sm"
              >
                {UI_COPY.routes.new.listStep.helperAction}
              </button>

              <Button size="large" fullWidth disabled={!context.placeListId} onClick={() => moveStep("Date")}>
                {UI_COPY.routes.new.listStep.next}
              </Button>
            </div>
          </FunnelContent>
        </>
      ) : null}

      {currentStep === "Date" ? (
        <>
          <FunnelHeader
            title={UI_COPY.routes.new.dateStep.title}
            description={UI_COPY.routes.new.dateStep.description}
            mascotVariant="calendar"
          />

          <FunnelContent>
            <Card className="space-y-4 p-4 md:p-5">
              <div className="flex items-center justify-between">
                <Button
                  size="small"
                  variant="ghost"
                  disabled={!canViewPreviousMonth}
                  onClick={() => {
                    if (!canViewPreviousMonth) return;
                    setViewMonthStart((prev) => addMonths(prev, -1));
                  }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <p className="text-center text-sm md:text-base lg:text-lg">
                  <span className={cn(context.startDate ? "font-black text-foreground" : "font-semibold text-foreground/24")}>
                    {formatSelectedDateLabel(context.startDate)}
                  </span>
                  <span className="px-1.5 font-semibold text-foreground/42">~</span>
                  <span className={cn(context.endDate ? "font-black text-foreground" : "font-semibold text-foreground/24")}>
                    {formatSelectedDateLabel(context.endDate)}
                  </span>
                </p>
                <Button size="small" variant="ghost" onClick={() => setViewMonthStart((prev) => addMonths(prev, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="grid gap-4 md:gap-5 lg:grid-cols-2 lg:gap-6">
                <MonthCalendar
                  month={viewMonthStart}
                  minSelectableDate={minSelectableDate}
                  startDate={context.startDate}
                  endDate={context.endDate}
                  onSelectDate={handleCalendarDateSelect}
                />
                <MonthCalendar
                  month={addMonths(viewMonthStart, 1)}
                  minSelectableDate={minSelectableDate}
                  startDate={context.startDate}
                  endDate={context.endDate}
                  onSelectDate={handleCalendarDateSelect}
                />
              </div>

              <div
                className={cn(
                  "flex items-center gap-2 rounded-lg border px-3 py-2",
                  hasBlockedDateSelection && dateSelectionErrorMessage
                    ? "border-danger/25 bg-danger/8 text-danger"
                    : "border-danger/18 bg-danger/6 text-foreground/72"
                )}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 text-danger" aria-hidden="true" />
                <p className="text-xs font-semibold leading-5">
                  {hasBlockedDateSelection && dateSelectionErrorMessage
                    ? dateSelectionErrorMessage
                    : UI_COPY.routes.new.dateStep.maxDurationHint(MAX_SCHEDULE_DAYS)}
                </p>
              </div>
            </Card>

            <div className="grid gap-2.5 md:grid-cols-2">
              <Button variant="secondary" size="large" onClick={() => moveStep("List")}>
                {UI_COPY.routes.new.dateStep.previous}
              </Button>
              <Button
                size="large"
                disabled={
                  !context.startDate ||
                  !context.endDate ||
                  hasBlockedDateSelection ||
                  (isDateStepMustVisitOverflow && isDateStepMustVisitBlocked)
                }
                onClick={() => {
                  if (isDateStepMustVisitOverflow && selectedDayCount && dateStepMustVisitLimit) {
                    setIsDateStepMustVisitBlocked(true);
                    pushMustVisitLimitToast(selectedDayCount, dateStepMustVisitLimit);
                    return;
                  }
                  moveStep("Stay");
                }}
              >
                {UI_COPY.routes.new.dateStep.next}
              </Button>
            </div>
          </FunnelContent>
        </>
      ) : null}

      {currentStep === "Stay" ? (
        <>
          <FunnelHeader
            title={UI_COPY.routes.new.stayStep.title}
            description={UI_COPY.routes.new.stayStep.description}
            mascotVariant="hotel"
          />

          <FunnelContent>
            <Card className="space-y-5 rounded-2xl border-border/75 bg-white/96 p-4 shadow-raised md:rounded-3xl md:p-5">
              <div className="grid gap-2.5 md:grid-cols-2">
                <SelectableOptionCard
                  title={UI_COPY.routes.new.stayStep.bookedOption}
                  description={UI_COPY.routes.new.stayStep.bookedOptionDescription}
                  active={context.stayMode === "booked"}
                  onClick={() => {
                    setStoreValues({ stayMode: "booked" });
                    setContext((current) => ({ ...current, stayMode: "booked" }));
                  }}
                />
                <SelectableOptionCard
                  title={UI_COPY.routes.new.stayStep.unbookedOption}
                  description={UI_COPY.routes.new.stayStep.unbookedOptionDescription}
                  active={context.stayMode === "unbooked"}
                  onClick={() => {
                    setStoreValues({ stayMode: "unbooked", stayPlaceId: null });
                    setContext((current) => ({ ...current, stayMode: "unbooked", stayPlaceId: null }));
                  }}
                />
              </div>

              {context.stayMode === "booked" ? (
                <div className="space-y-3.5 rounded-xl border border-border/75 bg-white p-4 md:rounded-2xl">
                  <div className="space-y-1">
                    <h4 className="break-keep text-sm font-black text-foreground md:text-base">{UI_COPY.routes.new.stayStep.bookedTitle}</h4>
                    <p className="break-keep text-xs leading-5 text-foreground/60 md:text-sm md:leading-6">{UI_COPY.routes.new.stayStep.bookedDescription}</p>
                  </div>

                  {selectedListDetailQuery.isLoading ? (
                    <LoadingPanel message="숙소 목록 불러오는 중" />
                  ) : stayItems.length > 0 ? (
                    <div className="space-y-2.5">
                      {stayItems.map((item) => (
                        <StayOptionCard
                          key={item.id}
                          item={item}
                          selected={context.stayPlaceId === item.place.id}
                          isNewlyAdded={newlyAddedStayPlaceIds.includes(item.place.id)}
                          onSelect={() => {
                            setStoreValues({ stayMode: "booked", stayPlaceId: item.place.id });
                            setContext((current) => ({ ...current, stayMode: "booked", stayPlaceId: item.place.id }));
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border bg-slate-50/80 px-4 py-6 text-center text-xs font-medium text-foreground/60 md:rounded-2xl md:text-sm">
                      선택할 숙소가 아직 없어요
                    </div>
                  )}

                  <div className="rounded-xl border border-dashed border-primary/35 bg-primary/6 p-4 md:rounded-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-2.5">
                      <div className="space-y-1">
                        <p className="break-keep text-sm font-black leading-tight text-foreground">
                          {UI_COPY.routes.new.stayStep.helperTitle}
                        </p>
                        <p className="break-keep text-xs leading-5 text-foreground/60">
                          {UI_COPY.routes.new.stayStep.helperDescription}
                        </p>
                      </div>
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => {
                          setGoogleStayUrl("");
                          setGoogleStayUrlError(null);
                          setIsAddStayModalOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        {UI_COPY.routes.new.stayStep.addAction}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : context.stayMode === "unbooked" ? (
                <div className="space-y-3.5 rounded-xl border border-border/75 bg-white p-4 md:rounded-2xl">
                  <div className="space-y-1">
                    <h4 className="break-keep text-sm font-black text-foreground md:text-base">{UI_COPY.routes.new.stayStep.unbookedTitle}</h4>
                    <p className="break-keep text-xs leading-5 text-foreground/60 md:text-sm md:leading-6">{UI_COPY.routes.new.stayStep.unbookedDescription}</p>
                  </div>

                  <div className="space-y-2.5">
                    {UI_COPY.routes.new.stayStep.unbookedSteps.map((item, index) => (
                      <div key={item} className="flex items-start gap-3 rounded-xl border border-border/70 bg-slate-50/80 px-4 py-3 md:rounded-2xl">
                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-white">
                          {index + 1}
                        </span>
                        <p className="break-keep text-xs leading-5 text-foreground/80 md:text-sm md:leading-6">{item}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>

            <div className="grid gap-2.5 md:grid-cols-2">
              <Button variant="secondary" size="large" onClick={() => moveStep("Date")}>
                {UI_COPY.routes.new.stayStep.previous}
              </Button>
              <Button
                size="large"
                disabled={!context.stayMode || (context.stayMode === "booked" && !context.stayPlaceId)}
                onClick={() => moveStep("Companions")}
              >
                {UI_COPY.routes.new.stayStep.next}
              </Button>
            </div>
          </FunnelContent>
        </>
      ) : null}

      {currentStep === "Companions" ? (
        <>
          <FunnelHeader
            title={UI_COPY.routes.new.companionsStep.title}
            description={UI_COPY.routes.new.companionsStep.description}
            mascotVariant="friend"
          />

          <FunnelContent>
            <Card className="mx-auto grid max-w-md gap-2 p-4 md:p-5">
              {UI_COPY.routes.new.companionsStep.options.map((item) => (
                <SelectableOptionCard
                  key={item.value}
                  icon={COMPANION_ICONS[item.value]}
                  title={item.label}
                  active={context.companions === item.value}
                  onClick={() => {
                    const next = { ...context, companions: item.value };
                    setStoreValues({ companions: item.value });
                    setContext(next);
                  }}
                />
              ))}
            </Card>
            <div className="grid gap-2.5 md:grid-cols-2">
              <Button variant="secondary" size="large" onClick={() => moveStep("Stay")}>
                {UI_COPY.routes.new.companionsStep.previous}
              </Button>
              <Button size="large" disabled={!context.companions} onClick={() => moveStep("Style")}>
                {UI_COPY.routes.new.companionsStep.next}
              </Button>
            </div>
          </FunnelContent>
        </>
      ) : null}

      {currentStep === "Style" ? (
        <>
          <FunnelHeader
            title={UI_COPY.routes.new.styleStep.title}
            description={UI_COPY.routes.new.styleStep.description}
            mascotVariant="map"
          />

          <FunnelContent>
            {isCreateFlowBusy ? (
              <LoadingPanel withMascot mascotVariant="map" message={UI_COPY.routes.new.loading.buildingSchedule} />
            ) : (
              <>
                <Card className="mx-auto max-w-4xl space-y-4 p-4 md:p-5">
                  <section className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black">{UI_COPY.routes.new.styleStep.paceLabel}</p>
                      <Badge size="compact" className="border-danger/12 bg-danger/10 text-danger">
                        {UI_COPY.routes.new.styleStep.required}
                      </Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-3 md:gap-2.5">
                      {UI_COPY.routes.new.styleStep.paceOptions.map((item) => (
                        <SelectableOptionCard
                          key={item.value}
                          icon={PACE_ICONS[item.value]}
                          title={item.label}
                          description={item.caption}
                          active={context.pace === item.value}
                          onClick={() => {
                            const next = { ...context, pace: item.value };
                            setStoreValues({ pace: item.value });
                            setContext(next);
                          }}
                        />
                      ))}
                    </div>
                  </section>
                  <section className="space-y-2 border-t border-border/70 pt-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-black">{UI_COPY.routes.new.styleStep.themeLabel}</p>
                      <Badge size="compact" className="border-border/60 bg-foreground/6 text-foreground/55">
                        {UI_COPY.routes.new.styleStep.optional}
                      </Badge>
                    </div>
                    <div className="grid gap-2 md:grid-cols-2 md:gap-2.5">
                      {UI_COPY.routes.new.styleStep.themeOptions.map((theme) => {
                        const themes = context.themes || [];
                        const active = themes.includes(theme.value);
                        return (
                          <SelectableOptionCard
                            key={theme.value}
                            icon={THEME_ICONS[theme.value]}
                            title={theme.title}
                            description={theme.subtitle}
                            active={active}
                            onClick={() => {
                              const nextThemes = active
                                ? themes.filter((value) => value !== theme.value)
                                : [...themes, theme.value];
                              const next = { ...context, themes: nextThemes };
                              setStoreValues({ themes: nextThemes });
                              setContext(next);
                            }}
                          />
                        );
                      })}
                    </div>
                  </section>
                </Card>
                <div className="grid gap-2.5 md:grid-cols-2">
                  <Button variant="secondary" size="large" onClick={() => moveStep("Companions")}>
                    {UI_COPY.routes.new.styleStep.previous}
                  </Button>
                  <Button
                    size="large"
                    disabled={
                      isCreateFlowBusy ||
                      !context.pace ||
                      !context.placeListId ||
                      !context.startDate ||
                      !context.endDate ||
                      hasBlockedDateSelection ||
                      (isStyleStepMustVisitOverflow && isStyleStepMustVisitBlocked)
                    }
                    onClick={() => {
                      if (!context.placeListId || !context.startDate || !context.endDate || hasBlockedDateSelection) {
                        pushToast({ kind: "error", message: UI_COPY.routes.new.toast.missingSelection });
                        return;
                      }
                      if (isStyleStepMustVisitOverflow && selectedDayCount && finalMustVisitLimit) {
                        setIsStyleStepMustVisitBlocked(true);
                        pushMustVisitLimitToast(selectedDayCount, finalMustVisitLimit);
                        return;
                      }
                      createMutation.mutate({
                        title: context.title || selectedList?.name || UI_COPY.routes.new.titleFallback,
                        placeListId: context.placeListId,
                        startDate: context.startDate,
                        endDate: context.endDate,
                        stayPlaceId: context.stayMode === "booked" ? context.stayPlaceId ?? null : null,
                        companions: context.companions ?? null,
                        pace: context.pace ?? null,
                        themes: context.themes || []
                      });
                    }}
                  >
                    {UI_COPY.routes.new.styleStep.submit}
                  </Button>
                </div>
                <p className="text-center text-xs font-medium text-foreground/58">
                  {UI_COPY.routes.new.styleStep.aiQuotaHint}
                </p>
              </>
            )}
          </FunnelContent>
        </>
      ) : null}

      <ImportListModal
        isOpen={isImportModalOpen}
        accessToken={accessToken ?? ""}
        onClose={() => setIsImportModalOpen(false)}
        onImported={(list) => {
          applySelectedList(list.id, list.name);
          pushToast({ kind: "info", message: UI_COPY.routes.new.toast.importedListSelected(list.name) });
        }}
      />

      <AddStayDialog
        open={isAddStayModalOpen}
        googleUrl={googleStayUrl}
        errorMessage={googleStayUrlError}
        isSubmitting={addStayByLinkMutation.isPending}
        onClose={closeAddStayModal}
        onChangeUrl={(value) => {
          setGoogleStayUrl(value);
          if (googleStayUrlError) {
            setGoogleStayUrlError(null);
          }
        }}
        onConfirm={handleConfirmAddStay}
      />
    </PageContainer>
  );
}
