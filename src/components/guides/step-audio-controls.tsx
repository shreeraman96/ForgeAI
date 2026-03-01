"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";

interface StepAudioControlsProps {
  text: string;
  safetyLevel?: string;
  warnings?: string[];
  autoPlay: boolean;
  onAutoPlayChange: (v: boolean) => void;
  onPlayStateChange: (playing: boolean) => void;
}

export function buildSpeechText(
  text: string,
  safetyLevel?: string,
  warnings?: string[]
): string {
  const parts: string[] = [];
  if (safetyLevel === "CRITICAL") {
    parts.push("Warning. Critical safety step.");
  } else if (safetyLevel === "WARNING") {
    parts.push("Caution. Safety warning for this step.");
  }
  parts.push(text);
  if (warnings?.length) {
    parts.push("Warnings:");
    warnings.forEach((w) => parts.push(w));
  }
  return parts.join(" ");
}

export function speakText(text: string) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "en-US";
  const voices = window.speechSynthesis.getVoices();
  const englishVoice = voices.find((v) => v.lang.startsWith("en"));
  if (englishVoice) utterance.voice = englishVoice;
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export function StepAudioControls({
  text,
  safetyLevel,
  warnings,
  autoPlay,
  onAutoPlayChange,
  onPlayStateChange,
}: StepAudioControlsProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const speechText = buildSpeechText(text, safetyLevel, warnings);

  function speak() {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find((v) => v.lang.startsWith("en"));
    if (englishVoice) utterance.voice = englishVoice;
    utterance.rate = 0.95;

    utterance.onstart = () => {
      setIsPlaying(true);
      onPlayStateChange(true);
    };
    utterance.onend = () => {
      setIsPlaying(false);
      onPlayStateChange(false);
    };
    utterance.onerror = () => {
      setIsPlaying(false);
      onPlayStateChange(false);
    };

    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  }

  function pause() {
    window.speechSynthesis?.pause();
    setIsPlaying(false);
    onPlayStateChange(false);
  }

  function resume() {
    window.speechSynthesis?.resume();
    setIsPlaying(true);
    onPlayStateChange(true);
  }

  function repeat() {
    speak();
  }

  // Auto-play when text changes (new step)
  useEffect(() => {
    if (autoPlay) {
      // Small delay so voices are loaded and component is mounted
      const t = setTimeout(() => speak(), 300);
      return () => clearTimeout(t);
    } else {
      window.speechSynthesis?.cancel();
      setIsPlaying(false);
      onPlayStateChange(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, autoPlay]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
    };
  }, []);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Play / Pause */}
      {isPlaying ? (
        <Button size="sm" variant="outline" onClick={pause} className="gap-1.5">
          <Pause className="h-3.5 w-3.5" />
          Pause
        </Button>
      ) : (
        <Button size="sm" variant="outline" onClick={speak} className="gap-1.5">
          <Play className="h-3.5 w-3.5" />
          Read Step
        </Button>
      )}

      {/* Repeat */}
      <Button size="sm" variant="ghost" onClick={repeat} className="gap-1.5 text-muted-foreground">
        <RotateCcw className="h-3.5 w-3.5" />
        Repeat
      </Button>

      {/* Auto-play toggle */}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => onAutoPlayChange(!autoPlay)}
        className={`gap-1.5 ${autoPlay ? "text-primary" : "text-muted-foreground"}`}
        title={autoPlay ? "Auto-play on (click to disable)" : "Auto-play off (click to enable)"}
      >
        {autoPlay ? (
          <Volume2 className="h-3.5 w-3.5" />
        ) : (
          <VolumeX className="h-3.5 w-3.5" />
        )}
        {autoPlay ? "Auto-play On" : "Auto-play Off"}
      </Button>
    </div>
  );
}
