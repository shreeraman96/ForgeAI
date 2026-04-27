"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Upload } from "lucide-react";
import { toast } from "sonner";

type RecorderState = "idle" | "requesting" | "recording" | "transcribing";

interface VoiceRecorderProps {
  onTranscription: (text: string) => void;
  disabled?: boolean;
}

/** Picks the best MIME type supported by the current browser. iOS requires audio/mp4. */
function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/mp4",               // iOS Safari 16+
    "audio/webm;codecs=opus",  // Chrome / Android
    "audio/webm",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

/** Maps a MIME type to a Whisper-supported file extension. */
function getExtension(mimeType: string): string {
  if (mimeType.includes("mp4") || mimeType.includes("m4a")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  if (mimeType.includes("wav")) return "wav";
  return "webm";
}

export function VoiceRecorder({ onTranscription, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const autoStopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportsMediaRecorder =
    typeof window !== "undefined" && typeof MediaRecorder !== "undefined";

  async function startRecording() {
    setState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      streamRef.current = stream;

      const mimeType = getBestMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Use recorder.mimeType (actual format chosen by browser) rather than
        // our requested mimeType — they can differ when getBestMimeType() returns "".
        const actualMimeType = recorder.mimeType || mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: actualMimeType });
        await transcribe(blob, actualMimeType);
      };

      recorder.start(250); // collect chunks every 250ms
      setState("recording");

      // Auto-stop after 60 seconds
      autoStopRef.current = setTimeout(() => stopRecording(), 60_000);
    } catch (err) {
      setState("idle");
      const isDenied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      if (isDenied) {
        toast.error(
          "Microphone access denied. Go to iOS Settings → Safari → Microphone to allow it."
        );
      } else {
        toast.error("Could not access microphone.");
      }
    }
  }

  function stopRecording() {
    if (autoStopRef.current) {
      clearTimeout(autoStopRef.current);
      autoStopRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setState("transcribing");
  }

  async function transcribe(blob: Blob, mimeType: string) {
    try {
      const ext = getExtension(mimeType);
      const formData = new FormData();
      formData.append("audio", blob, `recording.${ext}`);

      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");
      if (data.text?.trim()) {
        onTranscription(data.text.trim());
      } else {
        toast.error("No speech detected. Please try again.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Transcription failed. Please try again.");
    } finally {
      setState("idle");
    }
  }

  // Fallback: file-based upload for browsers without MediaRecorder (older iOS)
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setState("transcribing");
    await transcribe(file, file.type);
    e.target.value = "";
  }

  // No MediaRecorder support — render a file-upload fallback instead
  if (!supportsMediaRecorder) {
    return (
      <>
        <input
          ref={fileInputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={handleFileUpload}
          aria-hidden="true"
          tabIndex={-1}
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          disabled={disabled || state === "transcribing"}
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload audio for transcription"
          className="flex-shrink-0"
        >
          <Upload className="h-4 w-4" />
        </Button>
      </>
    );
  }

  const isRecording = state === "recording";
  const isBusy = state === "requesting" || state === "transcribing";

  return (
    <Button
      type="button"
      size="icon"
      variant={isRecording ? "destructive" : "ghost"}
      disabled={disabled || isBusy}
      onClick={isRecording ? stopRecording : startRecording}
      aria-label={isRecording ? "Stop recording" : "Start voice recording"}
      className="flex-shrink-0 relative"
    >
      {isRecording ? (
        <Square className="h-4 w-4" />
      ) : (
        <Mic className={`h-4 w-4 ${isBusy ? "animate-pulse" : ""}`} />
      )}
      {/* Pulse ring while recording */}
      {isRecording && (
        <span className="absolute inset-0 rounded-md animate-ping bg-destructive/30 pointer-events-none" />
      )}
    </Button>
  );
}
