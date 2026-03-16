"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from "react";

import type { RouteViewMode } from "@/components/routes/route-view-mode";
import { getPreferredRouteFocusBehavior } from "@/lib/route-travel";

export type RouteStopListRefs = {
  itemRefs: MutableRefObject<Record<string, HTMLDivElement | null>>;
  scrollRef?: RefObject<HTMLDivElement | null>;
};

type RouteStopInteractionsOptions = {
  currentDayId?: string | null;
  currentDayStops: Array<{ id: string }>;
  stopFocusTopOffset?: number;
  viewMode: RouteViewMode;
};

export function useRouteStopInteractions({
  currentDayId,
  currentDayStops,
  stopFocusTopOffset = 12,
  viewMode
}: RouteStopInteractionsOptions) {
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [mapFocusRequest, setMapFocusRequest] = useState<{ pointId: string | null; key: number }>({
    pointId: null,
    key: 0
  });
  const [mobileSheetMode, setMobileSheetMode] = useState<"peek" | "full">("peek");
  const [sheetDragOffset, setSheetDragOffset] = useState(0);
  const [isSheetDragging, setIsSheetDragging] = useState(false);

  const mobileSheetScrollRef = useRef<HTMLDivElement | null>(null);
  const desktopSplitListScrollRef = useRef<HTMLDivElement | null>(null);
  const listModeScrollRef = useRef<HTMLDivElement | null>(null);
  const mobileSplitItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const desktopSplitItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const listModeItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const sheetDragRef = useRef<{ pointerId: number; startY: number; startMode: "peek" | "full" } | null>(null);
  const focusScrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const firstStopId = currentDayStops[0]?.id || null;
    setActiveStopId(firstStopId);

    if (typeof window !== "undefined" && focusScrollFrameRef.current != null) {
      window.cancelAnimationFrame(focusScrollFrameRef.current);
      focusScrollFrameRef.current = null;
    }

    const resetScrollTop = () => {
      mobileSheetScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
      desktopSplitListScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
      listModeScrollRef.current?.scrollTo({ top: 0, behavior: "auto" });
    };

    if (typeof window === "undefined") {
      resetScrollTop();
      return;
    }

    const frameId = window.requestAnimationFrame(() => {
      resetScrollTop();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [currentDayId, currentDayStops]);

  useEffect(() => {
    if (viewMode !== "split") {
      setMobileSheetMode("peek");
      setSheetDragOffset(0);
      setIsSheetDragging(false);
      sheetDragRef.current = null;
    }
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (focusScrollFrameRef.current != null && typeof window !== "undefined") {
        window.cancelAnimationFrame(focusScrollFrameRef.current);
      }
    };
  }, []);

  const getActiveStopListRefs = useCallback((): RouteStopListRefs => {
    const isDesktopViewport = typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

    if (viewMode === "split") {
      if (isDesktopViewport) {
        return {
          scrollRef: desktopSplitListScrollRef,
          itemRefs: desktopSplitItemRefs
        };
      }

      return {
        scrollRef: mobileSheetScrollRef,
        itemRefs: mobileSplitItemRefs
      };
    }

    return {
      scrollRef: listModeScrollRef,
      itemRefs: listModeItemRefs
    };
  }, [viewMode]);

  const scrollStopIntoView = useCallback(
    (stopId: string, behavior: ScrollBehavior = "smooth") => {
      const { scrollRef, itemRefs } = getActiveStopListRefs();
      const node = itemRefs.current[stopId];
      const container = scrollRef?.current ?? null;

      if (node && container && container.scrollHeight > container.clientHeight + 4) {
        const containerRect = container.getBoundingClientRect();
        const nodeRect = node.getBoundingClientRect();
        const desiredTop = Math.max(0, container.scrollTop + (nodeRect.top - containerRect.top) - stopFocusTopOffset);
        const maxTop = Math.max(0, container.scrollHeight - container.clientHeight);
        const nextTop = Math.min(desiredTop, maxTop);

        container.scrollTo({ top: nextTop, behavior });
        return;
      }

      if (node) {
        node.scrollIntoView({ behavior, block: "start" });
        return;
      }

      if (container) {
        container.scrollTo({ top: 0, behavior });
      }
    },
    [getActiveStopListRefs, stopFocusTopOffset]
  );

  const queueStopFocusScroll = useCallback(
    (stopId: string, behavior: ScrollBehavior = "smooth") => {
      if (typeof window === "undefined") {
        scrollStopIntoView(stopId, behavior);
        return;
      }

      if (focusScrollFrameRef.current != null) {
        window.cancelAnimationFrame(focusScrollFrameRef.current);
        focusScrollFrameRef.current = null;
      }

      focusScrollFrameRef.current = window.requestAnimationFrame(() => {
        scrollStopIntoView(stopId, behavior);
        focusScrollFrameRef.current = null;
      });
    },
    [scrollStopIntoView]
  );

  const activateStopInList = useCallback((stopId: string) => {
    setActiveStopId(stopId);
  }, []);

  const requestMapFocus = useCallback((stopId: string) => {
    setMapFocusRequest((current) => ({
      pointId: stopId,
      key: current.key + 1
    }));
  }, []);

  const focusStopFromCard = useCallback(
    (stopId: string) => {
      const behavior = getPreferredRouteFocusBehavior();
      activateStopInList(stopId);
      requestMapFocus(stopId);
      queueStopFocusScroll(stopId, behavior);
    },
    [activateStopInList, queueStopFocusScroll, requestMapFocus]
  );

  const focusStopFromMap = useCallback(
    (stopId: string) => {
      const behavior = getPreferredRouteFocusBehavior();
      activateStopInList(stopId);
      queueStopFocusScroll(stopId, behavior);
    },
    [activateStopInList, queueStopFocusScroll]
  );

  const handleSheetPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    sheetDragRef.current = { pointerId: event.pointerId, startY: event.clientY, startMode: mobileSheetMode };
    setSheetDragOffset(0);
    setIsSheetDragging(true);
  };

  const handleSheetPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = sheetDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    const delta = event.clientY - dragState.startY;
    const clampedDelta =
      dragState.startMode === "peek" ? Math.max(-320, Math.min(0, delta)) : Math.max(0, Math.min(320, delta));

    setSheetDragOffset(clampedDelta);
  };

  const handleSheetPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = sheetDragRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const threshold = 72;
    const nextMode =
      dragState.startMode === "peek"
        ? sheetDragOffset < -threshold
          ? "full"
          : "peek"
        : sheetDragOffset > threshold
          ? "peek"
          : "full";

    setMobileSheetMode(nextMode);
    setSheetDragOffset(0);
    setIsSheetDragging(false);
    sheetDragRef.current = null;
  };

  return {
    activeStopId,
    activateStopInList,
    focusStopFromCard,
    focusStopFromMap,
    handleSheetPointerDown,
    handleSheetPointerMove,
    handleSheetPointerEnd,
    isSheetDragging,
    listRefs: {
      desktopSplit: {
        scrollRef: desktopSplitListScrollRef,
        itemRefs: desktopSplitItemRefs
      },
      list: {
        scrollRef: listModeScrollRef,
        itemRefs: listModeItemRefs
      },
      mobile: {
        scrollRef: mobileSheetScrollRef,
        itemRefs: mobileSplitItemRefs
      }
    },
    mapFocusRequest,
    mobileSheetMode,
    requestMapFocus,
    setActiveStopId,
    sheetDragOffset
  };
}
