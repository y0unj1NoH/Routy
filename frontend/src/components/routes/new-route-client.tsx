"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Compass,
  Handshake,
  Heart,
  Home,
  Landmark,
  Leaf,
  PartyPopper,
  ShoppingBag,
  TreePine,
  type LucideIcon,
  UserRound,
  UtensilsCrossed,
  Zap
} from "lucide-react";

import { LoadingPanel } from "@/components/common/loading-panel";
import { PageEmptyState } from "@/components/common/page-empty-state";
import { ImportListModal } from "@/components/import/import-list-modal";
import { UI_COPY } from "@/constants/ui-copy";
import { type ThemeValue } from "@/constants/route-taxonomy";
import { Mascot, MASCOT_SIZE_CLASS, type MascotVariant } from "@/components/layout/mascot";
import { PageContainer } from "@/components/layout/page-container";
import { ProgressHeader } from "@/components/layout/progress-header";
import { Button } from "@/components/ui/button";
import { buttonVariantToneClasses } from "@/components/ui/button-styles";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { createSchedule, fetchMyPlaceLists } from "@/lib/graphql/api";
import { queryKeys } from "@/lib/query-keys";
import {
  mapFunnelQueryToRenderStep,
  mapRenderToQueryStep,
  normalizeFunnelStep,
  type FunnelQueryStep
} from "@/constants/funnel";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useCreateScheduleStore } from "@/stores/create-schedule-store";
import { useUiStore } from "@/stores/ui-store";

type FunnelContext = {
  title?: string;
  placeListId?: string;
  startDate?: string;
  endDate?: string;
  companions?: string | null;
  pace?: string | null;
  themes?: string[];
};

type RenderStep = "List" | "Date" | "Companions" | "Style";

const STEP_INDEX: Record<FunnelQueryStep, number> = {
  list: 1,
  date: 2,
  companions: 3,
  style: 4
};
const MAX_SCHEDULE_DAYS = 7;

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

function StepTitle({
  title,
  description,
  emoji,
  mascotVariant,
  mascotClassName,
  action
}: {
  title: string;
  description?: string;
  emoji?: string;
  mascotVariant?: MascotVariant;
  mascotClassName?: string;
  action?: ReactNode;
}) {
  return (
    <div className="space-y-3 text-center">
      {mascotVariant ? (
        <Mascot variant={mascotVariant} className={cn("mx-auto", MASCOT_SIZE_CLASS.compact, mascotClassName)} />
      ) : (
        <div className="mx-auto grid h-28 w-28 place-items-center rounded-full border border-border-strong bg-card/92 text-4xl text-primary shadow-soft">
          {emoji}
        </div>
      )}
      <h1 className="text-2xl font-black md:text-4xl">{title}</h1>
      {description ? <p className="text-sm text-foreground/65">{description}</p> : null}
      {action ? <div className="flex justify-center pt-2">{action}</div> : null}
    </div>
  );
}

