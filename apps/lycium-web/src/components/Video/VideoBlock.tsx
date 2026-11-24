import { useEffect, useRef, useState } from "react";
import { useClientMounted } from "../../hooks/useClientMounted";
import useVideoResume from "./useVideoResume";
import { isDirectVideoUrl, videoUrlWithClip, youtubeVideoId } from "./videoSource";

type VideoClip = { startSeconds?: number | string; endSeconds?: number | string };
type CaptionTrack = { src: string; label: string; language: string; default?: boolean };

type VideoBlockProps = {
  url: string;
  title?: string;
  clip?: VideoClip;
  courseKey?: string;
  sectionId?: string;
  videoKey?: string;
  transcript?: string;
  transcriptUrl?: string;
  captionTracks?: CaptionTrack[];
};

export default function VideoBlock({ url, title = "Video content", clip, courseKey, sectionId, videoKey, transcript, transcriptUrl, captionTracks = [] }: VideoBlockProps) {
  const [loaded, setLoaded] = useState(false);
  const mounted = useClientMounted();
  const nativeRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resumeMessage = useVideoResume({ courseKey, sectionId, videoKey, url, clip, nativeRef, iframeRef });
  const clippedUrl = videoUrlWithClip(url, clip);
  const isNative = isDirectVideoUrl(url);
  const playerUrl = (() => {
    if (!youtubeVideoId(url)) return clippedUrl;
    try {
      const parsed = new URL(clippedUrl);
      parsed.searchParams.set("enablejsapi", "1");
      parsed.searchParams.set("playsinline", "1");
      if (mounted) parsed.searchParams.set("origin", window.location.origin);
      return parsed.toString();
    } catch {
      return clippedUrl;
    }
  })();

  useEffect(() => setLoaded(false), [url]);

  return (
    <div className="video-shell">
      <div className="video-wrapper">
        {!loaded && <div className="video-loading"><div className="video-spinner" /><span>Loading video…</span></div>}
        {isNative ? (
          <video
            ref={nativeRef}
            className={`video-native ${loaded ? "video-iframe-visible" : ""}`}
            src={url}
            controls
            preload="metadata"
            aria-label={title}
            onLoadedMetadata={() => setLoaded(true)}
          >
            {captionTracks.filter((track) => track.src && track.label && track.language).map((track) => (
              <track key={`${track.language}-${track.src}`} kind="captions" src={track.src} label={track.label} srcLang={track.language} default={track.default} />
            ))}
          </video>
        ) : (
          <iframe
            ref={iframeRef}
            className={`video-iframe ${loaded ? "video-iframe-visible" : ""}`}
            width="560"
            height="315"
            src={mounted ? playerUrl : clippedUrl}
            title={title}
            frameBorder={0}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            onLoad={() => setLoaded(true)}
          />
        )}
      </div>
      {resumeMessage && <p className="video-resume-message" role="status">{resumeMessage}</p>}
      {(transcript || transcriptUrl) && (
        <details className="video-transcript">
          <summary>Transcript</summary>
          {transcript && <div className="video-transcript-content">{transcript}</div>}
          {transcriptUrl && /^https?:\/\//i.test(transcriptUrl) && <a href={transcriptUrl} target="_blank" rel="noreferrer">Open transcript</a>}
        </details>
      )}
    </div>
  );
}
