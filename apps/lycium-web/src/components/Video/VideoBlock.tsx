import { useState } from "react";

type VideoClip = {
  startSeconds?: number | string;
  endSeconds?: number | string;
};

type VideoBlockProps = {
  url: string;
  title?: string;
  clip?: VideoClip;
};

function secondsValue(value?: number | string): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.floor(parsed);
    }
  }
  return null;
}

function youtubeVideoId(parsedUrl: URL): string | null {
  const hostname = parsedUrl.hostname.replace(/^www\./, "");
  if (hostname === "youtu.be") {
    return parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
  }
  if (!hostname.endsWith("youtube.com")) {
    return null;
  }
  if (parsedUrl.pathname === "/watch") {
    return parsedUrl.searchParams.get("v");
  }
  const parts = parsedUrl.pathname.split("/").filter(Boolean);
  if (parts[0] === "embed" || parts[0] === "shorts") {
    return parts[1] ?? null;
  }
  return null;
}

function videoUrlWithClip(url: string, clip?: VideoClip): string {
  const startSeconds = secondsValue(clip?.startSeconds);
  const endSeconds = secondsValue(clip?.endSeconds);

  if (startSeconds === null && endSeconds === null) {
    return url;
  }

  try {
    const parsedUrl = new URL(url);
    const youtubeId = youtubeVideoId(parsedUrl);

    if (youtubeId) {
      const embedUrl = new URL(`https://www.youtube.com/embed/${youtubeId}`);
      if (startSeconds !== null) embedUrl.searchParams.set("start", String(startSeconds));
      if (endSeconds !== null && (startSeconds === null || endSeconds > startSeconds)) {
        embedUrl.searchParams.set("end", String(endSeconds));
      }
      return embedUrl.toString();
    }

    parsedUrl.hash = `t=${startSeconds ?? 0}${endSeconds !== null ? `,${endSeconds}` : ""}`;
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

export default function VideoBlock({ url, title = "Video content", clip }: VideoBlockProps) {
  const [loaded, setLoaded] = useState(false);
  const clippedUrl = videoUrlWithClip(url, clip);

  function handleLoad() {
    setLoaded(true);
  }

  return (
    <div className="video-wrapper">
      {!loaded && (
        <div className="video-loading">
          <div className="video-spinner" />
          <span>Loading video…</span>
        </div>
      )}

      <iframe
        className={`video-iframe ${loaded ? "video-iframe-visible" : ""}`}
        width="560"
        height="315"
        src={clippedUrl}
        title={title}
        frameBorder={0}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={handleLoad}
      ></iframe>
    </div>
  );
}
