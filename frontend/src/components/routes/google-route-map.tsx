"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { TriangleAlert } from "lucide-react";

import { UI_COPY } from "@/constants/ui-copy";
import { publicEnv } from "@/lib/env";
import { cn } from "@/lib/cn";

type RoutePoint = {
  id: string;
  lat: number;
  lng: number;
  label?: string;
};

type StayMarkerPoint = {
  lat: number;
  lng: number;
  name?: string | null;
};

type StayRecommendationCircle = {
  centerLat: number;
  centerLng: number;
  radiusKm: number;
};

type GoogleRouteMapProps = {
  points: RoutePoint[];
  fallbackUrl: string;
  className?: string;
  activePointId?: string | null;
  focusPointId?: string | null;
  focusPointRequestKey?: number;
  onPointClick?: (pointId: string) => void;
  showStayOverlay?: boolean;
  stayMarker?: StayMarkerPoint | null;
  stayRecommendation?: StayRecommendationCircle | null;
};

type MarkerEntry = {
  id: string;
  index: number;
  marker: any;
  labelText: string;
};

declare global {
  interface Window {
    google?: any;
  }
}

const GOOGLE_MAP_SCRIPT_ID = "google-maps-js-sdk";
let googleScriptLoadPromise: Promise<any> | null = null;
const MAP_MARKER_ACTIVE = "#3C9DFF";
const MAP_MARKER_LEAD = "#7CC7FF";
const MAP_MARKER_DEFAULT = "#A9DBFF";
const MAP_ROUTE_LINE = "#4AA5FF";
const STAY_MARKER_FILL = "#14B8A6";
const MOBILE_VIEWPORT_QUERY = "(max-width: 767px)";

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

function isMobileViewport() {
  return typeof window !== "undefined" && window.matchMedia(MOBILE_VIEWPORT_QUERY).matches;
}

function getMarkerIcon(google: any, isActive: boolean, isLead: boolean, compact: boolean) {
  return {
    path: google.maps.SymbolPath.CIRCLE,
    fillColor: isActive ? MAP_MARKER_ACTIVE : isLead ? MAP_MARKER_LEAD : MAP_MARKER_DEFAULT,
    fillOpacity: 1,
    strokeColor: "#ffffff",
    strokeWeight: 2,
    scale: compact ? (isActive ? 17 : 15) : isActive ? 19 : 16
  };
}

function getMarkerLabel(labelText: string, compact: boolean) {
  return {
    text: labelText,
    color: "#ffffff",
    fontSize: compact ? "12px" : "13px",
    fontWeight: "700"
  };
}

