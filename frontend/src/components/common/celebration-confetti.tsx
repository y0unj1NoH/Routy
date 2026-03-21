"use client";

import { useEffect, useState, type CSSProperties } from "react";

import { cn } from "@/lib/cn";

export type CelebrationConfettiVariant = "default" | "burst";

type CelebrationConfettiProps = {
  className?: string;
  variant?: CelebrationConfettiVariant;
};

type ConfettiChip = {
  left: string;
  top: string;
  width: number;
  height: number;
  color: string;
  midY: string;
  endX: string;
  endY: string;
  midX: string;
  swayX: string;
  swayY: string;
  midRotate: string;
  swayRotate: string;
  endRotate: string;
  delayMs: number;
  durationMs: number;
  radius: string;
};

type ConfettiStreamer = {
  left: string;
  top: string;
  width: number;
  height: number;
  color: string;
  midX: string;
  midY: string;
  endX: string;
  endY: string;
  startRotate: string;
  midRotate: string;
  endRotate: string;
  delayMs: number;
  durationMs: number;
};

type ConfettiSpark = {
  left: string;
  top: string;
  size: number;
  color: string;
  midX: string;
  midY: string;
  endX: string;
  endY: string;
  delayMs: number;
  durationMs: number;
};

type ChipStyle = CSSProperties & {
  "--confetti-mid-x": string;
  "--confetti-mid-y": string;
  "--confetti-end-x": string;
  "--confetti-end-y": string;
  "--confetti-sway-x": string;
  "--confetti-sway-y": string;
  "--confetti-mid-rotate": string;
  "--confetti-sway-rotate": string;
  "--confetti-end-rotate": string;
};

type StreamerStyle = CSSProperties & {
  "--streamer-mid-x": string;
  "--streamer-mid-y": string;
  "--streamer-end-x": string;
  "--streamer-end-y": string;
  "--streamer-start-rotate": string;
  "--streamer-mid-rotate": string;
  "--streamer-end-rotate": string;
};

type SparkStyle = CSSProperties & {
  "--spark-mid-x": string;
  "--spark-mid-y": string;
  "--spark-end-x": string;
  "--spark-end-y": string;
};

type ConfettiPreset = {
  visibleMs: number;
  chips: ConfettiChip[];
  streamers: ConfettiStreamer[];
  sparks: ConfettiSpark[];
  classes: {
    chipTrack: string;
    chipBody: string;
    streamerTrack: string;
    streamerBody: string;
    sparkTrack: string;
    sparkBody: string;
  };
};

const PARTY_PALETTE = {
  coral: "#ff6b6b",
  gold: "#ffd166",
  sky: "#48bdf6",
  mint: "#77d9a8",
  violet: "#9b6dff",
  peach: "#ffad66"
} as const;

