// AI-assisted: Video block with loading state and simple spinner.

import { useState } from "react";
import "./VideoBlock.css";

type VideoBlockProps = {
  url: string;
};

export default function VideoBlock({ url }: VideoBlockProps) {
  const [loaded, setLoaded] = useState(false);

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
        src={url}
        title="Video content"
        frameBorder={0}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
        onLoad={handleLoad}
      ></iframe>
    </div>
  );
}
