"use client";

import type { RefObject } from "react";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Music,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Shuffle,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export type RepeatMode = "off" | "all" | "one";

export type MusicPlayerBarProps = {
  audioRef: RefObject<HTMLAudioElement | null>;
  /** Key when track changes — resets progress listeners */
  trackId: string;
  /** From API when browser reports unknown duration (NaN) until metadata loads */
  durationMsFallback?: number | null;
  title: string;
  subtitle: string;
  playing: boolean;
  onTogglePlay: () => void;
  onPrevious: () => void;
  onNext: () => void;
  singleTrack: boolean;
  shuffle: boolean;
  onShuffleToggle: () => void;
  repeatMode: RepeatMode;
  onRepeatCycle: () => void;
};

export function MusicPlayerBar({
  audioRef,
  trackId,
  durationMsFallback = null,
  title,
  subtitle,
  playing,
  onTogglePlay,
  onPrevious,
  onNext,
  singleTrack,
  shuffle,
  onShuffleToggle,
  repeatMode,
  onRepeatCycle,
}: MusicPlayerBarProps) {
  const [currentSec, setCurrentSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [volume, setVolume] = useState(1);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const scrubbingRef = useRef(false);

  useLayoutEffect(() => {
    const el = audioRef.current;
    if (!el) return;

    const fallbackSec =
      durationMsFallback != null && durationMsFallback > 0
        ? durationMsFallback / 1000
        : 0;

    const syncTime = () => setCurrentSec(el.currentTime);
    const syncDur = () => {
      const d = el.duration;
      if (Number.isFinite(d) && d > 0) {
        setDurationSec(d);
        return;
      }
      if (fallbackSec > 0) setDurationSec(fallbackSec);
      else setDurationSec(0);
    };

    el.volume = volume;
    syncTime();
    syncDur();

    el.addEventListener("timeupdate", syncTime);
    el.addEventListener("loadedmetadata", syncDur);
    el.addEventListener("durationchange", syncDur);
    el.addEventListener("loadeddata", syncDur);
    el.addEventListener("canplay", syncDur);
    el.addEventListener("progress", syncDur);
    el.addEventListener("playing", syncDur);
    el.addEventListener("ended", syncTime);

    return () => {
      el.removeEventListener("timeupdate", syncTime);
      el.removeEventListener("loadedmetadata", syncDur);
      el.removeEventListener("durationchange", syncDur);
      el.removeEventListener("loadeddata", syncDur);
      el.removeEventListener("canplay", syncDur);
      el.removeEventListener("progress", syncDur);
      el.removeEventListener("playing", syncDur);
      el.removeEventListener("ended", syncTime);
    };
  }, [audioRef, trackId, durationMsFallback]);

  useLayoutEffect(() => {
    const el = audioRef.current;
    if (el) el.volume = volume;
  }, [volume, audioRef]);

  const progress = useMemo(() => {
    if (!durationSec || !Number.isFinite(durationSec)) return 0;
    return Math.min(100, Math.max(0, (currentSec / durationSec) * 100));
  }, [currentSec, durationSec]);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const el = audioRef.current;
      const bar = progressBarRef.current;
      if (!el || !bar || !durationSec) return;
      const rect = bar.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      el.currentTime = ratio * durationSec;
      setCurrentSec(el.currentTime);
    },
    [audioRef, durationSec],
  );

  const onProgressPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      scrubbingRef.current = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const onProgressPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!scrubbingRef.current) return;
      seekFromClientX(e.clientX);
    },
    [seekFromClientX],
  );

  const onProgressPointerUp = useCallback(() => {
    scrubbingRef.current = false;
  }, []);

  const muted = volume === 0;

  const repeatIconClass =
    repeatMode === "off"
      ? "text-white/45"
      : repeatMode === "one"
        ? "text-emerald-400"
        : "text-emerald-400";

  return (
    <div className="rounded-xl border border-white/10 bg-[#121212] px-2 py-1.5 shadow-lg shadow-black/30 md:px-3">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 sm:flex-nowrap">
        {/* Transport */}
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              "h-7 w-7 rounded-full text-white/70 hover:bg-white/10 hover:text-white",
              shuffle && "text-emerald-400",
            )}
            aria-label={shuffle ? "Shuffle on" : "Shuffle"}
            aria-pressed={shuffle}
            onClick={onShuffleToggle}
          >
            <Shuffle className="h-3.5 w-3.5" strokeWidth={2} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-white/90 hover:bg-white/10"
            aria-label="Previous track"
            onClick={onPrevious}
            disabled={singleTrack}
          >
            <SkipBack className="h-4 w-4 fill-current" />
          </Button>
          <Button
            type="button"
            size="icon"
            className="mx-0.5 h-9 w-9 rounded-full bg-white text-[#121212] hover:bg-white/90"
            aria-label={playing ? "Pause" : "Play"}
            onClick={onTogglePlay}
          >
            {playing ? (
              <Pause className="h-4 w-4 fill-current" />
            ) : (
              <Play className="h-4 w-4 ml-0.5 fill-current" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-white/90 hover:bg-white/10"
            aria-label="Next track"
            onClick={onNext}
            disabled={singleTrack}
          >
            <SkipForward className="h-4 w-4 fill-current" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7 rounded-full hover:bg-white/10", repeatIconClass)}
            aria-label={
              repeatMode === "off"
                ? "Repeat off"
                : repeatMode === "one"
                  ? "Repeat one"
                  : "Repeat all"
            }
            onClick={onRepeatCycle}
          >
            {repeatMode === "one" ? (
              <Repeat1 className="h-3.5 w-3.5" strokeWidth={2} />
            ) : (
              <Repeat className="h-3.5 w-3.5" strokeWidth={2} />
            )}
          </Button>
        </div>

        {/* Track meta */}
        <div className="flex min-w-0 shrink items-center gap-2 sm:max-w-[28%] lg:max-w-[32%]">
          <div
            className="relative h-8 w-8 shrink-0 overflow-hidden rounded bg-gradient-to-br from-violet-600 via-fuchsia-600 to-pink-500 shadow-inner"
            aria-hidden
          >
            <Music className="absolute inset-0 m-auto h-4 w-4 text-white/90 drop-shadow" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold leading-tight text-white">{title}</p>
            <p className="truncate text-[10px] leading-tight text-white/55">{subtitle}</p>
          </div>
        </div>

        {/* Scrubber — flex-nowrap keeps current | bar | duration grouped */}
        <div className="flex min-h-[1.25rem] min-w-0 flex-1 basis-[min(100%,18rem)] flex-nowrap items-center gap-1.5 text-[10px] tabular-nums text-white/45">
          <span className="hidden shrink-0 sm:inline">{formatClock(currentSec)}</span>
          <div
            ref={progressBarRef}
            role="slider"
            tabIndex={0}
            aria-valuenow={Math.round(progress)}
            aria-valuemin={0}
            aria-valuemax={100}
            className="group relative h-1 min-w-[4rem] flex-1 cursor-pointer rounded-full bg-white/15 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-emerald-500"
            onPointerDown={onProgressPointerDown}
            onPointerMove={onProgressPointerMove}
            onPointerUp={onProgressPointerUp}
            onPointerCancel={onProgressPointerUp}
            onKeyDown={(e) => {
              const el = audioRef.current;
              if (!el || !durationSec) return;
              const step = durationSec * 0.05;
              if (e.key === "ArrowRight") {
                el.currentTime = Math.min(durationSec, el.currentTime + step);
              } else if (e.key === "ArrowLeft") {
                el.currentTime = Math.max(0, el.currentTime - step);
              }
            }}
          >
            <div
              className="pointer-events-none absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-[width] duration-150 ease-linear group-hover:bg-emerald-400"
              style={{ width: `${progress}%` }}
            />
            <div
              className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity group-hover:opacity-100"
              style={{ left: `calc(${progress}% - 4px)` }}
            />
          </div>
          <span className="hidden shrink-0 sm:inline">{formatClock(durationSec)}</span>
        </div>

        {/* Volume */}
        <div className="ml-auto flex shrink-0 items-center gap-1 sm:ml-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 rounded-full text-white/70 hover:bg-white/10"
            aria-label={muted ? "Unmute" : "Mute"}
            onClick={() => setVolume((v) => (v === 0 ? 0.8 : 0))}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={muted ? 0 : volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="hidden w-16 cursor-pointer accent-emerald-500 sm:block md:w-20"
            aria-label="Volume"
          />
        </div>
      </div>
    </div>
  );
}