const DEFAULT_CONFETTI_CHIPS: ConfettiChip[] = [
  { left: "8%", top: "2%", width: 10, height: 18, color: PARTY_PALETTE.coral, midX: "-3vw", midY: "22vh", swayX: "1vw", swayY: "38vh", endX: "-7vw", endY: "54vh", midRotate: "120deg", swayRotate: "260deg", endRotate: "320deg", delayMs: 0, durationMs: 1480, radius: "4px" },
  { left: "14%", top: "0%", width: 12, height: 12, color: PARTY_PALETTE.gold, midX: "4vw", midY: "18vh", swayX: "8vw", swayY: "44vh", endX: "9vw", endY: "62vh", midRotate: "160deg", swayRotate: "280deg", endRotate: "360deg", delayMs: 90, durationMs: 1700, radius: "999px" },
  { left: "20%", top: "3%", width: 9, height: 22, color: PARTY_PALETTE.sky, midX: "-2vw", midY: "26vh", swayX: "2vw", swayY: "49vh", endX: "-5vw", endY: "66vh", midRotate: "180deg", swayRotate: "320deg", endRotate: "400deg", delayMs: 40, durationMs: 1820, radius: "999px" },
  { left: "28%", top: "1%", width: 14, height: 10, color: PARTY_PALETTE.peach, midX: "3vw", midY: "15vh", swayX: "-1vw", swayY: "28vh", endX: "6vw", endY: "40vh", midRotate: "140deg", swayRotate: "210deg", endRotate: "300deg", delayMs: 220, durationMs: 1460, radius: "999px" },
  { left: "36%", top: "4%", width: 8, height: 18, color: PARTY_PALETTE.mint, midX: "-4vw", midY: "28vh", swayX: "-1vw", swayY: "46vh", endX: "-6vw", endY: "58vh", midRotate: "150deg", swayRotate: "270deg", endRotate: "350deg", delayMs: 150, durationMs: 1760, radius: "999px" },
  { left: "44%", top: "1%", width: 11, height: 16, color: PARTY_PALETTE.violet, midX: "2vw", midY: "17vh", swayX: "-3vw", swayY: "33vh", endX: "5vw", endY: "46vh", midRotate: "135deg", swayRotate: "245deg", endRotate: "320deg", delayMs: 280, durationMs: 1580, radius: "4px" },
  { left: "50%", top: "-1%", width: 10, height: 20, color: PARTY_PALETTE.coral, midX: "-1vw", midY: "30vh", swayX: "3vw", swayY: "50vh", endX: "-3vw", endY: "68vh", midRotate: "170deg", swayRotate: "300deg", endRotate: "390deg", delayMs: 60, durationMs: 1940, radius: "999px" },
  { left: "56%", top: "1%", width: 12, height: 12, color: PARTY_PALETTE.gold, midX: "3vw", midY: "20vh", swayX: "7vw", swayY: "35vh", endX: "8vw", endY: "48vh", midRotate: "150deg", swayRotate: "260deg", endRotate: "330deg", delayMs: 320, durationMs: 1520, radius: "999px" },
  { left: "63%", top: "4%", width: 8, height: 22, color: PARTY_PALETTE.sky, midX: "-3vw", midY: "27vh", swayX: "1vw", swayY: "45vh", endX: "-5vw", endY: "63vh", midRotate: "210deg", swayRotate: "340deg", endRotate: "430deg", delayMs: 200, durationMs: 1880, radius: "999px" },
  { left: "70%", top: "2%", width: 13, height: 14, color: PARTY_PALETTE.peach, midX: "4vw", midY: "16vh", swayX: "0vw", swayY: "31vh", endX: "6vw", endY: "43vh", midRotate: "145deg", swayRotate: "235deg", endRotate: "315deg", delayMs: 380, durationMs: 1490, radius: "4px" },
  { left: "78%", top: "3%", width: 9, height: 17, color: PARTY_PALETTE.mint, midX: "-3vw", midY: "24vh", swayX: "-7vw", swayY: "42vh", endX: "-8vw", endY: "57vh", midRotate: "160deg", swayRotate: "300deg", endRotate: "380deg", delayMs: 260, durationMs: 1680, radius: "999px" },
  { left: "86%", top: "1%", width: 11, height: 11, color: PARTY_PALETTE.violet, midX: "4vw", midY: "19vh", swayX: "8vw", swayY: "36vh", endX: "7vw", endY: "50vh", midRotate: "140deg", swayRotate: "250deg", endRotate: "315deg", delayMs: 440, durationMs: 1600, radius: "999px" }
];

const DEFAULT_CONFETTI_STREAMERS: ConfettiStreamer[] = [
  { left: "10%", top: "2%", width: 7, height: 42, color: PARTY_PALETTE.sky, midX: "10vw", midY: "22vh", endX: "15vw", endY: "47vh", startRotate: "-18deg", midRotate: "22deg", endRotate: "48deg", delayMs: 0, durationMs: 1360 },
  { left: "18%", top: "3%", width: 6, height: 38, color: PARTY_PALETTE.coral, midX: "6vw", midY: "24vh", endX: "11vw", endY: "49vh", startRotate: "-10deg", midRotate: "18deg", endRotate: "42deg", delayMs: 180, durationMs: 1320 },
  { left: "48%", top: "0%", width: 7, height: 46, color: PARTY_PALETTE.gold, midX: "-2vw", midY: "20vh", endX: "-1vw", endY: "36vh", startRotate: "-4deg", midRotate: "8deg", endRotate: "14deg", delayMs: 60, durationMs: 1240 },
  { left: "52%", top: "0%", width: 7, height: 48, color: PARTY_PALETTE.violet, midX: "4vw", midY: "22vh", endX: "3vw", endY: "42vh", startRotate: "6deg", midRotate: "-3deg", endRotate: "-12deg", delayMs: 120, durationMs: 1300 },
  { left: "82%", top: "2%", width: 6, height: 40, color: PARTY_PALETTE.peach, midX: "-8vw", midY: "23vh", endX: "-11vw", endY: "50vh", startRotate: "12deg", midRotate: "-16deg", endRotate: "-44deg", delayMs: 260, durationMs: 1340 },
  { left: "90%", top: "1%", width: 7, height: 44, color: PARTY_PALETTE.mint, midX: "-10vw", midY: "21vh", endX: "-16vw", endY: "45vh", startRotate: "18deg", midRotate: "-20deg", endRotate: "-52deg", delayMs: 90, durationMs: 1420 }
];

