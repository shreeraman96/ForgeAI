"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Mic, Loader2, Volume2, Settings } from "lucide-react";
import {
  useVoiceConversation,
  type VoiceState,
  type TtsMode,
} from "@/hooks/use-voice-conversation";

interface VoiceConversationOverlayProps {
  onSendMessage: (message: string) => Promise<string>;
  onClose: () => void;
  ttsMode: TtsMode;
  onTtsModeChange: (mode: TtsMode) => void;
}

const STATE_LABELS: Record<VoiceState, string> = {
  idle: "Tap to start",
  listening: "Listening...",
  transcribing: "Processing...",
  thinking: "Thinking...",
  speaking: "Speaking...",
};

export function VoiceConversationOverlay({
  onSendMessage,
  onClose,
  ttsMode,
  onTtsModeChange,
}: VoiceConversationOverlayProps) {
  const [showSettings, setShowSettings] = useState(false);

  const handleClose = useCallback(() => {
    voice.stop();
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose]);

  const voice = useVoiceConversation({
    onSendMessage,
    ttsMode,
    enabled: true,
  });

  // Start on mount
  useEffect(() => {
    voice.start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") handleClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleClose]);

  function handleCircleTap() {
    if (voice.state === "idle") {
      voice.start();
    } else if (voice.state === "speaking") {
      voice.interrupt();
    }
  }

  // Scale the circle based on audio level when listening
  const circleScale =
    voice.state === "listening" ? 1 + voice.audioLevel * 0.3 : 1;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setShowSettings((v) => !v)}
          title="Voice settings"
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleClose} title="Close voice mode">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Settings dropdown */}
      {showSettings && (
        <div className="absolute top-14 right-4 bg-popover border rounded-lg shadow-lg p-3 min-w-[180px]">
          <p className="text-xs font-medium text-muted-foreground mb-2">Voice output</p>
          <button
            className={`block w-full text-left px-3 py-1.5 rounded text-sm ${
              ttsMode === "browser" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
            }`}
            onClick={() => { onTtsModeChange("browser"); setShowSettings(false); }}
          >
            Browser (free)
          </button>
          <button
            className={`block w-full text-left px-3 py-1.5 rounded text-sm ${
              ttsMode === "openai" ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted"
            }`}
            onClick={() => { onTtsModeChange("openai"); setShowSettings(false); }}
          >
            OpenAI (natural)
          </button>
        </div>
      )}

      {/* Animated circle */}
      <button
        onClick={handleCircleTap}
        className="relative flex items-center justify-center w-40 h-40 rounded-full transition-transform duration-200 focus:outline-none"
        style={{ transform: `scale(${circleScale})` }}
        aria-label={STATE_LABELS[voice.state]}
      >
        {/* Background ring */}
        <span
          className={`absolute inset-0 rounded-full transition-colors duration-300 ${
            voice.state === "listening"
              ? "bg-primary/20"
              : voice.state === "speaking"
              ? "bg-green-500/20"
              : voice.state === "transcribing" || voice.state === "thinking"
              ? "bg-yellow-500/20"
              : "bg-muted"
          }`}
        />

        {/* Pulse ring when listening */}
        {voice.state === "listening" && (
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/10 pointer-events-none" />
        )}

        {/* Speaking wave animation */}
        {voice.state === "speaking" && (
          <span className="absolute inset-0 rounded-full animate-pulse bg-green-500/10 pointer-events-none" />
        )}

        {/* Center icon */}
        <span className="relative z-10">
          {voice.state === "listening" ? (
            <Mic className="h-12 w-12 text-primary" />
          ) : voice.state === "transcribing" || voice.state === "thinking" ? (
            <Loader2 className="h-12 w-12 text-yellow-500 animate-spin" />
          ) : voice.state === "speaking" ? (
            <Volume2 className="h-12 w-12 text-green-500" />
          ) : (
            <Mic className="h-12 w-12 text-muted-foreground" />
          )}
        </span>
      </button>

      {/* State label */}
      <p className="mt-6 text-sm font-medium text-muted-foreground">
        {STATE_LABELS[voice.state]}
      </p>

      {/* Transcript display */}
      {voice.currentTranscript && (
        <p className="mt-4 text-sm text-center max-w-sm px-4 text-foreground/80">
          &ldquo;{voice.currentTranscript}&rdquo;
        </p>
      )}

      {/* Hint */}
      {voice.state === "speaking" && (
        <p className="mt-2 text-xs text-muted-foreground">Tap to interrupt</p>
      )}
    </div>
  );
}
