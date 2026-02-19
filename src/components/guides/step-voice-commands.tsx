"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";

interface StepVoiceCommandsProps {
  onCommand: (cmd: "next" | "previous" | "repeat" | "pause" | "play") => void;
  onQuestion: (text: string) => void;
  isPaused: boolean;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onresult: ((event: any) => void) | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function createRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const W = window as any;
  const Ctor = W.SpeechRecognition || W.webkitSpeechRecognition;
  if (!Ctor) return null;
  return new Ctor() as SpeechRecognitionInstance;
}

type VoiceCommand = "next" | "previous" | "repeat" | "pause" | "play";

const COMMAND_LABELS: Record<VoiceCommand, string> = {
  next: "▶ Next step",
  previous: "◀ Previous step",
  repeat: "↺ Reading step",
  pause: "⏸ Paused",
  play: "▶ Resuming",
};

/**
 * Match a transcript to a voice command.
 * Short utterances (1-3 words) match single keywords like "read", "stop", "next".
 * Longer utterances only match specific multi-word phrases to avoid
 * accidentally interpreting questions as commands.
 */
function matchVoiceCommand(transcript: string): VoiceCommand | null {
  const words = transcript.split(/\s+/);
  const isShort = words.length <= 3;

  // Multi-word phrases — match regardless of length (high confidence)
  if (transcript.includes("go back")) return "previous";
  if (
    transcript.includes("say that again") ||
    transcript.includes("say again") ||
    transcript.includes("one more time") ||
    transcript.includes("read it") ||
    transcript.includes("read this") ||
    transcript.includes("read the step") ||
    transcript.includes("read step")
  )
    return "repeat";
  if (transcript.includes("stop reading") || transcript.includes("stop audio"))
    return "pause";
  if (transcript.includes("go ahead") || transcript.includes("move on"))
    return "next";
  if (transcript.includes("start reading")) return "play";

  // Short phrases (1-3 words) — single keyword matching
  if (isShort) {
    if (/\b(next|continue|done|forward|skip|proceed)\b/.test(transcript))
      return "next";
    if (/\b(back|previous|before)\b/.test(transcript)) return "previous";
    if (/\b(repeat|again|read|reread)\b/.test(transcript)) return "repeat";
    if (/\b(pause|stop|halt|mute|quiet|silence)\b/.test(transcript))
      return "pause";
    if (/\b(play|resume|start|speak|unmute)\b/.test(transcript)) return "play";
  }

  return null;
}

export function StepVoiceCommands({
  onCommand,
  onQuestion,
  isPaused,
}: StepVoiceCommandsProps) {
  const [enabled, setEnabled] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const isPausedRef = useRef(isPaused);
  // Tracks when we intentionally stopped due to TTS, so onend skips its auto-restart
  const pausedByTTSRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
    const rec = recognitionRef.current;
    if (!rec) return;
    if (isPaused) {
      pausedByTTSRef.current = true;
      try { rec.stop(); } catch { /* ignore */ }
      setIsListening(false);
    } else if (enabled) {
      pausedByTTSRef.current = false;
      // Longer delay (500ms) — iOS needs more time after TTS releases the audio session
      const t = setTimeout(() => {
        if (!isPausedRef.current && recognitionRef.current) {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (e) {
            console.warn("[VoiceCmd] Failed to restart mic after TTS:", e);
            // Retry once more after another delay
            setTimeout(() => {
              try {
                recognitionRef.current?.start();
                setIsListening(true);
              } catch { /* give up silently */ }
            }, 500);
          }
        }
      }, 500);
      return () => clearTimeout(t);
    }
  }, [isPaused, enabled]);

  useEffect(() => {
    if (!enabled) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch { /* ignore */ }
        recognitionRef.current = null;
      }
      setIsListening(false);
      return;
    }

    const recognition = createRecognition();
    if (!recognition) {
      toast.error("Voice commands are not supported in this browser.");
      setEnabled(false);
      return;
    }

    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      if (isPausedRef.current) return;
      const transcript: string =
        event.results[event.results.length - 1][0].transcript.trim().toLowerCase();

      const command = matchVoiceCommand(transcript);
      if (command) {
        toast.success(COMMAND_LABELS[command]);
        onCommand(command);
      } else {
        toast.info(`🎤 "${transcript}"`);
        onQuestion(transcript);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      console.warn("[VoiceCmd] error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied for voice commands.");
        setEnabled(false);
      } else if (event.error === "aborted" || event.error === "network") {
        // iOS can fire these when audio session is interrupted — don't disable, just log
      } else if (event.error === "no-speech") {
        // Normal timeout — onend will handle restart
      }
    };

    recognition.onend = () => {
      // If stopped intentionally due to TTS, the useEffect handles restart — don't interfere
      if (pausedByTTSRef.current) return;
      // Natural end (timeout, browser-triggered) — auto-restart if still enabled and not paused
      if (enabled && !isPausedRef.current) {
        try {
          recognition.start();
        } catch (e) {
          console.warn("[VoiceCmd] onend restart failed:", e);
          setIsListening(false);
          // Retry after delay — iOS sometimes needs a gap between stop and start
          setTimeout(() => {
            if (enabled && !isPausedRef.current) {
              try {
                recognition.start();
                setIsListening(true);
              } catch { setIsListening(false); }
            }
          }, 300);
        }
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    if (!isPausedRef.current) {
      try {
        recognition.start();
        setIsListening(true);
      } catch { /* ignore */ }
    }

    return () => {
      try { recognition.stop(); } catch { /* ignore */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return (
    <Button
      size="icon"
      variant={enabled ? "default" : "ghost"}
      onClick={() => setEnabled((v) => !v)}
      title={
        enabled
          ? "Voice commands active — click to disable"
          : "Enable voice commands"
      }
      className={`relative ${
        enabled && isListening ? "ring-2 ring-primary ring-offset-2" : ""
      }`}
    >
      {enabled ? (
        <Mic className="h-4 w-4" />
      ) : (
        <MicOff className="h-4 w-4" />
      )}
      {enabled && isListening && (
        <span className="absolute inset-0 rounded-md animate-ping bg-primary/30 pointer-events-none" />
      )}
    </Button>
  );
}