const DEFAULT_CONFETTI_SPARKS: ConfettiSpark[] = [
  { left: "16%", top: "10%", size: 10, color: PARTY_PALETTE.gold, midX: "-1vw", midY: "3vh", endX: "-3vw", endY: "8vh", delayMs: 20, durationMs: 720 },
  { left: "24%", top: "8%", size: 8, color: PARTY_PALETTE.sky, midX: "1vw", midY: "4vh", endX: "3vw", endY: "9vh", delayMs: 140, durationMs: 760 },
  { left: "48%", top: "6%", size: 10, color: PARTY_PALETTE.peach, midX: "-1vw", midY: "3vh", endX: "-2vw", endY: "8vh", delayMs: 0, durationMs: 680 },
  { left: "52%", top: "6%", size: 10, color: PARTY_PALETTE.gold, midX: "1vw", midY: "3vh", endX: "2vw", endY: "8vh", delayMs: 70, durationMs: 700 },
  { left: "76%", top: "8%", size: 8, color: PARTY_PALETTE.violet, midX: "-1vw", midY: "4vh", endX: "-3vw", endY: "9vh", delayMs: 180, durationMs: 740 },
  { left: "84%", top: "10%", size: 10, color: PARTY_PALETTE.mint, midX: "1vw", midY: "3vh", endX: "4vw", endY: "8vh", delayMs: 260, durationMs: 760 }
];

