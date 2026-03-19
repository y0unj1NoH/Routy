"use client";

import { startTransition, useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  AlertTriangle,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  ListTree,
  LogOut,
  Mail,
  MapPinned,
  Sparkles,
  UserCircle2
} from "lucide-react";

import { PreferenceBadgeChip } from "@/components/common/preference-badge-chip";
import { DialogFieldHint, DialogFieldLabel } from "@/components/common/dialog-field";
import { DialogShell } from "@/components/common/dialog-shell";
import { EmptyState } from "@/components/common/empty-state";
import { ListItemCard } from "@/components/common/list-item-card";
import { LoadingPanel } from "@/components/common/loading-panel";
import { NextTripCard } from "@/components/common/next-trip-card";
import { PageTitle } from "@/components/common/page-title";
import { SectionHeader } from "@/components/common/section-header";
import { UI_COPY } from "@/constants/ui-copy";
import { Mascot, MASCOT_SIZE_CLASS } from "@/components/layout/mascot";
import { PageContainer } from "@/components/layout/page-container";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRequireAuth } from "@/hooks/use-require-auth";
import type { BadgeIconName } from "@/lib/badge-theme";
import { COMPANION_BADGE_MAP, PACE_BADGE_MAP, THEME_BADGE_MAP } from "@/lib/badge-theme";
import { BADGE_HEIGHT_CLASS, BADGE_TEXT_CLASS } from "@/lib/badge-size";
import { cn } from "@/lib/cn";
import { safeZodResolver } from "@/lib/forms/safe-zod-resolver";
import { deleteMyAccount, fetchMyPlaceLists, fetchMySchedules } from "@/lib/graphql/api";
import { formatDateRange, formatRelativeTripLabel } from "@/lib/format";
import { queryKeys } from "@/lib/query-keys";
import {
  doesScheduleOverlapDate,
  doesScheduleOverlapMonth,
  getScheduleStatus,
  isSameDay,
  sortSchedulesForCalendar,
  sortPastSchedulesByRecentEnd,
  sortSchedulesForHome,
  type ScheduleStatus
} from "@/lib/schedule-status";
import { clearSupabaseBrowserAuthStorage, getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { useUiStore } from "@/stores/ui-store";
import type { Schedule } from "@/types/domain";

const WEEKDAY_LABELS = UI_COPY.mypage.weekdayLabels;
const INTEGER_FORMATTER = new Intl.NumberFormat("ko-KR");

type PreferenceBadgeItem = {
  id: string;
  label: string;
  bg: string;
  text: string;
  icon: BadgeIconName;
};

type SummaryTone = "blue" | "amber" | "mint" | "yellow";

type CompanionKey = keyof typeof COMPANION_BADGE_MAP;
type PaceKey = keyof typeof PACE_BADGE_MAP;
type ThemeKey = keyof typeof THEME_BADGE_MAP;
type DeleteAccountFormValues = {
  email: string;
};

function createDeleteAccountSchema(expectedEmail: string) {
  const normalizedExpectedEmail = expectedEmail.trim().toLowerCase();

  return z.object({
    email: z
      .string()
      .trim()
      .min(1, UI_COPY.mypage.deleteAccount.emailPrompt)
      .email(UI_COPY.common.form.validEmail)
      .refine((value) => !normalizedExpectedEmail || value.toLowerCase() === normalizedExpectedEmail, {
        message: UI_COPY.mypage.deleteAccount.emailMismatch
      })
  });
}

const COMPANION_META: Record<CompanionKey, PreferenceBadgeItem> = {
  SOLO: {
    id: "companion-solo",
    ...COMPANION_BADGE_MAP.SOLO
  },
  FRIENDS: {
    id: "companion-friends",
    ...COMPANION_BADGE_MAP.FRIENDS
  },
  COUPLE: {
    id: "companion-couple",
    ...COMPANION_BADGE_MAP.COUPLE
  },
  FAMILY: {
    id: "companion-family",
    ...COMPANION_BADGE_MAP.FAMILY
  },
  GROUP: {
    id: "companion-group",
    ...COMPANION_BADGE_MAP.GROUP
  }
};

const PACE_META: Record<PaceKey, PreferenceBadgeItem> = {
  INTENSE: {
    id: "pace-intense",
    ...PACE_BADGE_MAP.INTENSE
  },
  MODERATE: {
    id: "pace-moderate",
    ...PACE_BADGE_MAP.MODERATE
  },
  RELAXED: {
    id: "pace-relaxed",
    ...PACE_BADGE_MAP.RELAXED
  }
};

const THEME_META: Record<ThemeKey, PreferenceBadgeItem> = {
  FOODIE: {
    id: "theme-foodie",
    label: THEME_BADGE_MAP.FOODIE.shortLabel,
    bg: THEME_BADGE_MAP.FOODIE.bg,
    text: THEME_BADGE_MAP.FOODIE.text,
    icon: THEME_BADGE_MAP.FOODIE.icon
  },
  LANDMARK: {
    id: "theme-landmark",
    label: THEME_BADGE_MAP.LANDMARK.shortLabel,
    bg: THEME_BADGE_MAP.LANDMARK.bg,
    text: THEME_BADGE_MAP.LANDMARK.text,
    icon: THEME_BADGE_MAP.LANDMARK.icon
  },
  SHOPPING: {
    id: "theme-shopping",
    label: THEME_BADGE_MAP.SHOPPING.shortLabel,
    bg: THEME_BADGE_MAP.SHOPPING.bg,
    text: THEME_BADGE_MAP.SHOPPING.text,
    icon: THEME_BADGE_MAP.SHOPPING.icon
  },
  NATURE: {
    id: "theme-nature",
    label: THEME_BADGE_MAP.NATURE.shortLabel,
    bg: THEME_BADGE_MAP.NATURE.bg,
    text: THEME_BADGE_MAP.NATURE.text,
    icon: THEME_BADGE_MAP.NATURE.icon
  }
};

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function formatMonthTitle(date: Date) {
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long"
  }).format(date);
}

