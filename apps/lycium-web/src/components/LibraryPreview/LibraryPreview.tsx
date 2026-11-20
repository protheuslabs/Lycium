"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Camera, Download, LoaderCircle, Pause, Play, RotateCcw, X } from "lucide-react";
import collectorImage from "../../assets/library-collector.webp";
import { LIBRARY } from "./libraryOrbit";
import { recordingMimeType, useLibraryScene } from "./useLibraryScene";
import "./libraryPreview.css";

function subscribeMotion(listener: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

export default function LibraryPreview() {
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia("(prefers-reduced-motion: reduce)").matches, () => true);
  const [mode, setMode] = useState<"auto" | "playing" | "paused">("auto");
  const [duration, setDuration] = useState<number>(LIBRARY.defaultDuration);
  const isPlaying = mode === "playing" || (mode === "auto" && !reducedMotion);
  const { canvasRef, state, phase, seek, recording, error, exportLoop, cancelRecording, saveStill } = useLibraryScene(isPlaying, duration);
  const ready = state === "ready";
  const canRecord = ready && Boolean(recordingMimeType()) && typeof HTMLCanvasElement.prototype.captureStream === "function";
  return (
    <main className="library-preview" data-state={state}>
      <Image className="library-preview-poster" src={collectorImage} alt="A collector's circular library filled with books, scrolls, and artifacts." fill priority sizes="100vw" />
      <canvas ref={canvasRef} className="library-preview-canvas" role="img" aria-label="Circular library camera preview" data-ready={ready} />
      <header className="library-preview-header">
        <Link href="/" title="Back to Lycium" aria-label="Back to Lycium"><ArrowLeft size={19} aria-hidden="true" /><span>Lycium</span></Link>
        <h1>Library Motion Study</h1>
        <span className="library-preview-angle">{LIBRARY.pitchDegrees}&deg;</span>
      </header>
      {state === "loading" && <div className="library-preview-status" role="status"><LoaderCircle size={21} aria-hidden="true" />Building the library</div>}
      {error && <div className="library-preview-error" role="alert">{error}</div>}
      <div className="library-preview-toolbar" aria-label="Library preview controls">
        <div className="library-preview-playback">
          <button type="button" disabled={!ready || recording} title={isPlaying ? "Pause" : "Play"} aria-label={isPlaying ? "Pause camera" : "Play camera"} onClick={() => setMode(isPlaying ? "paused" : "playing")}>
            {isPlaying ? <Pause size={19} aria-hidden="true" /> : <Play size={19} aria-hidden="true" />}
          </button>
          <button type="button" disabled={!ready || recording} title="Return to start" aria-label="Return to start" onClick={() => { setMode("paused"); seek(0); }}><RotateCcw size={18} aria-hidden="true" /></button>
        </div>
        <label className="library-preview-timeline">
          <input type="range" aria-label="Camera position" min="0" max="1" step="0.0001" value={phase} disabled={!ready || recording} onChange={(event) => { setMode("paused"); seek(Number(event.target.value)); }} />
          <output aria-label="Camera angle">{String(Math.round(phase * 360)).padStart(3, "0")}&deg;</output>
        </label>
        <label className="library-preview-duration"><span>Loop</span>
          <select aria-label="Loop duration" value={duration} disabled={recording} onChange={(event) => setDuration(Number(event.target.value))}>
            <option value="10">10 sec</option><option value="30">30 sec</option><option value="60">60 sec</option><option value="120">120 sec</option>
          </select>
        </label>
        <div className="library-preview-exports">
          <button type="button" disabled={!ready || recording} title="Save frame" aria-label="Save frame" onClick={saveStill}><Camera size={19} aria-hidden="true" /></button>
          <button type="button" disabled={!canRecord} title={recording ? "Cancel export" : canRecord ? "Export one video loop" : "Video export unavailable in this browser"} aria-label={recording ? "Cancel export" : "Export video loop"} onClick={recording ? cancelRecording : exportLoop}>
            {recording ? <X size={19} aria-hidden="true" /> : <Download size={19} aria-hidden="true" />}
          </button>
        </div>
        {recording && <output className="library-preview-recording" role="status">Exporting {Math.round(phase * 100)}%</output>}
      </div>
    </main>
  );
}