const BURST_CONFETTI_CHIPS: ConfettiChip[] = [
  { left: "48%", top: "11%", width: 9, height: 18, color: PARTY_PALETTE.coral, midX: "-12vw", midY: "-11vh", swayX: "-15vw", swayY: "12vh", endX: "-10vw", endY: "50vh", midRotate: "-210deg", swayRotate: "120deg", endRotate: "320deg", delayMs: 0, durationMs: 1980, radius: "4px" },
  { left: "49%", top: "9%", width: 12, height: 12, color: PARTY_PALETTE.gold, midX: "-8vw", midY: "-14vh", swayX: "-6vw", swayY: "16vh", endX: "-4vw", endY: "56vh", midRotate: "-180deg", swayRotate: "110deg", endRotate: "360deg", delayMs: 20, durationMs: 2040, radius: "999px" },
  { left: "50%", top: "10%", width: 8, height: 22, color: PARTY_PALETTE.sky, midX: "-4vw", midY: "-9vh", swayX: "-2vw", swayY: "20vh", endX: "-1vw", endY: "64vh", midRotate: "-160deg", swayRotate: "140deg", endRotate: "400deg", delayMs: 40, durationMs: 2140, radius: "999px" },
  { left: "51%", top: "8%", width: 14, height: 10, color: PARTY_PALETTE.peach, midX: "4vw", midY: "-13vh", swayX: "7vw", swayY: "14vh", endX: "10vw", endY: "52vh", midRotate: "140deg", swayRotate: "250deg", endRotate: "300deg", delayMs: 10, durationMs: 1880, radius: "999px" },
  { left: "52%", top: "11%", width: 8, height: 18, color: PARTY_PALETTE.mint, midX: "9vw", midY: "-10vh", swayX: "13vw", swayY: "18vh", endX: "15vw", endY: "59vh", midRotate: "160deg", swayRotate: "270deg", endRotate: "350deg", delayMs: 70, durationMs: 2060, radius: "999px" },
  { left: "53%", top: "9%", width: 11, height: 16, color: PARTY_PALETTE.violet, midX: "14vw", midY: "-7vh", swayX: "18vw", swayY: "22vh", endX: "21vw", endY: "48vh", midRotate: "180deg", swayRotate: "280deg", endRotate: "340deg", delayMs: 100, durationMs: 1900, radius: "4px" },
  { left: "47%", top: "10%", width: 10, height: 20, color: PARTY_PALETTE.coral, midX: "-15vw", midY: "-6vh", swayX: "-18vw", swayY: "20vh", endX: "-22vw", endY: "61vh", midRotate: "-220deg", swayRotate: "-60deg", endRotate: "390deg", delayMs: 55, durationMs: 2200, radius: "999px" },
  { left: "48%", top: "8%", width: 12, height: 12, color: PARTY_PALETTE.gold, midX: "-11vw", midY: "-3vh", swayX: "-13vw", swayY: "24vh", endX: "-15vw", endY: "66vh", midRotate: "-140deg", swayRotate: "90deg", endRotate: "330deg", delayMs: 120, durationMs: 2120, radius: "999px" },
  { left: "50%", top: "7%", width: 8, height: 22, color: PARTY_PALETTE.sky, midX: "-1vw", midY: "-16vh", swayX: "2vw", swayY: "10vh", endX: "4vw", endY: "44vh", midRotate: "-250deg", swayRotate: "80deg", endRotate: "430deg", delayMs: 0, durationMs: 1820, radius: "999px" },
  { left: "52%", top: "8%", width: 13, height: 14, color: PARTY_PALETTE.peach, midX: "8vw", midY: "-15vh", swayX: "11vw", swayY: "12vh", endX: "13vw", endY: "46vh", midRotate: "150deg", swayRotate: "230deg", endRotate: "315deg", delayMs: 30, durationMs: 1860, radius: "4px" },
  { left: "54%", top: "10%", width: 9, height: 17, color: PARTY_PALETTE.mint, midX: "16vw", midY: "-4vh", swayX: "20vw", swayY: "18vh", endX: "24vw", endY: "57vh", midRotate: "200deg", swayRotate: "310deg", endRotate: "380deg", delayMs: 90, durationMs: 2100, radius: "999px" },
  { left: "46%", top: "9%", width: 11, height: 11, color: PARTY_PALETTE.violet, midX: "-18vw", midY: "-2vh", swayX: "-22vw", swayY: "16vh", endX: "-26vw", endY: "54vh", midRotate: "-200deg", swayRotate: "-20deg", endRotate: "315deg", delayMs: 140, durationMs: 1940, radius: "999px" },
  { left: "49%", top: "12%", width: 10, height: 14, color: PARTY_PALETTE.coral, midX: "-6vw", midY: "-7vh", swayX: "-9vw", swayY: "26vh", endX: "-12vw", endY: "62vh", midRotate: "-170deg", swayRotate: "110deg", endRotate: "350deg", delayMs: 160, durationMs: 2080, radius: "4px" },
  { left: "51%", top: "12%", width: 10, height: 14, color: PARTY_PALETTE.gold, midX: "6vw", midY: "-8vh", swayX: "9vw", swayY: "26vh", endX: "12vw", endY: "62vh", midRotate: "170deg", swayRotate: "250deg", endRotate: "350deg", delayMs: 180, durationMs: 2080, radius: "4px" },
  { left: "50%", top: "10%", width: 6, height: 18, color: PARTY_PALETTE.sky, midX: "0vw", midY: "-18vh", swayX: "-2vw", swayY: "6vh", endX: "-3vw", endY: "42vh", midRotate: "-280deg", swayRotate: "-10deg", endRotate: "420deg", delayMs: 0, durationMs: 1780, radius: "999px" },
  { left: "49%", top: "11%", width: 14, height: 8, color: PARTY_PALETTE.peach, midX: "-10vw", midY: "-12vh", swayX: "-14vw", swayY: "10vh", endX: "-18vw", endY: "46vh", midRotate: "-150deg", swayRotate: "80deg", endRotate: "300deg", delayMs: 60, durationMs: 1840, radius: "999px" },
  { left: "51%", top: "11%", width: 14, height: 8, color: PARTY_PALETTE.mint, midX: "10vw", midY: "-12vh", swayX: "14vw", swayY: "10vh", endX: "18vw", endY: "46vh", midRotate: "150deg", swayRotate: "280deg", endRotate: "300deg", delayMs: 80, durationMs: 1840, radius: "999px" },
  { left: "50%", top: "9%", width: 9, height: 15, color: PARTY_PALETTE.violet, midX: "2vw", midY: "-10vh", swayX: "5vw", swayY: "18vh", endX: "8vw", endY: "58vh", midRotate: "-120deg", swayRotate: "170deg", endRotate: "315deg", delayMs: 110, durationMs: 2020, radius: "999px" }
];

