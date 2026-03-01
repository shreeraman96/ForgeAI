"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createSilenceDetector, type SilenceDetector } from "@/lib/audio/silence-detector";

export type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";
export type TtsMode = "browser" | "openai";

/** Picks the best MIME type supported by the current browser. iOS requires audio/mp4. */
function getBestMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = [
    "audio/webm;codecs=opus",  // Chrome / Android (native, best Whisper compat)
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",               // iOS Safari 16+ (fallback)
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

interface UseVoiceConversationOptions {
  /** Called with transcribed text — should send the message through the chat pipeline and return the full response. */
  onSendMessage: (message: string) => Promise<string>;
  ttsMode: TtsMode;
  enabled: boolean;
}

export interface UseVoiceConversationReturn {
  state: VoiceState;
  start: () => void;
  stop: () => void;
  interrupt: () => void;
  currentTranscript: string;
  audioLevel: number;
}

export function useVoiceConversation({
  onSendMessage,
  ttsMode,
  enabled,
}: UseVoiceConversationOptions): UseVoiceConversationReturn {
  const [state, setState] = useState<VoiceState>("idle");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);

  // Use `string` (not `VoiceState`) so TS doesn't narrow inside async closures
  // where the ref can be mutated externally by stop().
  const stateRef = useRef<string>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceDetectorRef = useRef<SilenceDetector | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const levelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationRef = useRef(0);
  const ttsModeRef = useRef(ttsMode);
  const onSendMessageRef = useRef(onSendMessage);

  // Keep refs in sync
  useEffect(() => { ttsModeRef.current = ttsMode; }, [ttsMode]);
  useEffect(() => { onSendMessageRef.current = onSendMessage; }, [onSendMessage]);

  function updateState(newState: VoiceState) {
    stateRef.current = newState;
    setState(newState);
  }

  const startListening = useCallback(() => {
    const stream = streamRef.current;
    if (!stream) return;

    // Increment generation — any in-flight onstop from a previous recorder will
    // see a stale generation and bail out instead of interfering.
    const gen = ++generationRef.current;

    // Detach handlers from old recorder so stopping it won't trigger onstop logic
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      if (mediaRecorderRef.current.state === "recording") {
        try { mediaRecorderRef.current.stop(); } catch (e) { /* ignore */ }
      }
    }
    silenceDetectorRef.current?.stop();

    const mimeType = getBestMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    mediaRecorderRef.current = recorder;
    const recordingStartTime = Date.now();
    let recordedBlob: Blob | null = null;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedBlob = e.data;
    };

    recorder.onstop = async () => {
      // Bail out if this handler belongs to a stale generation
      if (gen !== generationRef.current) return;
      if (stateRef.current === "idle") return; // stopped by user exit

      // Ignore recordings shorter than 500ms — likely just noise
      const duration = Date.now() - recordingStartTime;
      if (duration < 500) {
        updateState("listening");
        startListening();
        return;
      }

      // Without timeslice, ondataavailable fires once with a single complete blob
      if (!recordedBlob || recordedBlob.size < 1000) {
        // Too small — probably no real audio captured
        updateState("listening");
        startListening();
        return;
      }

      updateState("transcribing");

      try {
        const actualMimeType = recorder.mimeType || mimeType || "audio/webm";
        const ext = actualMimeType.includes("mp4") || actualMimeType.includes("m4a")
          ? "mp4"
          : actualMimeType.includes("ogg")
          ? "ogg"
          : "webm";
        const formData = new FormData();
        formData.append("audio", recordedBlob, `recording.${ext}`);

        abortControllerRef.current = new AbortController();
        const res = await fetch("/api/transcribe", {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current.signal,
        });

        if (gen !== generationRef.current) return; // interrupted during fetch

        if (!res.ok) throw new Error("Transcription failed");
        const { text } = await res.json();

        if (!text?.trim()) {
          toast.error("No speech detected. Listening again...");
          if (stateRef.current !== "idle" && gen === generationRef.current) {
            updateState("listening");
            startListening();
          }
          return;
        }

        setCurrentTranscript(text.trim());
        updateState("thinking");

        // Send through existing chat pipeline
        const responseText = await onSendMessageRef.current(text.trim());

        if (gen !== generationRef.current) return; // interrupted during chat
        if (stateRef.current === "idle") return; // user exited during thinking

        // Speak the response
        updateState("speaking");
        await speakResponse(responseText);

        // Only resume listening if we're still in "speaking" state AND
        // this generation is still current. If user interrupted, state is
        // already "listening" and interrupt() already called startListening().
        if (stateRef.current !== "speaking" || gen !== generationRef.current) return;

        // Resume listening after speaking
        updateState("listening");
        // iOS needs a delay after TTS releases the audio session
        setTimeout(() => {
          if (stateRef.current === "listening" && gen === generationRef.current) {
            startListening();
          }
        }, 400);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        if (gen !== generationRef.current) return;
        console.error("Voice conversation error:", error);
        toast.error("Something went wrong. Listening again...");
        if (stateRef.current !== "idle") {
          updateState("listening");
          startListening();
        }
      }
    };

    // No timeslice — ondataavailable fires once on stop() with a single valid blob.
    recorder.start();
    updateState("listening");

    // Set up silence detection to auto-stop recording
    const detector = createSilenceDetector({ silenceDuration: 2000 });
    detector.onSilence = () => {
      if (gen === generationRef.current && stateRef.current === "listening" && mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        silenceDetectorRef.current?.stop();
      }
    };
    detector.start(stream);
    silenceDetectorRef.current = detector;
  }, []);

  async function speakResponse(text: string): Promise<void> {
    if (!text.trim()) return;

    if (ttsModeRef.current === "openai") {
      return speakWithOpenAI(text);
    }
    return speakWithBrowser(text);
  }

  function speakWithBrowser(text: string): Promise<void> {
    return new Promise((resolve) => {
      if (typeof window === "undefined" || !window.speechSynthesis) {
        resolve();
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "en-US";
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find((v) => v.lang.startsWith("en"));
      if (englishVoice) utterance.voice = englishVoice;
      utterance.rate = 0.95;

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      window.speechSynthesis.speak(utterance);
    });
  }

  async function speakWithOpenAI(text: string): Promise<void> {
    try {
      abortControllerRef.current = new AbortController();
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
        signal: abortControllerRef.current.signal,
      });

      if (!res.ok) {
        // Fallback to browser TTS
        return speakWithBrowser(text);
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      return new Promise((resolve) => {
        if (!audioElementRef.current) {
          audioElementRef.current = new Audio();
        }
        const audio = audioElementRef.current;
        audio.src = url;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          resolve();
        };
        audio.play().catch(() => {
          URL.revokeObjectURL(url);
          resolve();
        });
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Fallback to browser TTS
      return speakWithBrowser(text);
    }
  }

  const start = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      streamRef.current = stream;

      // Create Audio element during user gesture (iOS requirement)
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio();
      }

      // Start polling audio level for UI visualization
      levelPollRef.current = setInterval(() => {
        const level = silenceDetectorRef.current?.getLevel() ?? 0;
        setAudioLevel(Math.min(level * 10, 1)); // Scale up for visual effect
      }, 100);

      startListening();
    } catch (err) {
      const isDenied =
        err instanceof DOMException &&
        (err.name === "NotAllowedError" || err.name === "PermissionDeniedError");
      if (isDenied) {
        toast.error("Microphone access denied. Please allow microphone access in your browser settings.");
      } else {
        toast.error("Could not access microphone.");
      }
      updateState("idle");
    }
  }, [startListening]);

  const stop = useCallback(() => {
    updateState("idle");

    // Cancel in-flight requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Stop recorder
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;

    // Stop silence detection
    silenceDetectorRef.current?.stop();
    silenceDetectorRef.current = null;

    // Stop level polling
    if (levelPollRef.current) {
      clearInterval(levelPollRef.current);
      levelPollRef.current = null;
    }

    // Release mic
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    // Cancel TTS
    window.speechSynthesis?.cancel();
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    setAudioLevel(0);
    setCurrentTranscript("");
  }, []);

  const interrupt = useCallback(() => {
    if (stateRef.current !== "speaking") return;

    // Cancel TTS
    window.speechSynthesis?.cancel();
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }

    // Cancel in-flight TTS request
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;

    // Resume listening
    updateState("listening");
    setTimeout(() => {
      if (stateRef.current === "listening") {
        startListening();
      }
    }, 400);
  }, [startListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (stateRef.current !== "idle") {
        abortControllerRef.current?.abort();
        if (mediaRecorderRef.current?.state === "recording") {
          mediaRecorderRef.current.stop();
        }
        silenceDetectorRef.current?.stop();
        if (levelPollRef.current) clearInterval(levelPollRef.current);
        streamRef.current?.getTracks().forEach((t) => t.stop());
        window.speechSynthesis?.cancel();
        if (audioElementRef.current) {
          audioElementRef.current.pause();
        }
      }
    };
  }, []);

  // Handle enabled toggle
  useEffect(() => {
    if (!enabled && stateRef.current !== "idle") {
      stop();
    }
  }, [enabled, stop]);

  return {
    state,
    start,
    stop,
    interrupt,
    currentTranscript,
    audioLevel,
  };
}
