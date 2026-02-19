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
      // Mark as intentionally stopped so onend doesn't auto-restart
      pausedByTTSRef.current = true;
      try { rec.stop(); } catch { /* ignore */ }
      setIsListening(false);
    } else if (enabled) {
      // Clear the flag then restart after a short delay to let the prior onend settle
      pausedByTTSRef.current = false;
      const t = setTimeout(() => {
        if (!isPausedRef.current && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch { /* ignore */ }
          setIsListening(true);
        }
      }, 200);
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

      if (
        transcript.includes("next") ||
        transcript.includes("continue") ||
        transcript.includes("done")
      ) {
        toast.success("▶ Next step");
        onCommand("next");
      } else if (
        transcript.includes("back") ||
        transcript.includes("previous") ||
        transcript.includes("go back")
      ) {
        toast.success("◀ Previous step");
        onCommand("previous");
      } else if (
        transcript.includes("repeat") ||
        transcript.includes("again") ||
        transcript.includes("say that again")
      ) {
        toast.success("↺ Repeating step");
        onCommand("repeat");
      } else if (
        transcript.includes("pause") ||
        transcript.includes("stop reading") ||
        transcript.includes("stop audio")
      ) {
        toast.success("⏸ Paused");
        onCommand("pause");
      } else if (
        transcript.includes("play") ||
        transcript.includes("resume") ||
        transcript.includes("start reading")
      ) {
        toast.success("▶ Resuming");
        onCommand("play");
      } else {
        toast.info(`🎤 "${transcript}"`);
        onQuestion(transcript);
      }
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onerror = (event: any) => {
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied for voice commands.");
        setEnabled(false);
      }
    };

    recognition.onend = () => {
      // If stopped intentionally due to TTS, the useEffect handles restart — don't interfere
      if (pausedByTTSRef.current) return;
      // Natural end (timeout, browser-triggered) — auto-restart if still enabled and not paused
      if (enabled && !isPausedRef.current) {
        try { recognition.start(); } catch { /* ignore */ }
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
