"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

import { MusicPlayerBar, type RepeatMode } from "@/components/music-player-bar";
import { assetFileUrl } from "@/lib/media-url";
import type { AssetRead } from "@/lib/types";
import { uploadedByDisplayName } from "@/lib/utils";

function timelineMs(asset: AssetRead): number {
  if (asset.captured_at) {
    const t = new Date(asset.captured_at).getTime();
    if (!Number.isNaN(t)) return t;
  }
  return new Date(asset.created_at).getTime();
}

export function sortAudioTracks(rows: AssetRead[]): AssetRead[] {
  return [...rows]
    .filter((a) => a.asset_type === "audio")
    .sort((a, b) => timelineMs(b) - timelineMs(a));
}

type MusicPlayerContextValue = {
  queue: AssetRead[];
  replaceQueue: (tracks: AssetRead[]) => void;
  /** Sets queue and starts playback at index (e.g. timeline month list); does not run on navigation by itself. */
  loadQueueAndPlay: (tracks: AssetRead[], index: number) => void;
  currentIndex: number;
  currentTrack: AssetRead | null;
  playerVisible: boolean;
  playing: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playTrackAt: (index: number) => void;
  togglePlay: () => void;
  goTrack: (delta: number) => void;
  cycleRepeat: () => void;
  setShuffle: React.Dispatch<React.SetStateAction<boolean>>;
  handleRowPlayClick: (index: number) => void;
  audioRef: RefObject<HTMLAudioElement | null>;
};

const MusicPlayerContext = createContext<MusicPlayerContextValue | null>(null);

export function useMusicPlayer(): MusicPlayerContextValue {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) {
    throw new Error("useMusicPlayer must be used within MusicPlayerProvider");
  }
  return ctx;
}

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const [queue, setQueue] = useState<AssetRead[]>([]);
  const [playerVisible, setPlayerVisible] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playGeneration, setPlayGeneration] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("off");

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlayRef = useRef(false);
  const playingIdRef = useRef<string | null>(null);

  const currentTrack = queue[currentIndex] ?? null;

  useEffect(() => {
    playingIdRef.current = currentTrack?.id ?? null;
  }, [currentTrack?.id]);

  const replaceQueue = useCallback((tracks: AssetRead[]) => {
    const keepId = playingIdRef.current;
    setQueue(tracks);
    setCurrentIndex((prev) => {
      if (tracks.length === 0) {
        setPlayerVisible(false);
        setPlaying(false);
        return 0;
      }
      if (keepId) {
        const ix = tracks.findIndex((t) => t.id === keepId);
        if (ix >= 0) return ix;
        setPlayerVisible(false);
        setPlaying(false);
        return 0;
      }
      return Math.min(prev, tracks.length - 1);
    });
  }, []);

  const loadQueueAndPlay = useCallback((tracks: AssetRead[], index: number) => {
    if (tracks.length === 0) return;
    pendingPlayRef.current = true;
    setPlayerVisible(true);
    setQueue(tracks);
    const i = Math.min(Math.max(0, index), tracks.length - 1);
    setCurrentIndex(i);
    setPlayGeneration((g) => g + 1);
  }, []);

  useEffect(() => {
    if (queue.length === 0) {
      setPlayerVisible(false);
      setCurrentIndex(0);
    }
  }, [queue.length]);

  useEffect(() => {
    const el = audioRef.current;
    if (el) el.loop = repeatMode === "one";
  }, [repeatMode, currentTrack?.id]);

  useEffect(() => {
    if (!pendingPlayRef.current || !playerVisible || !currentTrack) return;
    pendingPlayRef.current = false;
    void audioRef.current?.play().catch(() => {});
  }, [currentIndex, playerVisible, currentTrack?.id, playGeneration]);

  const goTrack = useCallback(
    (delta: number) => {
      const len = queue.length;
      if (len === 0) return;
      pendingPlayRef.current = true;
      if (shuffle && len > 1) {
        setCurrentIndex((i) => {
          let j = Math.floor(Math.random() * len);
          while (j === i) j = Math.floor(Math.random() * len);
          return j;
        });
        return;
      }
      setCurrentIndex((i) => (i + delta + len) % len);
    },
    [queue.length, shuffle],
  );

  const playTrackAt = useCallback((index: number) => {
    pendingPlayRef.current = true;
    setPlayerVisible(true);
    setCurrentIndex(index);
    setPlayGeneration((g) => g + 1);
  }, []);

  const togglePlay = useCallback(() => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play();
    else el.pause();
  }, []);

  const handleEnded = useCallback(() => {
    if (queue.length <= 1) return;
    pendingPlayRef.current = true;
    setCurrentIndex((i) => {
      const len = queue.length;
      if (shuffle && len > 1) {
        let j = Math.floor(Math.random() * len);
        while (j === i) j = Math.floor(Math.random() * len);
        return j;
      }
      return (i + 1) % len;
    });
  }, [queue.length, shuffle]);

  const cycleRepeat = useCallback(() => {
    setRepeatMode((m) => (m === "off" ? "all" : m === "all" ? "one" : "off"));
  }, []);

  const handleRowPlayClick = useCallback(
    (index: number) => {
      const isActive = playerVisible && index === currentIndex;
      if (isActive) {
        togglePlay();
        return;
      }
      playTrackAt(index);
    },
    [playerVisible, currentIndex, togglePlay, playTrackAt],
  );

  const value = useMemo<MusicPlayerContextValue>(
    () => ({
      queue,
      replaceQueue,
      loadQueueAndPlay,
      currentIndex,
      currentTrack,
      playerVisible,
      playing,
      shuffle,
      repeatMode,
      playTrackAt,
      togglePlay,
      goTrack,
      cycleRepeat,
      setShuffle,
      handleRowPlayClick,
      audioRef,
    }),
    [
      queue,
      replaceQueue,
      loadQueueAndPlay,
      currentIndex,
      currentTrack,
      playerVisible,
      playing,
      shuffle,
      repeatMode,
      playTrackAt,
      togglePlay,
      goTrack,
      cycleRepeat,
      handleRowPlayClick,
    ],
  );

  const showAudio =
    playerVisible && queue.length > 0 && currentTrack !== null;

  return (
    <MusicPlayerContext.Provider value={value}>
      {/* Mount `<audio>` before `children` so nested players see `audioRef` on first effect run */}
      {showAudio && currentTrack ? (
        <audio
          ref={audioRef}
          key={currentTrack.id}
          className="hidden"
          src={assetFileUrl(currentTrack.id)}
          preload="metadata"
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={handleEnded}
        />
      ) : null}
      {children}
    </MusicPlayerContext.Provider>
  );
}