function buildMonthCells(monthDate: Date) {
  const firstDay = startOfMonth(monthDate);
  const firstWeekday = firstDay.getDay();
  const totalDays = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push(null);
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }

  while (cells.length % 7 !== 0) {
    cells.push(null);
  }

  return cells;
}

function getMostFrequentKey<Key extends string>(values: Array<string | null | undefined>, allowedKeys: Record<Key, unknown>) {
  const counts = new Map<Key, number>();

  for (const value of values) {
    if (!value || !(value in allowedKeys)) continue;
    const typedValue = value as Key;
    counts.set(typedValue, (counts.get(typedValue) || 0) + 1);
  }

  let winner: Key | null = null;
  let maxCount = 0;

  for (const [value, count] of counts.entries()) {
    if (count > maxCount) {
      winner = value;
      maxCount = count;
    }
  }

  return winner;
}

function getTopThemeKeys(schedules: Schedule[], limit = 2) {
  const counts = new Map<ThemeKey, number>();

  for (const schedule of schedules) {
    for (const theme of schedule.themes || []) {
      if (!theme || !(theme in THEME_META)) continue;
      const typedTheme = theme as ThemeKey;
      counts.set(typedTheme, (counts.get(typedTheme) || 0) + 1);
    }
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function buildPreferenceBadges(schedules: Schedule[]) {
  const companion = getMostFrequentKey(
    schedules.map((schedule) => schedule.companions),
    COMPANION_META
  );
  const pace = getMostFrequentKey(
    schedules.map((schedule) => schedule.pace),
    PACE_META
  );
  const themes = getTopThemeKeys(schedules);

  const items: PreferenceBadgeItem[] = [];

  if (companion) items.push(COMPANION_META[companion]);
  if (pace) items.push(PACE_META[pace]);
  items.push(...themes.map((theme) => THEME_META[theme]));

  return items;
}

function getSegmentTone(status: ScheduleStatus) {
  if (status === "ongoing") {
    return "bg-success text-white";
  }

  if (status === "past") {
    return "bg-foreground/12 text-foreground/75";
  }

  return "bg-primary text-white";
}

function formatMetricValue(value: number) {
  return INTEGER_FORMATTER.format(value);
}

function getSummaryToneClasses(tone: SummaryTone) {
  switch (tone) {
    case "amber":
      return {
        card: "border-[#f4debf]",
        accent: "bg-[#efc46d]",
        icon: "text-[#dfa44d]"
      };
    case "mint":
      return {
        card: "border-[#d3e8d9]",
        accent: "bg-[#6bc89b]",
        icon: "text-[#45b27e]"
      };
    case "yellow":
      return {
        card: "border-[#f1e2a4]",
        accent: "bg-[#f1cc52]",
        icon: "text-[#e1bb3a]"
      };
    case "blue":
    default:
      return {
        card: "border-[#cfe6fb]",
        accent: "bg-[#7cc7ff]",
        icon: "text-[#58b7f6]"
      };
  }
}

function SummaryMetricCard({
  icon: Icon,
  label,
  value,
  tone
}: {
  icon: typeof CalendarRange;
  label: string;
  value: string;
  tone: SummaryTone;
}) {
  const toneClasses = getSummaryToneClasses(tone);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] border bg-white/90 px-4 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.78)] md:rounded-[22px] md:px-4 md:py-4",
        toneClasses.card
      )}
    >
      <div className={cn("absolute left-3 right-3 top-0 h-[2.5px] rounded-full opacity-95 md:left-4 md:right-4", toneClasses.accent)} />
      <div className="flex h-full flex-col justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <Icon className={cn("h-4 w-4 shrink-0 md:h-[18px] md:w-[18px]", toneClasses.icon)} />
          <p className="font-black leading-none tracking-[-0.06em] text-foreground" style={{ fontSize: "var(--page-empty-title-size)" }}>{value}</p>
        </div>
        <p className="text-[11px] leading-[1.3] tracking-[-0.01em] text-foreground/56 md:text-xs">{label}</p>
      </div>
    </div>
  );
}

