"use client";

import {
  forwardRef,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type UIEventHandler
} from "react";

import { cn } from "@/lib/cn";

type DragAxis = "pending" | "x" | "y";

type DragState = {
  axis: DragAxis;
  pointerId: number;
  startScrollLeft: number;
  startX: number;
  startY: number;
};

type HorizontalDragScrollProps = {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
  onScroll?: UIEventHandler<HTMLDivElement>;
};

export const HorizontalDragScroll = forwardRef<HTMLDivElement, HorizontalDragScrollProps>(function HorizontalDragScroll(
  { children, className, innerClassName, onScroll },
  forwardedRef
) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleContainerRef = (node: HTMLDivElement | null) => {
    containerRef.current = node;

    if (typeof forwardedRef === "function") {
      forwardedRef(node);
      return;
    }

    if (forwardedRef) {
      forwardedRef.current = node;
    }
  };

  const endDrag = (event?: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const dragState = dragStateRef.current;

    if (container && dragState && event && container.hasPointerCapture?.(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
    setIsDragging(false);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    if (!container) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (container.scrollWidth <= container.clientWidth + 4) return;

    suppressClickRef.current = false;
    dragStateRef.current = {
      axis: "pending",
      pointerId: event.pointerId,
      startScrollLeft: container.scrollLeft,
      startX: event.clientX,
      startY: event.clientY
    };
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = containerRef.current;
    const dragState = dragStateRef.current;
    if (!container || !dragState || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.startX;
    const deltaY = event.clientY - dragState.startY;

    if (dragState.axis === "pending") {
      if (Math.abs(deltaX) < 3 && Math.abs(deltaY) < 3) return;
      dragState.axis = Math.abs(deltaX) >= Math.abs(deltaY) ? "x" : "y";
    }

    if (dragState.axis === "y") {
      endDrag();
      return;
    }

    if (!container.hasPointerCapture?.(event.pointerId)) {
      container.setPointerCapture?.(event.pointerId);
    }

    if (!isDragging && Math.abs(deltaX) > 6) {
      suppressClickRef.current = true;
      setIsDragging(true);
    }

    container.scrollLeft = dragState.startScrollLeft - deltaX;
    if (Math.abs(deltaX) > 1) {
      event.preventDefault();
    }
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    endDrag(event);
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;

    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <div
      ref={handleContainerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClickCapture={handleClickCapture}
      onScroll={onScroll}
      className={cn(
        "select-none scroll-smooth [-webkit-overflow-scrolling:touch]",
        isDragging ? "cursor-grabbing" : "cursor-grab",
        className
      )}
    >
      <div className={innerClassName}>{children}</div>
    </div>
  );
});