/** Fixed bar over main column (clears 220px sidebar on md+); `<audio>` stays in `MusicPlayerProvider`. */
export function MusicPlayerDock() {
  const {
    queue,
    currentIndex,
    currentTrack,
    playerVisible,
    playing,
    shuffle,
    repeatMode,
    togglePlay,
    goTrack,
    cycleRepeat,
    setShuffle,
    audioRef,
  } = useMusicPlayer();

  const uploadedLabel =
    currentTrack && uploadedByDisplayName(currentTrack) !== "Unknown"
      ? `Uploaded by ${uploadedByDisplayName(currentTrack)}`
      : "";

  const playerSubtitle =
    currentTrack?.description?.trim() ||
    uploadedLabel ||
    (queue.length > 0
      ? `Track ${currentIndex + 1} of ${queue.length} · Family Media`
      : "");

  if (!playerVisible || queue.length === 0 || !currentTrack) return null;

  return (
    <footer className="fixed bottom-0 left-[220px] right-0 z-40 shrink-0 border-t border-white/10 bg-zinc-950/95 px-2 py-1.5 backdrop-blur-md md:px-4 md:py-2">
      <div className="mx-auto max-w-5xl">
        <MusicPlayerBar
          audioRef={audioRef}
          trackId={currentTrack.id}
          durationMsFallback={currentTrack.primary_version?.duration_ms ?? null}
          title={currentTrack.title ?? "Untitled track"}
          subtitle={playerSubtitle}
          playing={playing}
          onTogglePlay={togglePlay}
          onPrevious={() => goTrack(-1)}
          onNext={() => goTrack(1)}
          singleTrack={queue.length <= 1}
          shuffle={shuffle}
          onShuffleToggle={() => setShuffle((s) => !s)}
          repeatMode={repeatMode}
          onRepeatCycle={cycleRepeat}
        />
      </div>
    </footer>
  );
}