function PreferenceChip({ bg, icon, label, text }: PreferenceBadgeItem) {
  return <PreferenceBadgeChip bg={bg} icon={icon} label={label} text={text} />;
}

export default function MyPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const pushToast = useUiStore((state) => state.pushToast);
  const [monthOffset, setMonthOffset] = useState(0);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [isAuthRedirectPaused, setIsAuthRedirectPaused] = useState(false);
  const [isDeleteAccountDialogOpen, setIsDeleteAccountDialogOpen] = useState(false);
  const deleteAccountFormId = useId();
  const deleteAccountEmailFieldId = `${deleteAccountFormId}-email`;
  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth({
    redirectUnauthed: !isAuthRedirectPaused
  });
  const accessToken = session?.access_token;
  const deleteAccountEmail = session?.user?.email?.trim() || "";
  const deleteAccountFormSchema = useMemo(() => createDeleteAccountSchema(deleteAccountEmail), [deleteAccountEmail]);
  const deleteAccountForm = useForm<DeleteAccountFormValues>({
    resolver: safeZodResolver(deleteAccountFormSchema),
    mode: "onBlur",
    reValidateMode: "onChange",
    defaultValues: {
      email: ""
    }
  });
  const deleteAccountEmailInput = deleteAccountForm.watch("email");

  useEffect(() => {
    void router.prefetch("/login");
  }, [router]);

  const schedulesQuery = useQuery({
    queryKey: queryKeys.mySchedules,
    queryFn: () => fetchMySchedules(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  const placeListsQuery = useQuery({
    queryKey: queryKeys.myPlaceLists,
    queryFn: () => fetchMyPlaceLists(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  const providerLabel = useMemo(() => {
    const provider = session?.user?.app_metadata?.provider;
    if (provider === "google") return "Google";
    if (provider === "email") return "Email";
    return provider || "-";
  }, [session?.user?.app_metadata?.provider]);

  const schedules = useMemo(() => [...(schedulesQuery.data || [])].sort(sortSchedulesForHome), [schedulesQuery.data]);
  const placeLists = placeListsQuery.data || [];

  const upcomingAndOngoingSchedules = useMemo(
    () => schedules.filter((schedule) => getScheduleStatus(schedule.startDate, schedule.endDate) !== "past"),
    [schedules]
  );

  const pastSchedules = useMemo(
    () =>
      schedules
        .filter((schedule) => getScheduleStatus(schedule.startDate, schedule.endDate) === "past")
        .sort(sortPastSchedulesByRecentEnd),
    [schedules]
  );

  const nextSchedule = upcomingAndOngoingSchedules[0] || null;
  const totalScheduleCount = schedules.length;
  const upcomingScheduleCount = upcomingAndOngoingSchedules.length;
  const totalSavedPlaces = placeLists.reduce((sum, list) => sum + list.itemCount, 0);
  const preferenceBadges = buildPreferenceBadges(schedules);
  const isDeleteAccountEmailMatched =
    deleteAccountEmailInput.trim().toLowerCase() === deleteAccountEmail.toLowerCase() && deleteAccountEmail.length > 0;

  const visibleMonth = useMemo(() => addMonths(startOfMonth(new Date()), monthOffset), [monthOffset]);
  const monthCells = useMemo(() => buildMonthCells(visibleMonth), [visibleMonth]);
  const visibleMonthSchedules = useMemo(
    () =>
      schedules
        .filter((schedule) => doesScheduleOverlapMonth(schedule, visibleMonth))
        .sort(sortSchedulesForCalendar),
    [schedules, visibleMonth]
  );

  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteMyAccount(accessToken ?? ""),
    onSuccess: async () => {
      setIsAuthRedirectPaused(true);

      try {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.signOut({ scope: "local" });
        if (error) {
          throw error;
        }
      } catch {
        // Local session cleanup is best-effort after the account is already deleted.
      } finally {
        clearSupabaseBrowserAuthStorage();
      }

      await queryClient.cancelQueries();
      queryClient.clear();
      deleteAccountForm.reset();
      setIsDeleteAccountDialogOpen(false);
      pushToast({ kind: "success", message: UI_COPY.mypage.deleteAccount.success });
      router.replace("/login");
    },
    onError: (error: Error) => {
      setIsAuthRedirectPaused(false);
      console.error(error);
      pushToast({ kind: "error", message: UI_COPY.mypage.deleteAccount.error });
    }
  });

  const closeDeleteAccountDialog = () => {
    if (deleteAccountMutation.isPending) return;
    deleteAccountMutation.reset();
    deleteAccountForm.reset();
    setIsDeleteAccountDialogOpen(false);
  };

  const handleSignOut = async () => {
    if (isSigningOut) return;

    setIsAuthRedirectPaused(true);
    setIsSigningOut(true);

    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) {
        throw error;
      }
      clearSupabaseBrowserAuthStorage();
      queryClient.clear();
      pushToast({ kind: "success", message: UI_COPY.mypage.logout.success });
      startTransition(() => {
        router.replace("/login");
      });
    } catch (error) {
      console.error(error);
      const message = UI_COPY.mypage.logout.error;
      pushToast({ kind: "error", message });
      setIsAuthRedirectPaused(false);
      setIsSigningOut(false);
    }
  };

  if (isSigningOut) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.mypage.logout.loading} />
      </PageContainer>
    );
  }

  if (isAuthLoading || !isAuthed) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.mypage.loading.page} />
      </PageContainer>
    );
  }

  if (schedulesQuery.isLoading || placeListsQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.mypage.loading.history} />
      </PageContainer>
    );
  }

  if (schedulesQuery.isError || placeListsQuery.isError) {
    return (
      <PageContainer>
        <EmptyState title={UI_COPY.mypage.error.title} description={UI_COPY.mypage.error.description} mascotVariant="surprise" />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="space-y-[var(--page-section-gap)] pb-[calc(var(--bottom-nav-offset)+var(--page-bottom-padding))]">
      <section className="flex items-start justify-between gap-4">
        <PageTitle title={UI_COPY.mypage.title} className="min-w-0" />
        <Mascot variant="map" className={cn(MASCOT_SIZE_CLASS.compactAside, "shrink-0")} />
      </section>

      {nextSchedule ? (
        <NextTripCard
          href={`/routes/${nextSchedule.id}`}
          eyebrow={UI_COPY.mypage.nextTripEyebrow}
          title={nextSchedule.title}
          description={`${nextSchedule.placeList.city} · ${formatDateRange(nextSchedule.startDate, nextSchedule.endDate)}`}
          statusLabel={formatRelativeTripLabel(nextSchedule.startDate, nextSchedule.endDate)}
        />
      ) : null}

      <Card className="overflow-hidden rounded-[28px] border-primary-light/25 bg-[radial-gradient(circle_at_top_left,rgba(124,199,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(255,235,163,0.18),transparent_30%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,255,0.96))] p-3 shadow-[0_18px_40px_rgba(15,23,42,0.05)] md:rounded-[30px] md:p-3.5">
        <div className="grid grid-cols-2 gap-2.5 md:gap-3">
          <SummaryMetricCard
            icon={CalendarRange}
            tone="blue"
            label={UI_COPY.mypage.summaryCards.totalSchedules.label}
            value={formatMetricValue(totalScheduleCount)}
          />
          <SummaryMetricCard
            icon={Sparkles}
            tone="amber"
            label={UI_COPY.mypage.summaryCards.upcomingSchedules.label}
            value={formatMetricValue(upcomingScheduleCount)}
          />
          <SummaryMetricCard
            icon={ListTree}
            tone="mint"
            label={UI_COPY.mypage.summaryCards.savedLists.label}
            value={formatMetricValue(placeLists.length)}
          />
          <SummaryMetricCard
            icon={MapPinned}
            tone="yellow"
            label={UI_COPY.mypage.summaryCards.savedPlaces.label}
            value={formatMetricValue(totalSavedPlaces)}
          />
        </div>
      </Card>

      <Card className="space-y-5 p-4 md:p-5">
        <div className="space-y-2.5">
          <div className="flex items-start justify-between gap-3">
            <h2
              className="inline-flex min-w-0 items-center gap-2 break-keep font-black leading-[1.2] text-foreground"
              style={{ fontSize: "var(--section-title-size)" }}
            >
              <CalendarRange className="h-5 w-5 shrink-0" />
              {UI_COPY.mypage.calendarSection.title}
            </h2>
            <div className="shrink-0">
              <div className="flex items-center gap-1 md:gap-1.5">
                <Button
                  size="small"
                  variant="secondary"
                  iconOnly
                  className="text-foreground/58 hover:text-primary"
                  onClick={() => setMonthOffset((current) => current - 1)}
                  aria-label="이전 달"
                  title="이전 달"
                >
                  <ChevronLeft />
                </Button>
                <div className="min-w-0 whitespace-nowrap px-1 text-center text-xs font-semibold md:min-w-30 md:text-sm md:font-bold">
                  {formatMonthTitle(visibleMonth)}
                </div>
                <Button
                  size="small"
                  variant="secondary"
                  iconOnly
                  className="text-foreground/58 hover:text-primary"
                  onClick={() => setMonthOffset((current) => current + 1)}
                  aria-label="다음 달"
                  title="다음 달"
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>
          </div>
          <p className="break-keep text-xs leading-relaxed text-foreground/60 md:text-sm">
            {UI_COPY.mypage.calendarSection.description}
          </p>
        </div>

        <div className="overflow-hidden rounded-xl border border-border/90 bg-card/70 md:rounded-2xl">
          <div className="grid grid-cols-7 border-b border-border/80 bg-primary-soft/75">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="px-1 py-3 text-center text-2xs font-bold uppercase tracking-widest text-foreground/52 md:px-3 md:text-xs">
                {label}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthCells.map((date, index) => {
              if (!date) {
                return <div key={`empty-${index}`} className="min-h-[74px] border-b border-r border-border/60 bg-muted/18 md:min-h-[106px]" />;
              }

              const daySchedules = visibleMonthSchedules.filter((schedule) => doesScheduleOverlapDate(schedule, date));
              const visibleSchedules = daySchedules.slice(0, 2);
              const hiddenScheduleCount = daySchedules.length - visibleSchedules.length;
              const isToday = isSameDay(date, new Date());

              return (
                <div
                  key={date.toISOString()}
                  className="min-h-[74px] border-b border-r border-border/60 bg-card/82 px-0.5 py-1 align-top md:min-h-[106px] md:px-1 md:py-2"
                >
                  <div className={cn("mb-1 px-1 text-xs font-bold text-foreground/75 md:mb-2 md:px-2 md:text-sm", isToday && "text-primary")}>
                    {date.getDate()}
                  </div>

                  <div className="space-y-1">
                    {visibleSchedules.map((schedule) => {
                      const previousDate = new Date(date);
                      previousDate.setDate(date.getDate() - 1);
                      const nextDate = new Date(date);
                      nextDate.setDate(date.getDate() + 1);

                      const continuesFromPrevious = doesScheduleOverlapDate(schedule, previousDate);
                      const continuesToNext = doesScheduleOverlapDate(schedule, nextDate);
                      const startsSegment = !continuesFromPrevious;
                      const endsSegment = !continuesToNext;
                      const showLabel = startsSegment || date.getDate() === 1;
                      const status = getScheduleStatus(schedule.startDate, schedule.endDate);

                      return (
                        <Link
                          key={`${schedule.id}-${date.toISOString()}`}
                          href={`/routes/${schedule.id}`}
                          aria-label={`${schedule.title} 일정으로 이동`}
                          className="relative block h-4 text-3xs font-bold transition-opacity hover:opacity-85 md:h-5 md:text-2xs"
                          title={`${schedule.title} · ${formatDateRange(schedule.startDate, schedule.endDate)}`}
                        >
                          <span
                            className={cn(
                              "absolute inset-y-0 flex items-center overflow-hidden border border-white/10 shadow-subtle",
                              getSegmentTone(status),
                              startsSegment ? "left-0.5 rounded-l-full pl-2 md:left-1" : "-left-px rounded-l-none",
                              endsSegment ? "right-0.5 rounded-r-full pr-2 md:right-1" : "-right-px rounded-r-none"
                            )}
                          >
                            <span className="block truncate px-1">{showLabel ? schedule.title : "\u00A0"}</span>
                          </span>
                        </Link>
                      );
                    })}
                    {hiddenScheduleCount > 0 ? (
                      <p className="px-1 text-3xs font-semibold text-foreground/52 md:px-2 md:text-xs">
                        {UI_COPY.mypage.calendarSection.hiddenSchedules(hiddenScheduleCount)}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {pastSchedules.length > 0 || preferenceBadges.length > 0 ? (
        <section
          className={cn(
            "grid gap-4",
            pastSchedules.length > 0 && preferenceBadges.length > 0 ? "xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]" : "grid-cols-1"
          )}
        >
          {pastSchedules.length > 0 ? (
            <Card className="space-y-4 p-4 md:p-5">
              <SectionHeader title={UI_COPY.mypage.archiveSection.title} description={UI_COPY.mypage.archiveSection.description} />

              <div className="grid gap-3">
                {pastSchedules.map((schedule) => (
                  <ListItemCard
                    key={schedule.id}
                    href={`/routes/${schedule.id}`}
                    title={schedule.title}
                    description={`${schedule.placeList.city} · ${formatDateRange(schedule.startDate, schedule.endDate)}`}
                    badge={
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border border-border/80 bg-card/92 px-2.5 font-bold text-foreground/58",
                          BADGE_HEIGHT_CLASS.small,
                          BADGE_TEXT_CLASS.label
                        )}
                      >
                        {formatRelativeTripLabel(schedule.startDate, schedule.endDate)}
                      </span>
                    }
                  />
                ))}
              </div>
            </Card>
          ) : null}

          {preferenceBadges.length > 0 ? (
            <Card className="space-y-4 p-4 md:p-5">
              <SectionHeader
                title={
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    {UI_COPY.mypage.preferenceSection.title}
                  </span>
                }
                description={UI_COPY.mypage.preferenceSection.description}
              />

              <div className="flex flex-wrap gap-2.5">
                {preferenceBadges.map((badge) => (
                  <PreferenceChip key={badge.id} {...badge} />
                ))}
              </div>
            </Card>
          ) : null}
        </section>
      ) : null}

      <Card className="space-y-5 overflow-hidden border-primary-light/35 bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(244,251,255,0.96))] p-4 md:p-5">
        <SectionHeader
          title={
            <span className="inline-flex items-center gap-2">
              <UserCircle2 className="h-5 w-5" />
              {UI_COPY.mypage.accountSection.title}
            </span>
          }
        />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-border/75 bg-card/86 p-4 shadow-surface md:rounded-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary-soft p-2.5 text-primary">
                <Mail className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/45">
                  {UI_COPY.mypage.accountSection.email}
                </p>
                <p className="truncate text-sm font-semibold text-foreground">{session?.user?.email || "-"}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-border/75 bg-card/86 p-4 shadow-surface md:rounded-2xl">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl bg-primary-soft p-2.5 text-primary">
                <UserCircle2 className="h-4 w-4" />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground/45">
                  {UI_COPY.mypage.accountSection.provider}
                </p>
                <p className="text-sm font-semibold text-foreground">{providerLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <Button
          size="small"
          variant="secondary"
          disabled={isSigningOut}
          onClick={handleSignOut}
          className="self-start"
        >
          <LogOut className="h-4 w-4" />
          {isSigningOut ? UI_COPY.mypage.logout.loading : UI_COPY.mypage.logout.action}
        </Button>

        <button
          type="button"
          disabled={deleteAccountMutation.isPending}
          onClick={() => {
            deleteAccountMutation.reset();
            deleteAccountForm.reset();
            setIsDeleteAccountDialogOpen(true);
          }}
          className="block pl-1 text-left text-2xs font-medium text-foreground/48 underline underline-offset-2 decoration-foreground/28 transition-colors hover:text-foreground/68 hover:decoration-foreground/44 focus-visible:outline-hidden focus-visible:text-foreground/68 disabled:cursor-not-allowed disabled:opacity-50 md:text-xs"
        >
          {UI_COPY.mypage.deleteAccount.action}
        </button>
      </Card>

      <DialogShell
        open={isDeleteAccountDialogOpen}
        eyebrow="Delete Account"
        title={UI_COPY.mypage.deleteAccount.title}
        description={undefined}
        busy={deleteAccountMutation.isPending}
        mascotVariant="sad"
        mascotClassName="h-[calc(var(--mascot-dialog-size)*1.5)] w-[calc(var(--mascot-dialog-size)*1.5)]"
        tone="danger"
        showCloseButton={false}
        size="md"
        onClose={closeDeleteAccountDialog}
        footer={
          <>
            <Button
              variant="secondary"
              size="medium"
              onClick={closeDeleteAccountDialog}
              disabled={deleteAccountMutation.isPending}
            >
              {UI_COPY.mypage.deleteAccount.cancel}
            </Button>
            <Button
              type="submit"
              form={deleteAccountFormId}
              variant="danger"
              size="medium"
              disabled={!isDeleteAccountEmailMatched || deleteAccountMutation.isPending}
            >
              {deleteAccountMutation.isPending ? UI_COPY.mypage.deleteAccount.confirming : UI_COPY.mypage.deleteAccount.confirm}
            </Button>
          </>
        }
      >
        <form
          id={deleteAccountFormId}
          noValidate
          className="space-y-5"
          onSubmit={deleteAccountForm.handleSubmit(() => {
            if (deleteAccountMutation.isPending) return;
            deleteAccountMutation.mutate();
          })}
        >
          {deleteAccountMutation.error ? (
            <p className="rounded-md border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
              {UI_COPY.mypage.deleteAccount.error}
            </p>
          ) : null}

          <div className="flex items-center gap-3 rounded-lg border border-danger/24 bg-danger/8 p-4 shadow-subtle md:rounded-xl">
            <AlertTriangle className="h-4 w-4 shrink-0 text-danger" />
            <p className="text-xs leading-6 text-foreground/72 md:text-sm">{UI_COPY.mypage.deleteAccount.description}</p>
          </div>

          <div className="space-y-1">
            <DialogFieldLabel htmlFor={deleteAccountEmailFieldId} required>
              {UI_COPY.mypage.deleteAccount.emailPrompt}
            </DialogFieldLabel>
            <Input
              id={deleteAccountEmailFieldId}
              type="email"
              inputMode="email"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              autoFocus
              placeholder={deleteAccountEmail || "hello@myroute.app"}
              aria-invalid={Boolean(deleteAccountForm.formState.errors.email)}
              {...deleteAccountForm.register("email")}
            />
            <DialogFieldHint error>{deleteAccountForm.formState.errors.email?.message}</DialogFieldHint>
          </div>
        </form>
      </DialogShell>
    </PageContainer>
  );
}

