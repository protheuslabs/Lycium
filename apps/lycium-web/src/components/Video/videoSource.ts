export function secondsValue(value?: number | string): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : null;
}

export function youtubeVideoId(url: string): string | null {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    if (hostname === "youtu.be") return parsedUrl.pathname.split("/").filter(Boolean)[0] ?? null;
    if (!hostname.endsWith("youtube.com")) return null;
    if (parsedUrl.pathname === "/watch") return parsedUrl.searchParams.get("v");
    const parts = parsedUrl.pathname.split("/").filter(Boolean);
    return parts[0] === "embed" || parts[0] === "shorts" ? parts[1] ?? null : null;
  } catch {
    return null;
  }
}

export function isDirectVideoUrl(url: string): boolean {
  return /^(blob:|data:video\/)/i.test(url) || /\.(mp4|webm|ogg|ogv|mov|m4v)(?:$|[?#])/i.test(url);
}

export function videoUrlWithClip(url: string, clip?: { startSeconds?: number | string; endSeconds?: number | string }): string {
  const startSeconds = secondsValue(clip?.startSeconds);
  const endSeconds = secondsValue(clip?.endSeconds);
  if (startSeconds === null && endSeconds === null) return url;
  try {
    const parsedUrl = new URL(url);
    const youtubeId = youtubeVideoId(url);
    if (youtubeId) {
      const embedUrl = new URL(`https://www.youtube.com/embed/${youtubeId}`);
      if (startSeconds !== null) embedUrl.searchParams.set("start", String(startSeconds));
      if (endSeconds !== null && (startSeconds === null || endSeconds > startSeconds)) embedUrl.searchParams.set("end", String(endSeconds));
      return embedUrl.toString();
    }
    parsedUrl.hash = `t=${startSeconds ?? 0}${endSeconds !== null ? `,${endSeconds}` : ""}`;
    return parsedUrl.toString();
  } catch {
    return url;
  }
}

export function formatPlaybackTime(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