function ChoiceButton({
  icon: Icon,
  label,
  caption,
  contentAlignment = "start",
  active,
  onClick,
  className,
  iconClassName,
  labelClassName,
  captionClassName
}: {
  icon?: LucideIcon;
  label: string;
  caption?: string;
  contentAlignment?: "start" | "center";
  active: boolean;
  onClick: () => void;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
  captionClassName?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "group rounded-xl border px-4 py-3.5 text-left transition-[background-color,border-color,box-shadow] focus-visible:outline-hidden focus-visible:ring-4 focus-visible:ring-primary/12",
        active
          ? "border-primary bg-primary/15 text-primary shadow-[0_14px_32px_rgba(60,157,255,0.12)]"
          : "border-border bg-card text-foreground hover:border-primary/30 hover:bg-muted/60",
        className
      )}
    >
      <div className={cn("flex gap-3", contentAlignment === "center" ? "items-center" : "items-start")}>
        {Icon ? (
          <span
            className={cn(
              "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors",
              active
                ? "border-primary/18 bg-primary/12 text-primary"
                : "border-border/70 bg-muted/35 text-foreground/62 group-hover:bg-muted/55",
              iconClassName
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        ) : null}
        <div className={cn("min-w-0", contentAlignment === "center" && !caption ? "flex min-h-10 items-center" : "")}>
          <p className={cn("text-sm font-semibold leading-snug", labelClassName)}>{label}</p>
          {caption ? (
            <p className={cn("mt-1.5 break-keep text-xs leading-relaxed text-foreground/60", captionClassName)}>{caption}</p>
          ) : null}
        </div>
      </div>
    </button>
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
      <p className="text-center text-lg font-black">{formatMonthTitle(month)}</p>
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
                    ? cn("h-11 w-11 text-base font-black shadow-soft", buttonVariantToneClasses.primary)
                    : isDisabled
                      ? "h-9 w-9 cursor-not-allowed text-sm text-foreground/25"
                      : isInRange
                        ? "h-9 w-9 text-sm font-semibold text-foreground"
                        : "h-9 w-9 text-sm text-foreground hover:bg-primary-soft"
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
    companions: storeValues.companions,
    pace: storeValues.pace,
    themes: storeValues.themes
  }));

  const [viewMonthStart, setViewMonthStart] = useState(() =>
    startOfMonth(parseIsoDate(initialDateRange.startDate) || minViewMonth)
  );

  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;

  const placeListsQuery = useQuery({
    queryKey: queryKeys.myPlaceLists,
    queryFn: () => fetchMyPlaceLists(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  const createMutation = useMutation({
    mutationFn: (input: {
      title: string;
      placeListId: string;
      startDate: string;
      endDate: string;
      companions: string | null;
      pace: string | null;
      themes: string[];
    }) =>
      createSchedule(accessToken ?? "", {
        ...input,
        stayPlaceId: null
      }),
    onSuccess: (data) => {
      pushToast({ kind: "success", message: UI_COPY.routes.new.toast.success });
      resetStoreValues();
      router.push(`/routes/recommendation?scheduleId=${encodeURIComponent(data.id)}&status=success`);
    },
    onError: (error: Error) => {
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.routes.new.toast.error });
      router.push("/routes/recommendation?status=error");
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

  const moveStep = (step: RenderStep, nextContext: FunnelContext = context) => {
    setContext(nextContext);
    setCurrentStep(step);
    const nextQueryStep = mapRenderToQueryStep(step);
    setQueryStep(nextQueryStep);
    router.replace(`/routes/new?step=${nextQueryStep}`);
  };

  const applySelectedList = (listId: string, title: string) => {
    const next = { ...context, placeListId: listId, title };
    setStoreValues({
      placeListId: listId,
      title
    });
    setContext(next);
  };

  const clearSelectedList = () => {
    const next = { ...context, placeListId: "", title: "" };
    setStoreValues({
      placeListId: "",
      title: ""
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

  const selectedDayCount = getInclusiveDayCount(context.startDate, context.endDate);
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

  const lists = placeListsQuery.data || [];
  const hasLists = lists.length > 0;
  const selectedList = lists.find((list) => list.id === context.placeListId);

  return (
    <PageContainer className="space-y-8">
      <ProgressHeader currentStep={STEP_INDEX[queryStep]} totalSteps={4} />

      {currentStep === "List" ? (
        <section
          className={cn(
            "mx-auto w-full max-w-[1194px]",
            hasLists ? "space-y-8" : "flex min-h-[calc(100dvh-var(--bottom-nav-offset)-12rem)] flex-col gap-8"
          )}
        >
          <StepTitle
            title={UI_COPY.routes.new.listStep.title}
            description={UI_COPY.routes.new.listStep.description}
            mascotVariant="detective"
          />

          {!hasLists ? (
            <div className="flex flex-1 items-center justify-center">
              <PageEmptyState
                title={UI_COPY.routes.new.listStep.emptyTitle}
                description={UI_COPY.routes.new.listStep.emptyDescription}
                showMascot={false}
                className="mx-auto -translate-y-[calc(var(--bottom-nav-offset)/4)]"
                action={
                  <Button
                    shape="pill"
                    className="h-12 min-w-56 px-6 font-semibold"
                    onClick={() => setIsImportModalOpen(true)}
                  >
                    {UI_COPY.routes.new.listStep.addAction}
                  </Button>
                }
              />
            </div>
          ) : (
            <>
              <div className="grid gap-3">
                {lists.map((list) => {
                  const active = context.placeListId === list.id;
                  return (
                    <button
                      key={list.id}
                      type="button"
                      onClick={() => {
                        if (active) {
                          clearSelectedList();
                          return;
                        }

                        applySelectedList(list.id, list.name);
                      }}
                      className={`rounded-xl border p-4 text-left ${
                        active ? "border-primary bg-primary/10" : "border-border bg-card"
                      }`}
                    >
                      <p className="font-bold">
                        {list.name} | {list.city}
                      </p>
                      <p className="mt-1 text-sm text-foreground/70">{UI_COPY.routes.new.listStep.listCount(list.itemCount)}</p>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setIsImportModalOpen(true)}
                className="mx-auto flex w-fit text-center text-sm font-semibold text-primary underline underline-offset-4 decoration-primary/45 transition-colors hover:text-primary-hover hover:decoration-primary focus-visible:outline-hidden focus-visible:text-primary-hover"
              >
                {UI_COPY.routes.new.listStep.helperAction}
              </button>

              <Button size="lg" fullWidth disabled={!context.placeListId} onClick={() => moveStep("Date")}>
                {UI_COPY.routes.new.listStep.next}
              </Button>
            </>
          )}
        </section>
      ) : null}

      {currentStep === "Date" ? (
        <section className="mx-auto w-full max-w-[1194px] space-y-8">
          <StepTitle
            title={UI_COPY.routes.new.dateStep.title}
            description={UI_COPY.routes.new.dateStep.description}
            mascotVariant="calendar"
          />
          <Card className="space-y-5 p-5">
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="ghost"
                disabled={!canViewPreviousMonth}
                onClick={() => {
                  if (!canViewPreviousMonth) return;
                  setViewMonthStart((prev) => addMonths(prev, -1));
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <p className="text-center text-base md:text-xl">
                <span className={cn(context.startDate ? "font-black text-foreground" : "font-semibold text-foreground/24")}>
                  {formatSelectedDateLabel(context.startDate)}
                </span>
                <span className="px-1.5 font-semibold text-foreground/42">~</span>
                <span className={cn(context.endDate ? "font-black text-foreground" : "font-semibold text-foreground/24")}>
                  {formatSelectedDateLabel(context.endDate)}
                </span>
              </p>
              <Button size="sm" variant="ghost" onClick={() => setViewMonthStart((prev) => addMonths(prev, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
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
          <div className="grid gap-3 md:grid-cols-2">
            <Button variant="secondary" size="lg" onClick={() => moveStep("List")}>
              {UI_COPY.routes.new.dateStep.previous}
            </Button>
            <Button
              size="lg"
              disabled={!context.startDate || !context.endDate || hasBlockedDateSelection}
              onClick={() => moveStep("Companions")}
            >
              {UI_COPY.routes.new.dateStep.next}
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === "Companions" ? (
        <section className="mx-auto w-full max-w-[1194px] space-y-8">
          <StepTitle
            title={UI_COPY.routes.new.companionsStep.title}
            description={UI_COPY.routes.new.companionsStep.description}
            mascotVariant="friend"
            mascotClassName="h-28 w-40 sm:h-32 sm:w-44"
          />
          <Card className="mx-auto grid max-w-md gap-3 p-5">
            {UI_COPY.routes.new.companionsStep.options.map((item) => (
              <ChoiceButton
                key={item.value}
                icon={COMPANION_ICONS[item.value]}
                label={item.label}
                contentAlignment="center"
                active={context.companions === item.value}
                onClick={() => {
                  const next = { ...context, companions: item.value };
                  setStoreValues({ companions: item.value });
                  setContext(next);
                }}
              />
            ))}
          </Card>
          <div className="grid gap-3 md:grid-cols-2">
            <Button variant="secondary" size="lg" onClick={() => moveStep("Date")}>
              {UI_COPY.routes.new.companionsStep.previous}
            </Button>
            <Button size="lg" disabled={!context.companions} onClick={() => moveStep("Style")}>
              {UI_COPY.routes.new.companionsStep.next}
            </Button>
          </div>
        </section>
      ) : null}

      {currentStep === "Style" ? (
        <section className="mx-auto w-full max-w-[1194px] space-y-8">
          <StepTitle
            title={UI_COPY.routes.new.styleStep.title}
            description={UI_COPY.routes.new.styleStep.description}
            mascotVariant="map"
          />

          {createMutation.isPending ? (
            <LoadingPanel withMascot mascotVariant="map" message={UI_COPY.routes.new.loading.buildingSchedule} />
          ) : (
            <>
              <Card className="mx-auto max-w-4xl space-y-5 p-4 md:p-5">
                <section className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-black">{UI_COPY.routes.new.styleStep.paceLabel}</p>
                    <span className="inline-flex rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-danger">
                      {UI_COPY.routes.new.styleStep.required}
                    </span>
                  </div>
                  <div className="grid gap-2.5 sm:grid-cols-3">
                    {UI_COPY.routes.new.styleStep.paceOptions.map((item) => (
                      <ChoiceButton
                        key={item.value}
                        icon={PACE_ICONS[item.value]}
                        label={item.label}
                        caption={item.caption}
                        contentAlignment="center"
                        className="min-h-[98px] px-3 py-2.5 md:px-3.5"
                        iconClassName="h-10 w-10 rounded-2xl"
                        labelClassName="text-[15px] font-bold"
                        captionClassName="text-[12px] leading-5"
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
                <section className="space-y-3 border-t border-border/70 pt-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-black">{UI_COPY.routes.new.styleStep.themeLabel}</p>
                    <span className="inline-flex rounded-full bg-foreground/6 px-2.5 py-1 text-[11px] font-semibold tracking-[0.02em] text-foreground/55">
                      {UI_COPY.routes.new.styleStep.optional}
                    </span>
                  </div>
                  <div className="grid gap-2.5 md:grid-cols-2">
                    {UI_COPY.routes.new.styleStep.themeOptions.map((theme) => {
                      const themes = context.themes || [];
                      const active = themes.includes(theme.value);
                      return (
                        <ChoiceButton
                          key={theme.value}
                          icon={THEME_ICONS[theme.value]}
                          label={theme.title}
                          caption={theme.subtitle}
                          className="min-h-[98px] px-3 py-2.5 md:px-3.5"
                          iconClassName="h-10 w-10 rounded-2xl"
                          labelClassName="text-[15px] font-bold"
                          captionClassName="text-[12px] leading-5"
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
              <div className="grid gap-3 md:grid-cols-2">
                <Button variant="secondary" size="lg" onClick={() => moveStep("Companions")}>
                  {UI_COPY.routes.new.styleStep.previous}
                </Button>
                <Button
                  size="lg"
                  disabled={
                    createMutation.isPending ||
                    !context.pace ||
                    !context.placeListId ||
                    !context.startDate ||
                    !context.endDate ||
                    hasBlockedDateSelection
                  }
                  onClick={() => {
                    if (!context.placeListId || !context.startDate || !context.endDate || hasBlockedDateSelection) {
                      pushToast({ kind: "error", message: UI_COPY.routes.new.toast.missingSelection });
                      return;
                    }
                    createMutation.mutate({
                      title: context.title || selectedList?.name || UI_COPY.routes.new.titleFallback,
                      placeListId: context.placeListId,
                      startDate: context.startDate,
                      endDate: context.endDate,
                      companions: context.companions ?? null,
                      pace: context.pace ?? null,
                      themes: context.themes || []
                    });
                  }}
                >
                  {UI_COPY.routes.new.styleStep.submit}
                </Button>
              </div>
            </>
          )}
        </section>
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
    </PageContainer>
  );
}