function getStayMarkerIcon(google: any, compact: boolean) {
  const markerSize = compact ? 40 : 44;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${markerSize}" height="${markerSize}" viewBox="0 0 44 44">
      <circle cx="22" cy="22" r="20" fill="${STAY_MARKER_FILL}" stroke="white" stroke-width="2.5" />
      <path d="M22 12.5 12.5 20v11a2 2 0 0 0 2 2h5.8v-8h3.4v8h5.8a2 2 0 0 0 2-2V20L22 12.5Z" fill="white"/>
    </svg>
  `;

  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(markerSize, markerSize),
    anchor: new google.maps.Point(markerSize / 2, markerSize / 2)
  };
}

function extendBoundsWithCircle(bounds: any, circle: StayRecommendationCircle) {
  const latDelta = circle.radiusKm / 111;
  const lngBase = Math.cos(toRadians(circle.centerLat));
  const lngDelta = circle.radiusKm / (111 * Math.max(0.25, Math.abs(lngBase)));

  bounds.extend({ lat: circle.centerLat + latDelta, lng: circle.centerLng + lngDelta });
  bounds.extend({ lat: circle.centerLat - latDelta, lng: circle.centerLng - lngDelta });
}

function loadGoogleMapsScript(apiKey: string) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Google Maps script can only load in browser."));
  }

  if (window.google?.maps) {
    return Promise.resolve(window.google);
  }

  if (googleScriptLoadPromise) {
    return googleScriptLoadPromise;
  }

  googleScriptLoadPromise = new Promise((resolve, reject) => {
    const existingScript = document.getElementById(GOOGLE_MAP_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(window.google));
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps script.")));
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAP_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google Maps script."));
    document.head.appendChild(script);
  });

  return googleScriptLoadPromise;
}

export function GoogleRouteMap({
  points,
  fallbackUrl,
  className,
  activePointId,
  focusPointId,
  focusPointRequestKey = 0,
  onPointClick,
  showStayOverlay = true,
  stayMarker = null,
  stayRecommendation = null
}: GoogleRouteMapProps) {
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const googleMapsRef = useRef<any>(null);
  const mapInstanceRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const markerEntriesRef = useRef<MarkerEntry[]>([]);
  const activePointIdRef = useRef(activePointId);
  const onPointClickRef = useRef(onPointClick);
  const lastNonEmptyFallbackUrlRef = useRef(fallbackUrl);
  const [scriptLoadFailed, setScriptLoadFailed] = useState(false);
  const [isCompactViewport, setIsCompactViewport] = useState(isMobileViewport);

  const apiKey = publicEnv.googleMapsApiKey;
  const pointsSignature = useMemo(() => points.map((point) => `${point.lat},${point.lng}`).join("|"), [points]);
  const stayOverlaySignature = useMemo(() => {
    if (!showStayOverlay) return "hidden";
    if (stayMarker) return `marker:${stayMarker.lat},${stayMarker.lng}`;
    if (stayRecommendation) {
      return `circle:${stayRecommendation.centerLat},${stayRecommendation.centerLng},${stayRecommendation.radiusKm}`;
    }
    return "none";
  }, [showStayOverlay, stayMarker, stayRecommendation]);

  useEffect(() => {
    if (points.length > 0) {
      lastNonEmptyFallbackUrlRef.current = fallbackUrl;
    }
  }, [fallbackUrl, points.length]);

  useEffect(() => {
    setScriptLoadFailed(false);
  }, [apiKey]);

  useEffect(() => {
    activePointIdRef.current = activePointId;
  }, [activePointId]);

  useEffect(() => {
    onPointClickRef.current = onPointClick;
  }, [onPointClick]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mediaQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const syncViewport = () => setIsCompactViewport(mediaQuery.matches);
    syncViewport();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", syncViewport);
      return () => mediaQuery.removeEventListener("change", syncViewport);
    }

    mediaQuery.addListener(syncViewport);
    return () => mediaQuery.removeListener(syncViewport);
  }, []);

  useEffect(() => {
    if (!apiKey || scriptLoadFailed || !mapElementRef.current) {
      return;
    }

    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;
    let frameId: number | null = null;

    loadGoogleMapsScript(apiKey)
      .then((google) => {
        if (cancelled) return;
        if (!google?.maps || !mapElementRef.current) {
          setScriptLoadFailed(true);
          return;
        }

        googleMapsRef.current = google;

        const clearOverlays = () => {
          overlaysRef.current.forEach((overlay) => {
            if (overlay?.setMap) {
              overlay.setMap(null);
            }
          });
          overlaysRef.current = [];
          markerEntriesRef.current = [];
        };

        if (!mapInstanceRef.current) {
          if (points.length === 0 && !(showStayOverlay && (stayMarker || stayRecommendation))) {
            clearOverlays();
            return;
          }

          mapInstanceRef.current = new google.maps.Map(mapElementRef.current, {
            center: points[0] || (stayMarker ? { lat: stayMarker.lat, lng: stayMarker.lng } : { lat: 37.5665, lng: 126.978 }),
            zoom: 12,
            disableDefaultUI: true,
            zoomControl: true,
            gestureHandling: "greedy",
            clickableIcons: false,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false
          });
        }

        const map = mapInstanceRef.current;
        const syncViewport = () => {
          const mapElement = mapElementRef.current;
          if (!mapElement) return;

          const { width, height } = mapElement.getBoundingClientRect();
          if (width < 16 || height < 16) return;

          google.maps.event.trigger(map, "resize");

          const hasStayMarker = showStayOverlay && stayMarker;
          const hasStayRecommendation = showStayOverlay && stayRecommendation;

          if (points.length === 0 && !hasStayMarker && !hasStayRecommendation) {
            return;
          }

          if (points.length === 1 && !hasStayMarker && !hasStayRecommendation) {
            map.setCenter(points[0]);
            map.setZoom(13);
            return;
          }

          const bounds = new google.maps.LatLngBounds();
          points.forEach((point) => bounds.extend(point));
          if (hasStayMarker) {
            bounds.extend({ lat: stayMarker.lat, lng: stayMarker.lng });
          }
          if (hasStayRecommendation) {
            extendBoundsWithCircle(bounds, stayRecommendation);
          }
          map.fitBounds(bounds, 52);
        };
        const queueViewportSync = () => {
          if (frameId != null) {
            window.cancelAnimationFrame(frameId);
          }

          frameId = window.requestAnimationFrame(() => {
            if (!cancelled) {
              syncViewport();
            }
          });
        };

        clearOverlays();

        if (points.length > 0) {
          points.forEach((point, index) => {
            const labelText = point.label || String(index + 1);
            const marker = new google.maps.Marker({
              map,
              position: point,
              label: getMarkerLabel(labelText, isCompactViewport),
              icon: getMarkerIcon(google, point.id === activePointIdRef.current, index === 0, isCompactViewport),
              zIndex: point.id === activePointIdRef.current ? 2 : 1
            });

            marker.addListener("click", () => onPointClickRef.current?.(point.id));

            overlaysRef.current.push(marker);
            markerEntriesRef.current.push({ id: point.id, index, marker, labelText });
          });

          if (points.length >= 2) {
            const polyline = new google.maps.Polyline({
              map,
              path: points,
              geodesic: true,
              strokeColor: MAP_ROUTE_LINE,
              strokeOpacity: 0.9,
              strokeWeight: 4
            });
            overlaysRef.current.push(polyline);
          }
        }

        if (showStayOverlay && stayMarker) {
          const marker = new google.maps.Marker({
            map,
            position: { lat: stayMarker.lat, lng: stayMarker.lng },
            icon: getStayMarkerIcon(google, isCompactViewport),
            zIndex: 4
          });
          overlaysRef.current.push(marker);
        }

        if (showStayOverlay && stayRecommendation) {
          const circle = new google.maps.Circle({
            map,
            center: {
              lat: stayRecommendation.centerLat,
              lng: stayRecommendation.centerLng
            },
            radius: stayRecommendation.radiusKm * 1000,
            fillColor: "#2DD4BF",
            fillOpacity: 0.18,
            strokeColor: "#2DD4BF",
            strokeOpacity: 0.55,
            strokeWeight: 1.5,
            zIndex: 0
          });
          overlaysRef.current.push(circle);
        }

        queueViewportSync();

        if (typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(() => {
            queueViewportSync();
          });
          resizeObserver.observe(mapElementRef.current);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setScriptLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
      resizeObserver?.disconnect();
      if (frameId != null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [apiKey, isCompactViewport, pointsSignature, points, scriptLoadFailed, showStayOverlay, stayMarker, stayRecommendation, stayOverlaySignature]);

  useEffect(() => {
    const google = googleMapsRef.current;
    if (!google?.maps) return;

    markerEntriesRef.current.forEach(({ id, index, marker, labelText }) => {
      marker.setLabel(getMarkerLabel(labelText, isCompactViewport));
      marker.setIcon(getMarkerIcon(google, id === activePointId, index === 0, isCompactViewport));
      marker.setZIndex(id === activePointId ? 2 : 1);
    });
  }, [activePointId, isCompactViewport]);

  useEffect(() => {
    if (!focusPointId || focusPointRequestKey === 0) return;

    const map = mapInstanceRef.current;
    const mapElement = mapElementRef.current;
    if (!map || !mapElement) return;

    const { width, height } = mapElement.getBoundingClientRect();
    if (width < 16 || height < 16) return;

    const targetPoint = points.find((point) => point.id === focusPointId);
    if (!targetPoint) return;

    map.panTo(targetPoint);
  }, [focusPointId, focusPointRequestKey, points]);

  const iframeSrc = points.length === 0 ? lastNonEmptyFallbackUrlRef.current : fallbackUrl;
  const hasOverlayOnlyState = showStayOverlay && Boolean(stayMarker || stayRecommendation);
  const emptyState = points.length === 0 && !hasOverlayOnlyState ? (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-background/36 px-4">
      <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/90 px-4 py-2 text-sm font-semibold text-foreground/72 shadow-xs backdrop-blur-xs">
        <TriangleAlert className="h-4 w-4 shrink-0 text-danger" />
        {UI_COPY.routes.detail.emptyDay}
      </div>
    </div>
  ) : null;

  if (!apiKey || scriptLoadFailed) {
    return (
      <div className={cn("relative", className)}>
        <iframe title="여행 지도" src={iframeSrc} className="h-full w-full" loading="lazy" />
        {emptyState}
      </div>
    );
  }

  return (
    <div className={cn("relative", className)}>
      <div ref={mapElementRef} className="h-full w-full" />
      {emptyState}
    </div>
  );
}
