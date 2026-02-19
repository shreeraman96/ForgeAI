"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle2, Loader2 } from "lucide-react";
import { StepDisplay, type Procedure } from "./step-display";
import { StepAudioControls, speakText } from "./step-audio-controls";
import { StepNavigation } from "./step-navigation";
import { StepVoiceCommands } from "./step-voice-commands";
import { StepChat } from "./step-chat";

interface GuideData {
  id: string;
  title: string | null;
  fileName: string;
  expertCaptureData: {
    title: string;
    expertName: string;
    procedures: Procedure[];
    summary?: string;
  } | null;
  activeSession: { id: string; currentStep: number } | null;
}

interface GuidedProcedureProps {
  documentId: string;
}

const AUTOPLAY_KEY = "forgeai-autoplay";

export function GuidedProcedure({ documentId }: GuidedProcedureProps) {
  const router = useRouter();
  const [guide, setGuide] = useState<GuideData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoPlay, setAutoPlay] = useState(() => {
    if (typeof window === "undefined") return true;
    const stored = localStorage.getItem(AUTOPLAY_KEY);
    return stored === null ? true : stored === "true";
  });
  const [completed, setCompleted] = useState(false);
  const [voiceQuestion, setVoiceQuestion] = useState<{ text: string; id: number } | null>(null);

  // Load guide data and create/resume session
  useEffect(() => {
    async function init() {
      try {
        const [guideRes, sessionRes] = await Promise.all([
          fetch(`/api/guides/${documentId}`),
          fetch("/api/guidance-sessions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId }),
          }),
        ]);

        if (!guideRes.ok) {
          setError("Guide not found.");
          return;
        }

        const guideData: GuideData = await guideRes.json();
        setGuide(guideData);

        if (sessionRes.ok) {
          const sessionData = await sessionRes.json();
          setSessionId(sessionData.id);
          // Resume at the saved step (currentStep is 1-based)
          setCurrentStepIndex((sessionData.currentStep ?? 1) - 1);
        }
      } catch {
        setError("Failed to load guide.");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [documentId]);

  // Persist auto-play preference
  useEffect(() => {
    localStorage.setItem(AUTOPLAY_KEY, String(autoPlay));
  }, [autoPlay]);

  const procedures = guide?.expertCaptureData?.procedures ?? [];
  const currentProcedure = procedures[currentStepIndex];

  const persistStep = useCallback(
    async (stepIndex: number, status?: "COMPLETED" | "ABANDONED") => {
      if (!sessionId) return;
      await fetch(`/api/guidance-sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentStep: stepIndex + 1,
          ...(status && { status }),
        }),
      });
    },
    [sessionId]
  );

  function goToStep(index: number) {
    setCurrentStepIndex(index);
    persistStep(index);
  }

  function handlePrevious() {
    if (currentStepIndex > 0) goToStep(currentStepIndex - 1);
  }

  function handleNext() {
    if (currentStepIndex < procedures.length - 1) goToStep(currentStepIndex + 1);
  }

  function handleRepeat() {
    if (!currentProcedure) return;
    const text = [
      currentProcedure.description,
      ...(currentProcedure.warnings ?? []),
    ].join(". ");
    speakText(text);
  }

  async function handleComplete() {
    await persistStep(currentStepIndex, "COMPLETED");
    setCompleted(true);
  }

  // Voice command handler
  function handleVoiceCommand(cmd: "next" | "previous" | "repeat" | "pause" | "play") {
    if (cmd === "next") handleNext();
    else if (cmd === "previous") handlePrevious();
    else if (cmd === "repeat") handleRepeat();
    else if (cmd === "pause") window.speechSynthesis?.pause();
    else if (cmd === "play") window.speechSynthesis?.resume();
  }

  // Q&A response: speak aloud
  function handleSpeakResponse(text: string) {
    speakText(text);
  }

  // --- Render states ---

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !guide || !guide.expertCaptureData) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          {error ?? "This guide is not available."}
        </p>
        <Button asChild variant="outline">
          <Link href="/guides">Back to Guides</Link>
        </Button>
      </div>
    );
  }

  const guideTitle =
    guide.title || guide.expertCaptureData.title || guide.fileName;

  // Completion screen
  if (completed) {
    return (
      <div className="p-6 max-w-lg mx-auto text-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
          <CheckCircle2 className="h-8 w-8 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold">Procedure Complete!</h2>
        <p className="text-sm text-muted-foreground">
          You completed all {procedures.length} steps of &quot;{guideTitle}&quot;.
        </p>
        <Button asChild>
          <Link href="/guides">Back to Guides</Link>
        </Button>
      </div>
    );
  }

  if (!currentProcedure) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-muted-foreground mb-4">
          No procedures found in this guide.
        </p>
        <Button asChild variant="outline">
          <Link href="/guides">Back to Guides</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/guides")}
          className="flex-shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">Step-by-Step Guide</p>
          <h1 className="text-sm font-semibold truncate">{guideTitle}</h1>
        </div>
        {/* Voice commands toggle */}
        <div className="ml-auto flex-shrink-0">
          <StepVoiceCommands
            onCommand={handleVoiceCommand}
            onQuestion={(q) => setVoiceQuestion({ text: q, id: Date.now() })}
            isPaused={isPlaying}
          />
        </div>
      </div>

      {/* Main content — scrollable */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        <StepDisplay
          procedure={currentProcedure}
          currentStepIndex={currentStepIndex}
          totalSteps={procedures.length}
        />

        <StepAudioControls
          text={currentProcedure.description}
          safetyLevel={currentProcedure.safetyLevel}
          warnings={currentProcedure.warnings}
          autoPlay={autoPlay}
          onAutoPlayChange={setAutoPlay}
          onPlayStateChange={setIsPlaying}
        />

        <StepNavigation
          currentStepIndex={currentStepIndex}
          totalSteps={procedures.length}
          onPrevious={handlePrevious}
          onNext={handleNext}
          onRepeat={handleRepeat}
          onComplete={handleComplete}
        />

        {/* Contextual Q&A */}
        <StepChat
          documentId={documentId}
          stepNumber={currentProcedure.stepNumber}
          stepTitle={currentProcedure.title}
          stepDescription={currentProcedure.description}
          procedureTitle={guideTitle}
          warnings={currentProcedure.warnings}
          onSpeakResponse={handleSpeakResponse}
          voiceQuestion={voiceQuestion}
        />
      </div>
    </div>
  );
}
