"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Mic, Loader2, Volume2, Settings, Video, VideoOff } from "lucide-react";
import {
  useVoiceConversation,
  type VoiceState,
  type TtsMode,
} from "@/hooks/use-voice-conversation";
import { ListOrdered } from "lucide-react";
import { useCameraStream } from "@/hooks/use-camera-stream";

interface VoiceConversationOverlayProps {
  onSendMessage: (message: string, image?: { base64: string; mimeType: string }) => Promise<string>;
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

  const camera = useCameraStream();

  // Wrap onSendMessage to capture a frame before sending
  const wrappedSendMessage = useCallback(
    async (text: string) => {
      const frame = camera.captureFrame();
      return onSendMessage(text, frame ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [onSendMessage, camera.captureFrame]
  );

  const voice = useVoiceConversation({
    onSendMessage: wrappedSendMessage,
    ttsMode,
    enabled: true,
  });

  const handleClose = useCallback(() => {
    voice.stop();
    camera.stop();
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, camera]);

  // Start on mount
  useEffect(() => {
    voice.start();
    camera.start();
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

  const isStepMode = voice.stepInfo !== null;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center">
      {/* Header */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => (camera.isActive ? camera.stop() : camera.start())}
          title={camera.isActive ? "Turn off camera" : "Turn on camera"}
        >
          {camera.isActive ? (
            <Video className="h-4 w-4" />
          ) : (
            <VideoOff className="h-4 w-4" />
          )}
        </Button>
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
              ? isStepMode ? "bg-blue-500/20" : "bg-primary/20"
              : voice.state === "speaking"
              ? isStepMode ? "bg-blue-500/20" : "bg-green-500/20"
              : voice.state === "transcribing" || voice.state === "thinking"
              ? "bg-yellow-500/20"
              : "bg-muted"
          }`}
        />

        {/* Pulse ring when listening */}
        {voice.state === "listening" && (
          <span className={`absolute inset-0 rounded-full animate-ping pointer-events-none ${isStepMode ? "bg-blue-500/10" : "bg-primary/10"}`} />
        )}

        {/* Speaking wave animation */}
        {voice.state === "speaking" && (
          <span className={`absolute inset-0 rounded-full animate-pulse pointer-events-none ${isStepMode ? "bg-blue-500/10" : "bg-green-500/10"}`} />
        )}

        {/* Center icon */}
        <span className="relative z-10">
          {voice.state === "listening" ? (
            isStepMode
              ? <ListOrdered className="h-12 w-12 text-blue-500" />
              : <Mic className="h-12 w-12 text-primary" />
          ) : voice.state === "transcribing" || voice.state === "thinking" ? (
            <Loader2 className="h-12 w-12 text-yellow-500 animate-spin" />
          ) : voice.state === "speaking" ? (
            isStepMode
              ? <ListOrdered className="h-12 w-12 text-blue-500" />
              : <Volume2 className="h-12 w-12 text-green-500" />
          ) : (
            <Mic className="h-12 w-12 text-muted-foreground" />
          )}
        </span>
      </button>

      {/* State label */}
      <p className="mt-6 text-sm font-medium text-muted-foreground">
        {isStepMode
          ? `Step ${voice.stepInfo!.current} of ${voice.stepInfo!.total}`
          : STATE_LABELS[voice.state]}
      </p>

      {/* Step card — shows current step text */}
      {isStepMode && (
        <div className="mt-3 mx-4 max-w-sm w-full px-4 py-3 bg-blue-500/8 rounded-xl border border-blue-500/20">
          <p className="text-sm text-foreground/90 text-center leading-snug">
            {voice.stepInfo!.text}
          </p>
        </div>
      )}

      {/* Transcript display */}
      {voice.currentTranscript && !isStepMode && (
        <p className="mt-4 text-sm text-center max-w-sm px-4 text-foreground/80">
          &ldquo;{voice.currentTranscript}&rdquo;
        </p>
      )}

      {/* Hints */}
      {isStepMode && voice.state === "listening" && (
        <p className="mt-3 text-xs text-muted-foreground text-center px-4">
          Say &ldquo;next&rdquo;, &ldquo;repeat&rdquo;, &ldquo;go back&rdquo;, or ask a question
        </p>
      )}
      {!isStepMode && voice.state === "speaking" && (
        <p className="mt-2 text-xs text-muted-foreground">Tap to interrupt</p>
      )}

      {/* Camera preview - PiP style */}
      {camera.isActive && (
        <div className="absolute bottom-8 left-8 w-36 h-28 rounded-lg overflow-hidden border-2 border-primary/30 shadow-lg bg-black">
          <video
            ref={camera.videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        </div>
      )}
    </div>
  );
}