const BURST_CONFETTI_STREAMERS: ConfettiStreamer[] = [
  { left: "48.5%", top: "10%", width: 6, height: 30, color: PARTY_PALETTE.sky, midX: "-16vw", midY: "-10vh", endX: "-19vw", endY: "36vh", startRotate: "-14deg", midRotate: "-58deg", endRotate: "34deg", delayMs: 30, durationMs: 1620 },
  { left: "49.5%", top: "9%", width: 6, height: 28, color: PARTY_PALETTE.coral, midX: "-10vw", midY: "-14vh", endX: "-8vw", endY: "28vh", startRotate: "-8deg", midRotate: "-36deg", endRotate: "18deg", delayMs: 0, durationMs: 1500 },
  { left: "50%", top: "8%", width: 7, height: 34, color: PARTY_PALETTE.gold, midX: "-2vw", midY: "-18vh", endX: "0vw", endY: "24vh", startRotate: "-4deg", midRotate: "-10deg", endRotate: "8deg", delayMs: 40, durationMs: 1440 },
  { left: "50.5%", top: "9%", width: 7, height: 36, color: PARTY_PALETTE.violet, midX: "5vw", midY: "-15vh", endX: "7vw", endY: "30vh", startRotate: "6deg", midRotate: "18deg", endRotate: "-8deg", delayMs: 80, durationMs: 1480 },
  { left: "51.5%", top: "10%", width: 6, height: 32, color: PARTY_PALETTE.peach, midX: "12vw", midY: "-11vh", endX: "16vw", endY: "35vh", startRotate: "10deg", midRotate: "42deg", endRotate: "-24deg", delayMs: 120, durationMs: 1600 },
  { left: "52%", top: "11%", width: 6, height: 34, color: PARTY_PALETTE.mint, midX: "18vw", midY: "-8vh", endX: "22vw", endY: "40vh", startRotate: "14deg", midRotate: "56deg", endRotate: "-36deg", delayMs: 160, durationMs: 1680 }
];

const BURST_CONFETTI_SPARKS: ConfettiSpark[] = [
  { left: "49%", top: "9%", size: 8, color: PARTY_PALETTE.gold, midX: "-5vw", midY: "-12vh", endX: "-7vw", endY: "18vh", delayMs: 0, durationMs: 840 },
  { left: "49.5%", top: "8%", size: 10, color: PARTY_PALETTE.sky, midX: "-10vw", midY: "-10vh", endX: "-14vw", endY: "22vh", delayMs: 30, durationMs: 900 },
  { left: "50%", top: "7%", size: 9, color: PARTY_PALETTE.peach, midX: "-2vw", midY: "-16vh", endX: "-1vw", endY: "14vh", delayMs: 20, durationMs: 820 },
  { left: "50.5%", top: "7%", size: 10, color: PARTY_PALETTE.gold, midX: "2vw", midY: "-16vh", endX: "1vw", endY: "14vh", delayMs: 40, durationMs: 820 },
  { left: "51%", top: "8%", size: 8, color: PARTY_PALETTE.violet, midX: "8vw", midY: "-12vh", endX: "12vw", endY: "20vh", delayMs: 60, durationMs: 920 },
  { left: "51.5%", top: "9%", size: 10, color: PARTY_PALETTE.mint, midX: "13vw", midY: "-9vh", endX: "18vw", endY: "24vh", delayMs: 90, durationMs: 980 },
  { left: "48.5%", top: "10%", size: 7, color: PARTY_PALETTE.coral, midX: "-14vw", midY: "-4vh", endX: "-19vw", endY: "16vh", delayMs: 110, durationMs: 960 },
  { left: "52%", top: "10%", size: 7, color: PARTY_PALETTE.coral, midX: "14vw", midY: "-4vh", endX: "19vw", endY: "16vh", delayMs: 130, durationMs: 960 },
  { left: "49.75%", top: "9.5%", size: 6, color: PARTY_PALETTE.sky, midX: "-6vw", midY: "-18vh", endX: "-9vw", endY: "12vh", delayMs: 10, durationMs: 760 },
  { left: "50.25%", top: "9.5%", size: 6, color: PARTY_PALETTE.peach, midX: "6vw", midY: "-18vh", endX: "9vw", endY: "12vh", delayMs: 50, durationMs: 760 }
];

