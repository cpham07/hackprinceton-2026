import { useCallback, useEffect, useRef, useState } from "react";
import { pickRecordingMimeType } from "../services/transcriptionClient";

export type RecorderStatus = "idle" | "requesting" | "recording" | "error";

export interface Recording {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface UseVoiceRecorderOptions {
  /** Called once when the player stops a recording. Never called automatically. */
  onRecorded: (recording: Recording) => void;
}

/**
 * MediaRecorder wrapper. Recording starts and stops only by explicit calls;
 * silence, pauses and repetitions never end it. Mic tracks are always released.
 */
export function useVoiceRecorder({ onRecorded }: UseVoiceRecorderOptions) {
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const startTokenRef = useRef(0);
  const onRecordedRef = useRef(onRecorded);
  onRecordedRef.current = onRecorded;

  const supported =
    typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== "undefined";

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const fail = useCallback(
    (message: string) => {
      cancelledRef.current = true;
      const recorder = recorderRef.current;
      recorderRef.current = null;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch {
          /* already stopped */
        }
      }
      releaseStream();
      setError(message);
      setStatus("error");
    },
    [releaseStream],
  );

  const start = useCallback(async () => {
    if (status === "recording" || status === "requesting") return;
    if (!supported) {
      setError("This browser can't record audio. Please type your reply instead.");
      setStatus("error");
      return;
    }
    setError(null);
    setStatus("requesting");
    const token = ++startTokenRef.current;

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      if (token !== startTokenRef.current) return;
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError("Microphone access was denied. Allow it in your browser's site settings, or type your reply instead.");
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setError("No microphone was found. Connect one, or type your reply instead.");
      } else if (name === "NotReadableError") {
        setError("The microphone is busy or unavailable. Close other apps using it, or type your reply instead.");
      } else {
        setError("Could not start the microphone. You can type your reply instead.");
      }
      setStatus("error");
      return;
    }

    // Unmounted, cancelled or superseded while the permission prompt was open.
    if (token !== startTokenRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    try {
      const mimeType = pickRecordingMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      streamRef.current = stream;
      recorderRef.current = recorder;
      chunksRef.current = [];
      cancelledRef.current = false;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => fail("Recording failed. Please try again or type your reply.");
      recorder.onstop = () => {
        const durationMs = Date.now() - startedAtRef.current;
        const type = recorder.mimeType || mimeType || "audio/webm";
        const chunks = chunksRef.current;
        chunksRef.current = [];
        releaseStream();
        if (recorderRef.current === recorder) recorderRef.current = null;
        if (cancelledRef.current) return;
        if (chunks.length === 0) {
          setError("Nothing was recorded. Please try again.");
          setStatus("error");
          return;
        }
        setStatus("idle");
        onRecordedRef.current({ blob: new Blob(chunks, { type }), mimeType: type, durationMs });
      };

      startedAtRef.current = Date.now();
      setElapsedMs(0);
      timerRef.current = window.setInterval(() => setElapsedMs(Date.now() - startedAtRef.current), 250);
      recorder.start();
      setStatus("recording");
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      fail("Could not start recording in this browser. You can type your reply instead.");
    }
  }, [status, supported, fail, releaseStream]);

  /** Player-initiated stop: the recording is delivered through onRecorded. */
  const stop = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }, []);

  /** Discard whatever is in progress without delivering it. */
  const cancel = useCallback(() => {
    startTokenRef.current++;
    cancelledRef.current = true;
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        /* ignore */
      }
    }
    recorderRef.current = null;
    releaseStream();
    chunksRef.current = [];
    setStatus("idle");
  }, [releaseStream]);

  const dismissError = useCallback(() => {
    setError(null);
    setStatus("idle");
  }, []);

  // Unmount: stop everything, release the mic, deliver nothing.
  useEffect(() => cancel, [cancel]);

  return { status, error, elapsedMs, supported, start, stop, cancel, dismissError };
}
