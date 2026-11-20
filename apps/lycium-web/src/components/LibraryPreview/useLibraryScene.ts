import { useCallback, useEffect, useRef, useState } from "react";
import type { LibraryRenderer } from "./libraryRenderer";
import { wrapPhase } from "./libraryOrbit";

type Recording = {
  recorder: MediaRecorder;
  stream: MediaStream;
  startTime: number | null;
  duration: number;
  previousPhase: number;
  discard: boolean;
  stopped: boolean;
};

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 5000);
}

export function recordingMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]
    .find((type) => MediaRecorder.isTypeSupported(type)) ?? null;
}

export function useLibraryScene(isPlaying: boolean, duration: number) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<LibraryRenderer | null>(null);
  const phaseRef = useRef(0);
  const playingRef = useRef(isPlaying);
  const durationRef = useRef(duration);
  const recordingRef = useRef<Recording | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [phase, setPhase] = useState(0);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { playingRef.current = isPlaying; }, [isPlaying]);
  useEffect(() => { durationRef.current = duration; }, [duration]);

  const cancelRecording = useCallback(() => {
    const current = recordingRef.current;
    if (!current || current.stopped) return;
    current.discard = true;
    current.stopped = true;
    if (current.recorder.state !== "inactive") current.recorder.stop();
    current.stream.getTracks().forEach((track) => track.stop());
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    let frame = 0;
    let previous: number | null = null;
    let lastReport = 0;
    let renderer: LibraryRenderer | null = null;
    const tick = (now: number) => {
      if (controller.signal.aborted || !renderer) return;
      const delta = previous === null ? 0 : Math.min((now - previous) / 1000, 0.08);
      previous = now;
      if (!document.hidden) {
        const activeRecording = recordingRef.current;
        if (activeRecording && !activeRecording.stopped) {
          activeRecording.startTime ??= now;
          const next = (now - activeRecording.startTime) / 1000 / activeRecording.duration;
          if (next >= 1) {
            activeRecording.stopped = true;
            activeRecording.recorder.stop();
            activeRecording.stream.getTracks().forEach((track) => track.stop());
          } else {
            phaseRef.current = next;
          }
        } else if (!activeRecording && playingRef.current) {
          phaseRef.current = wrapPhase(phaseRef.current + delta / durationRef.current);
        }
        renderer.render(phaseRef.current);
        if (now - lastReport > 100) {
          lastReport = now;
          setPhase(phaseRef.current);
        }
      }
      frame = requestAnimationFrame(tick);
    };
    const onVisibility = () => {
      previous = null;
      if (document.hidden && recordingRef.current) {
        cancelRecording();
        setError("Export cancelled because the preview was hidden. Keep this tab visible during export.");
      }
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      cancelAnimationFrame(frame);
      cancelRecording();
      setState("error");
      setError("The 3D preview lost its graphics connection. Reload to try again.");
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    document.addEventListener("visibilitychange", onVisibility);
    import("./libraryRenderer").then(({ createLibraryRenderer }) => createLibraryRenderer(canvas, controller.signal))
      .then((created) => {
        if (controller.signal.aborted) { created.dispose(); return; }
        renderer = created;
        engineRef.current = created;
        created.render(phaseRef.current);
        setState("ready");
        frame = requestAnimationFrame(tick);
      }).catch((reason: unknown) => {
        if (controller.signal.aborted) return;
        console.warn("Library preview unavailable:", reason);
        setState("error");
        setError("The 3D preview couldn't start. Your browser may not support WebGL 2.");
      });
    return () => {
      controller.abort();
      cancelAnimationFrame(frame);
      cancelRecording();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      document.removeEventListener("visibilitychange", onVisibility);
      renderer?.dispose();
      engineRef.current = null;
    };
  }, [cancelRecording]);

  const seek = useCallback((value: number) => {
    if (recordingRef.current) return;
    phaseRef.current = Math.max(0, Math.min(1, value));
    engineRef.current?.render(phaseRef.current);
    setPhase(phaseRef.current);
  }, []);

  const saveStill = useCallback(() => {
    engineRef.current?.canvas.toBlob((blob) => {
      if (blob) download(blob, `lycium-library-${Math.round(phaseRef.current * 360)}deg.png`);
    }, "image/png");
  }, []);

  const exportLoop = useCallback(() => {
    const canvas = engineRef.current?.canvas;
    const mimeType = recordingMimeType();
    if (!canvas || !mimeType || !canvas.captureStream || recordingRef.current) return;
    setError("");
    let stream: MediaStream | null = null;
    try {
      const previousPhase = phaseRef.current;
      engineRef.current?.render(0);
      stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
      const chunks: Blob[] = [];
      const current: Recording = { recorder, stream, startTime: null, duration: durationRef.current, previousPhase, discard: false, stopped: false };
      recordingRef.current = current;
      phaseRef.current = 0;
      setRecording(true);
      recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      recorder.onerror = () => {
        current.discard = true;
        setError("The browser couldn't finish the video export. Try a shorter loop.");
        cancelRecording();
      };
      recorder.onstop = () => {
        current.stream.getTracks().forEach((track) => track.stop());
        if (!current.discard && chunks.length) {
          const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
          download(new Blob(chunks, { type: mimeType }), `lycium-library-${current.duration}s-loop.${extension}`);
        }
        recordingRef.current = null;
        phaseRef.current = current.previousPhase;
        engineRef.current?.render(phaseRef.current);
        setPhase(phaseRef.current);
        setRecording(false);
      };
      recorder.start(1000);
    } catch (reason) {
      console.warn("Library video export unavailable:", reason);
      stream?.getTracks().forEach((track) => track.stop());
      recordingRef.current = null;
      setRecording(false);
      setError("Video export isn't available in this browser. You can still save a frame.");
    }
  }, [cancelRecording]);

  return { canvasRef, state, phase, seek, recording, error, exportLoop, cancelRecording, saveStill };
}