const CONFETTI_PRESETS: Record<CelebrationConfettiVariant, ConfettiPreset> = {
  default: {
    visibleMs: 2600,
    chips: DEFAULT_CONFETTI_CHIPS,
    streamers: DEFAULT_CONFETTI_STREAMERS,
    sparks: DEFAULT_CONFETTI_SPARKS,
    classes: {
      chipTrack: "route-confetti-chip",
      chipBody: "route-confetti-chip-body",
      streamerTrack: "route-confetti-streamer",
      streamerBody: "route-confetti-streamer-body",
      sparkTrack: "route-confetti-spark",
      sparkBody: "route-confetti-spark-body"
    }
  },
  burst: {
    visibleMs: 2800,
    chips: BURST_CONFETTI_CHIPS,
    streamers: BURST_CONFETTI_STREAMERS,
    sparks: BURST_CONFETTI_SPARKS,
    classes: {
      chipTrack: "route-confetti-chip-burst",
      chipBody: "route-confetti-chip-body-burst",
      streamerTrack: "route-confetti-streamer-burst",
      streamerBody: "route-confetti-streamer-body-burst",
      sparkTrack: "route-confetti-spark-burst",
      sparkBody: "route-confetti-spark-body-burst"
    }
  }
};

export function CelebrationConfetti({ className, variant = "default" }: CelebrationConfettiProps) {
  const [visible, setVisible] = useState(false);
  const preset = CONFETTI_PRESETS[variant];

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    setVisible(true);
    const timeoutId = window.setTimeout(() => setVisible(false), preset.visibleMs);
    return () => window.clearTimeout(timeoutId);
  }, [preset.visibleMs]);

  if (!visible) return null;

  return (
    <div className={cn("pointer-events-none fixed inset-0 z-[70] overflow-hidden", className)} aria-hidden="true">
      <div className="absolute inset-x-0 top-0 h-[72vh] min-h-[24rem]">
        {preset.streamers.map((streamer, index) => {
          const trackStyle: StreamerStyle = {
            left: streamer.left,
            top: streamer.top,
            width: `${streamer.width}px`,
            height: `${streamer.height}px`,
            animationDelay: `${streamer.delayMs}ms`,
            animationDuration: `${streamer.durationMs}ms`,
            "--streamer-mid-x": streamer.midX,
            "--streamer-mid-y": streamer.midY,
            "--streamer-end-x": streamer.endX,
            "--streamer-end-y": streamer.endY,
            "--streamer-start-rotate": streamer.startRotate,
            "--streamer-mid-rotate": streamer.midRotate,
            "--streamer-end-rotate": streamer.endRotate
          };

          const bodyStyle: CSSProperties = {
            background: `linear-gradient(180deg, ${streamer.color}, color-mix(in oklab, ${streamer.color} 62%, white))`
          };

          return (
            <span key={`streamer-${index}`} className={cn("absolute block opacity-0", preset.classes.streamerTrack)} style={trackStyle}>
              <span className={cn("block h-full w-full", preset.classes.streamerBody)} style={bodyStyle} />
            </span>
          );
        })}

        {preset.chips.map((piece, index) => {
          const trackStyle: ChipStyle = {
            left: piece.left,
            top: piece.top,
            width: `${piece.width}px`,
            height: `${piece.height}px`,
            animationDelay: `${piece.delayMs}ms`,
            animationDuration: `${piece.durationMs}ms`,
            "--confetti-mid-x": piece.midX,
            "--confetti-mid-y": piece.midY,
            "--confetti-end-x": piece.endX,
            "--confetti-end-y": piece.endY,
            "--confetti-sway-x": piece.swayX,
            "--confetti-sway-y": piece.swayY,
            "--confetti-mid-rotate": piece.midRotate,
            "--confetti-sway-rotate": piece.swayRotate,
            "--confetti-end-rotate": piece.endRotate
          };

          const bodyStyle: CSSProperties = {
            backgroundColor: piece.color,
            borderRadius: piece.radius
          };

          return (
            <span key={`chip-${index}`} className={cn("absolute block opacity-0", preset.classes.chipTrack)} style={trackStyle}>
              <span className={cn("block h-full w-full", preset.classes.chipBody)} style={bodyStyle} />
            </span>
          );
        })}

        {preset.sparks.map((spark, index) => {
          const trackStyle: SparkStyle = {
            left: spark.left,
            top: spark.top,
            width: `${spark.size}px`,
            height: `${spark.size}px`,
            animationDelay: `${spark.delayMs}ms`,
            animationDuration: `${spark.durationMs}ms`,
            "--spark-mid-x": spark.midX,
            "--spark-mid-y": spark.midY,
            "--spark-end-x": spark.endX,
            "--spark-end-y": spark.endY
          };

          const bodyStyle: CSSProperties = {
            backgroundColor: spark.color
          };

          return (
            <span key={`spark-${index}`} className={cn("absolute block opacity-0", preset.classes.sparkTrack)} style={trackStyle}>
              <span className={cn("block h-full w-full", preset.classes.sparkBody)} style={bodyStyle} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
