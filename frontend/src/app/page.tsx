"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

import { EmptyState } from "@/components/common/empty-state";
import { DDayBadge } from "@/components/common/d-day-badge";
import { ListItemCard } from "@/components/common/list-item-card";
import { HomeEmptyState } from "@/components/home/home-empty-state";
import { HomeScheduleHeader } from "@/components/home/home-schedule-header";
import { LoadingPanel } from "@/components/common/loading-panel";
import { UI_COPY } from "@/constants/ui-copy";
import { PageContainer } from "@/components/layout/page-container";
import { buttonStyles } from "@/components/ui/button-styles";
import { fetchMySchedules } from "@/lib/graphql/api";
import { AppGraphQLError } from "@/lib/graphql/client";
import { queryKeys } from "@/lib/query-keys";
import { formatDateRange, formatRelativeTripLabel } from "@/lib/format";
import { getScheduleDdayLabel, getScheduleStatus, sortSchedulesForHome } from "@/lib/schedule-status";
import { useRequireAuth } from "@/hooks/use-require-auth";

export default function HomePage() {
  const { session, isLoading: isAuthLoading, isAuthed } = useRequireAuth();
  const accessToken = session?.access_token;

  const schedulesQuery = useQuery({
    queryKey: queryKeys.mySchedules,
    queryFn: () => fetchMySchedules(accessToken ?? ""),
    enabled: Boolean(accessToken)
  });

  if (isAuthLoading || !isAuthed) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.common.loading.authCheck} />
      </PageContainer>
    );
  }

  if (schedulesQuery.isLoading) {
    return (
      <PageContainer>
        <LoadingPanel message={UI_COPY.home.loading.schedules} />
      </PageContainer>
    );
  }

  if (schedulesQuery.isError) {
    const error = schedulesQuery.error;
    const isUnauthenticated = error instanceof AppGraphQLError && error.code === "UNAUTHENTICATED";
    return (
      <PageContainer>
        <EmptyState
          mascotVariant="surprise"
          title={
            isUnauthenticated ? UI_COPY.home.error.sessionExpiredTitle : UI_COPY.common.error.serviceUnavailableTitle
          }
          description={
            isUnauthenticated
              ? UI_COPY.home.error.sessionExpiredDescription
              : UI_COPY.common.error.serviceUnavailableDescription
          }
          action={
            isUnauthenticated ? (
              <Link href="/login" className={buttonStyles({ shape: "pill", className: "px-5 font-semibold" })}>
                {UI_COPY.common.action.goToLogin}
              </Link>
            ) : undefined
          }
        />
      </PageContainer>
    );
  }

  const schedules = [...(schedulesQuery.data || [])].sort(sortSchedulesForHome);
  const currentAndUpcomingSchedules = schedules.filter((schedule) => getScheduleStatus(schedule.startDate, schedule.endDate) !== "past");
  const pastSchedules = schedules.filter((schedule) => getScheduleStatus(schedule.startDate, schedule.endDate) === "past");
  const heroSchedule = currentAndUpcomingSchedules[0];
  const restSchedules = currentAndUpcomingSchedules.slice(1);

  if (schedules.length === 0) {
    return (
      <PageContainer className="flex min-h-full flex-1 flex-col gap-10">
        <HomeScheduleHeader showMascot={false} />
        <div className="flex flex-1 items-center justify-center">
          <div className="-translate-y-[calc(var(--bottom-nav-offset)/2)]">
            <HomeEmptyState />
          </div>
        </div>
      </PageContainer>
    );
  }

  if (!heroSchedule) {
    return (
      <PageContainer className="space-y-10">
        <HomeScheduleHeader showMascot={false} />
        <EmptyState
          title={UI_COPY.home.pastOnly.title}
          description={UI_COPY.home.pastOnly.description(pastSchedules.length)}
          mascotVariant="map"
          action={
            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Link href="/routes/new" className={buttonStyles({ shape: "pill", className: "px-5 font-semibold" })}>
                {UI_COPY.home.pastOnly.createAction}
              </Link>
              <Link
                href="/mypage"
                className={buttonStyles({ variant: "secondary", shape: "pill", className: "px-5 font-semibold" })}
              >
                {UI_COPY.home.pastOnly.calendarAction}
              </Link>
            </div>
          }
        />
      </PageContainer>
    );
  }

  const heroScheduleDday = getScheduleDdayLabel(heroSchedule.startDate);

  return (
    <PageContainer className="space-y-10">
      <HomeScheduleHeader statusLabel={formatRelativeTripLabel(heroSchedule.startDate, heroSchedule.endDate)} />

      <ListItemCard
        href={`/routes/${heroSchedule.id}`}
        title={heroSchedule.title}
        description={`${heroSchedule.placeList.city} · ${formatDateRange(heroSchedule.startDate, heroSchedule.endDate)}`}
        badge={heroScheduleDday ? <DDayBadge label={heroScheduleDday} /> : undefined}
        variant="featured"
      />

      {restSchedules.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 border-t border-dashed border-border/80" />
            <p className="shrink-0 text-[11px] font-black uppercase tracking-[0.24em] text-foreground/45">
              {UI_COPY.home.otherSchedulesLabel}
            </p>
            <div className="h-px flex-1 border-t border-dashed border-border/80" />
          </div>

          <div className="grid gap-3">
            {restSchedules.map((schedule) => {
              const dday = getScheduleDdayLabel(schedule.startDate);

              return (
                <ListItemCard
                  key={schedule.id}
                  href={`/routes/${schedule.id}`}
                  title={schedule.title}
                  description={`${schedule.placeList.city} · ${formatDateRange(schedule.startDate, schedule.endDate)}`}
                  badge={dday ? <DDayBadge label={dday} /> : undefined}
                />
              );
            })}
          </div>
        </section>
      ) : null}
    </PageContainer>
  );
}
