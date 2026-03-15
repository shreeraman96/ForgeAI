"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { createSilenceDetector, type SilenceDetector } from "@/lib/audio/silence-detector";
import { parseSteps, type ParsedSteps } from "@/lib/voice/step-parser";
import { matchVoiceCommand } from "@/lib/voice/command-matcher";

export type VoiceState = "idle" | "listening" | "transcribing" | "thinking" | "speaking";
export type TtsMode = "browser" | "openai";

export interface StepInfo {
  current: number; // 1-based
  total: number;
  text: string;
}

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
  stepInfo: StepInfo | null;
}

export function useVoiceConversation({
  onSendMessage,
  ttsMode,
  enabled,
}: UseVoiceConversationOptions): UseVoiceConversationReturn {
  const [state, setState] = useState<VoiceState>("idle");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [audioLevel, setAudioLevel] = useState(0);
  const [stepInfo, setStepInfo] = useState<StepInfo | null>(null);

  // Use `string` (not `VoiceState`) so TS doesn't narrow inside async closures
  // where the ref can be mutated externally by stop().
  const stateRef = useRef<string>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const silenceDetectorRef = useRef<SilenceDetector | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const levelPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const generationRef = useRef(0);
  const ttsModeRef = useRef(ttsMode);
  const onSendMessageRef = useRef(onSendMessage);

  // Step delivery state — refs for async closures, state for reactive UI
  const parsedStepsRef = useRef<ParsedSteps | null>(null);
  const currentStepIndexRef = useRef<number>(0);

  // Keep refs in sync
  useEffect(() => { ttsModeRef.current = ttsMode; }, [ttsMode]);
  useEffect(() => { onSendMessageRef.current = onSendMessage; }, [onSendMessage]);

  function updateState(newState: VoiceState) {
    stateRef.current = newState;
    setState(newState);
  }

  /** Sync step refs + reactive state together. */
  function updateStepState(steps: ParsedSteps | null, index: number) {
    parsedStepsRef.current = steps;
    currentStepIndexRef.current = index;
    setStepInfo(
      steps
        ? { current: index + 1, total: steps.steps.length, text: steps.steps[index].text }
        : null
    );
  }

  /** Acquire (or re-acquire) the microphone and store the stream. */
  async function acquireMic(): Promise<MediaStream> {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    streamRef.current = stream;
    return stream;
  }

  /** Release the current mic stream so the OS exits the recording audio session. */
  function releaseMic() {
    streamRef.current?.getAudioTracks().forEach((t) => t.stop());
    streamRef.current = null;
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

    // Safety net: force-stop recording after 8s if silence detection fails
    const maxRecordingTimeout = setTimeout(() => {
      if (gen === generationRef.current && stateRef.current === "listening" && mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
        silenceDetectorRef.current?.stop();
      }
    }, 8000);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedBlob = e.data;
    };

    recorder.onstop = async () => {
      clearTimeout(maxRecordingTimeout);
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

        // ── STEP MODE: intercept voice commands before sending to AI ─────────
        if (parsedStepsRef.current) {
          const cmd = matchVoiceCommand(text.trim().toLowerCase());
          const steps = parsedStepsRef.current;
          const idx = currentStepIndexRef.current;

          if (cmd === "next" || cmd === "play") {
            if (idx < steps.steps.length - 1) {
              updateStepState(steps, idx + 1);
              const nextStep = steps.steps[idx + 1];
              updateState("speaking");
              await speakResponse(`Step ${nextStep.number}: ${nextStep.text}`);
            } else {
              // All steps completed
              updateStepState(null, 0);
              updateState("speaking");
              await speakResponse("That's all the steps. Great work!");
            }
            if (stateRef.current !== "speaking" || gen !== generationRef.current) return;
            updateState("listening");
            setTimeout(() => { if (stateRef.current === "listening" && gen === generationRef.current) startListening(); }, 400);
            return;
          }

          if (cmd === "previous") {
            if (idx > 0) {
              updateStepState(steps, idx - 1);
              const prevStep = steps.steps[idx - 1];
              updateState("speaking");
              await speakResponse(`Step ${prevStep.number}: ${prevStep.text}`);
            } else {
              updateState("speaking");
              await speakResponse(`You're already on step 1: ${steps.steps[0].text}`);
            }
            if (stateRef.current !== "speaking" || gen !== generationRef.current) return;
            updateState("listening");
            setTimeout(() => { if (stateRef.current === "listening" && gen === generationRef.current) startListening(); }, 400);
            return;
          }

          if (cmd === "repeat") {
            updateState("speaking");
            await speakResponse(`Step ${steps.steps[idx].number}: ${steps.steps[idx].text}`);
            if (stateRef.current !== "speaking" || gen !== generationRef.current) return;
            updateState("listening");
            setTimeout(() => { if (stateRef.current === "listening" && gen === generationRef.current) startListening(); }, 400);
            return;
          }

          if (cmd === "pause" || cmd === "exit-steps") {
            updateStepState(null, 0);
            updateState("listening");
            setTimeout(() => { if (stateRef.current === "listening" && gen === generationRef.current) startListening(); }, 400);
            return;
          }

          // Not a recognized command — fall through as a mid-step question
        }
        // ─────────────────────────────────────────────────────────────────────

        updateState("thinking");

        // Prepend step context for mid-step questions so AI gives targeted answers
        const stepCtx = parsedStepsRef.current;
        const messageToSend = stepCtx
          ? `[Context: I'm on step ${currentStepIndexRef.current + 1} of ${stepCtx.steps.length}: "${stepCtx.steps[currentStepIndexRef.current].text}"] ${text.trim()}`
          : text.trim();

        const responseText = await onSendMessageRef.current(messageToSend);

        if (gen !== generationRef.current) return; // interrupted during chat
        if (stateRef.current === "idle") return; // user exited during thinking

        updateState("speaking");

        if (stepCtx) {
          // Answer the mid-step question, then return to the same step
          await speakResponse(responseText);
        } else {
          // Check if the response is procedural → enter step mode
          const parsed = parseSteps(responseText);
          if (parsed) {
            updateStepState(parsed, 0);
            if (parsed.preamble) {
              await speakResponse(parsed.preamble);
              if (stateRef.current !== "speaking" || gen !== generationRef.current) return;
            }
            const total = parsed.steps.length;
            await speakResponse(
              `There are ${total} steps. Step 1: ${parsed.steps[0].text}. Say next when you're ready.`
            );
          } else {
            await speakResponse(responseText);
          }
        }

        if (stateRef.current !== "speaking" || gen !== generationRef.current) return;

        updateState("listening");
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

    // Set up silence detection to auto-stop recording.
    // The detector creates and owns its own AudioContext internally.
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

    // Stop silence detector AND release mic so iOS fully exits the
    // "playAndRecord" audio session and routes TTS through the speaker.
    // The detector's internal AudioContext keeps the session alive even
    // after mic tracks are stopped — both must be torn down.
    silenceDetectorRef.current?.stop();
    silenceDetectorRef.current = null;
    releaseMic();

    // Let iOS transition the audio session from "playAndRecord" to default.
    // Without this delay, TTS fires into a transitioning session and may
    // be routed to the earpiece or silently dropped.
    await new Promise(resolve => setTimeout(resolve, 300));

    try {
      if (ttsModeRef.current === "openai") {
        await speakWithOpenAI(text);
      } else {
        await speakWithBrowser(text);
      }
    } finally {
      // Re-acquire mic for next listening cycle — but only if we're still in
      // the normal flow. If interrupted, interrupt() handles this itself.
      if (stateRef.current === "speaking") {
        try {
          await acquireMic();
        } catch {
          // startListening will bail on null stream
        }
      }
    }
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
        const cleanup = () => {
          URL.revokeObjectURL(url);
          audio.onended = null;
          audio.onerror = null;
          audio.onpause = null;
          resolve();
        };
        audio.onended = cleanup;
        audio.onerror = cleanup;
        // When interrupt() calls audio.pause(), resolve the promise so
        // speakResponse's finally block can run and clean up properly.
        audio.onpause = cleanup;
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
      await acquireMic();

      // Create Audio element during user gesture (iOS requirement)
      if (!audioElementRef.current) {
        audioElementRef.current = new Audio();
      }

      // Unlock audio APIs for iOS — both speechSynthesis and HTMLAudioElement
      // must be activated during a user interaction, otherwise iOS silently
      // blocks programmatic playback after the recording session is torn down.
      // This is a no-op when start() is called from useEffect (non-gesture).
      try { window.speechSynthesis?.speak(new SpeechSynthesisUtterance("")); } catch {}
      try {
        audioElementRef.current.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA";
        await audioElementRef.current.play();
        audioElementRef.current.pause();
        audioElementRef.current.currentTime = 0;
        audioElementRef.current.src = "";
      } catch {}

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
    parsedStepsRef.current = null;
    currentStepIndexRef.current = 0;
    setStepInfo(null);

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

  const interrupt = useCallback(async () => {
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

    updateState("listening");

    // Re-acquire mic (speakResponse released it for speaker routing).
    // speakResponse's finally block will see state !== "speaking" and skip
    // its own mic re-acquisition, avoiding the race.
    try {
      await acquireMic();
    } catch {
      updateState("idle");
      return;
    }

    if (stateRef.current as string === "listening") {
      startListening();
    }
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
    stepInfo,
  };
}
