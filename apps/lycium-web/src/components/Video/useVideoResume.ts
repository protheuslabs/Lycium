import { useEffect, useState, type RefObject } from "react";
import { createBrowserStorageRepository } from "@lycium/data-access";
import { formatPlaybackTime, isDirectVideoUrl, secondsValue, youtubeVideoId } from "./videoSource";

const storage = createBrowserStorageRepository();

type YouTubePlayer = {
  getCurrentTime: () => number;
  getDuration: () => number;
  seekTo: (seconds: number, allowSeekAhead: boolean) => void;
  destroy: () => void;
};

type YouTubeNamespace = {
  Player: new (element: HTMLIFrameElement, options: {
    events: {
      onReady: () => void;
      onStateChange: (event: { data: number }) => void;
    };
  }) => YouTubePlayer;
};

declare global {
  interface Window {
    YT?: YouTubeNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let youtubeApiPromise: Promise<YouTubeNamespace> | null = null;

function loadYouTubeApi(): Promise<YouTubeNamespace> {
  if (typeof window !== "undefined" && window.YT?.Player) return Promise.resolve(window.YT as YouTubeNamespace);
  if (youtubeApiPromise) return youtubeApiPromise;
  youtubeApiPromise = new Promise((resolve) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousReady?.();
      if (window.YT) resolve(window.YT as YouTubeNamespace);
    };
    if (!document.querySelector('script[src="https://www.youtube.com/iframe_api"]')) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      document.head.appendChild(script);
    }
  });
  return youtubeApiPromise;
}

type ResumeOptions = {
  courseKey?: string;
  sectionId?: string;
  videoKey?: string;
  url: string;
  clip?: { startSeconds?: number | string; endSeconds?: number | string };
  nativeRef: RefObject<HTMLVideoElement | null>;
  iframeRef: RefObject<HTMLIFrameElement | null>;
};

export default function useVideoResume({ courseKey, sectionId, videoKey, url, clip, nativeRef, iframeRef }: ResumeOptions) {
  const [resumeMessage, setResumeMessage] = useState("");
  const canPersist = Boolean(courseKey && sectionId && videoKey);
  const start = secondsValue(clip?.startSeconds) ?? 0;
  const end = secondsValue(clip?.endSeconds);

  useEffect(() => {
    setResumeMessage("");
    const saved = canPersist && courseKey && sectionId && videoKey ? storage.readVideoProgress(courseKey, sectionId, videoKey) : null;
    const savedPosition = saved?.positionSeconds ?? 0;
    let cancelled = false;
    let player: YouTubePlayer | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let lastSaved = -2;

    const persist = (position: number, duration?: number | null) => {
      if (!canPersist || !courseKey || !sectionId || !videoKey) return;
      if (!Number.isFinite(position) || position < 0 || Math.abs(position - lastSaved) < 1) return;
      lastSaved = position;
      storage.writeVideoProgress(courseKey, sectionId, videoKey, {
        positionSeconds: position,
        durationSeconds: duration ?? null,
        updatedAt: new Date().toISOString(),
      });
    };

    if (isDirectVideoUrl(url)) {
      const video = nativeRef.current;
      if (!video) return;
      const restore = () => {
        const position = savedPosition > start && (end === null || savedPosition < end) ? savedPosition : start;
        if (position > 0 && Number.isFinite(video.duration) && position < video.duration) video.currentTime = position;
        if (position > start) setResumeMessage(`Resume from ${formatPlaybackTime(position)}`);
      };
      const onTime = () => {
        if (end !== null && video.currentTime >= end) {
          video.pause();
          persist(end, video.duration);
          return;
        }
        persist(video.currentTime, video.duration);
      };
      video.addEventListener("loadedmetadata", restore);
      video.addEventListener("timeupdate", onTime);
      video.addEventListener("pause", onTime);
      if (video.readyState >= 1) restore();
      return () => {
        onTime();
        video.removeEventListener("loadedmetadata", restore);
        video.removeEventListener("timeupdate", onTime);
        video.removeEventListener("pause", onTime);
      };
    }

    if (!youtubeVideoId(url) || !iframeRef.current) return;
    void loadYouTubeApi().then((YT) => {
      if (cancelled || !iframeRef.current) return;
      player = new YT.Player(iframeRef.current, {
        events: {
          onReady: () => {
            if (cancelled) return;
            const position = savedPosition > start && (end === null || savedPosition < end) ? savedPosition : start;
            if (position > start) {
              player?.seekTo(position, true);
              setResumeMessage(`Resume from ${formatPlaybackTime(position)}`);
            }
            interval = setInterval(() => {
              if (player) persist(player.getCurrentTime(), player.getDuration());
            }, 2000);
          },
          onStateChange: (event) => {
            if (!player) return;
            const position = event.data === 0 ? start : player.getCurrentTime();
            persist(position, player.getDuration());
          },
        },
      });
    }).catch(() => setResumeMessage(""));
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      if (player) {
        persist(player.getCurrentTime(), player.getDuration());
        player.destroy();
      }
    };
  }, [canPersist, courseKey, sectionId, videoKey, url, start, end, nativeRef, iframeRef]);

  return resumeMessage;
}
