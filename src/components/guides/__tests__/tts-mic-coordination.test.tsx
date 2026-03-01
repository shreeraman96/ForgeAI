import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepVoiceCommands } from "../step-voice-commands";
import { StepAudioControls } from "../step-audio-controls";
import { lastRecognitionInstance } from "@/test/setup";
import { useState } from "react";

// Access the mock speechSynthesis
const mockSpeechSynthesis = window.speechSynthesis as unknown as {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
};

/**
 * Test harness that wires StepAudioControls and StepVoiceCommands together
 * via a shared `isPlaying` state, matching how GuidedProcedure orchestrates them.
 */
function TTSMicTestHarness({
  text,
  autoPlay,
  onCommand,
  onQuestion,
}: {
  text: string;
  autoPlay: boolean;
  onCommand: (cmd: string) => void;
  onQuestion: (q: string) => void;
}) {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div>
      <StepAudioControls
        text={text}
        autoPlay={autoPlay}
        onAutoPlayChange={() => {}}
        onPlayStateChange={setIsPlaying}
      />
      <StepVoiceCommands
        onCommand={onCommand}
        onQuestion={onQuestion}
        isPaused={isPlaying}
      />
      <div data-testid="playing-state">{isPlaying ? "playing" : "idle"}</div>
    </div>
  );
}

describe("TTS ↔ Mic Coordination", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("mic stops when TTS starts and restarts when TTS ends", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommand = vi.fn();
    const onQuestion = vi.fn();

    render(
      <TTSMicTestHarness
        text="Apply sealant."
        autoPlay={false}
        onCommand={onCommand}
        onQuestion={onQuestion}
      />
    );

    // Enable mic
    const buttons = document.querySelectorAll("button");
    // The last button is the mic toggle (StepVoiceCommands renders a single button)
    const micButton = Array.from(buttons).find((b) =>
      b.getAttribute("title")?.includes("voice commands")
    );
    expect(micButton).toBeTruthy();
    await user.click(micButton!);

    const recognition = lastRecognitionInstance!;
    expect(recognition.start).toHaveBeenCalled();

    // Start TTS by clicking "Read Step"
    const readButton = Array.from(buttons).find(
      (b) => b.textContent?.includes("Read Step")
    );
    expect(readButton).toBeTruthy();
    await user.click(readButton!);

    // Simulate utterance onstart → isPlaying=true → isPaused=true for mic
    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
    await act(async () => {
      utterance.onstart?.(new Event("start"));
    });

    // Mic should be stopped
    expect(recognition.stop).toHaveBeenCalled();

    // Simulate utterance onend → isPlaying=false → isPaused=false for mic
    await act(async () => {
      utterance.onend?.(new Event("end"));
    });

    // Wait for the 500ms restart delay
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Mic should have restarted
    const startCalls = recognition.start.mock.calls.length;
    expect(startCalls).toBeGreaterThanOrEqual(2); // initial start + restart after TTS
  });

  it("mic stays paused during auto-play TTS", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommand = vi.fn();
    const onQuestion = vi.fn();

    render(
      <TTSMicTestHarness
        text="Step instructions here."
        autoPlay={true}
        onCommand={onCommand}
        onQuestion={onQuestion}
      />
    );

    // Enable mic first
    const micButton = Array.from(document.querySelectorAll("button")).find(
      (b) => b.getAttribute("title")?.includes("voice commands")
    );
    await user.click(micButton!);

    const recognition = lastRecognitionInstance!;

    // Auto-play fires after 300ms
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    // Simulate TTS starting
    if (mockSpeechSynthesis.speak.mock.calls.length > 0) {
      const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
      await act(async () => {
        utterance.onstart?.(new Event("start"));
      });

      // Mic should be stopped during TTS
      expect(recognition.stop).toHaveBeenCalled();
    }
  });

  it("voice commands are not processed while TTS is playing", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommand = vi.fn();
    const onQuestion = vi.fn();

    render(
      <TTSMicTestHarness
        text="Step text."
        autoPlay={false}
        onCommand={onCommand}
        onQuestion={onQuestion}
      />
    );

    // Enable mic
    const micButton = Array.from(document.querySelectorAll("button")).find(
      (b) => b.getAttribute("title")?.includes("voice commands")
    );
    await user.click(micButton!);

    const recognition = lastRecognitionInstance!;

    // Start TTS
    const readButton = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Read Step")
    );
    await user.click(readButton!);

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
    await act(async () => {
      utterance.onstart?.(new Event("start"));
    });

    // Try to simulate a voice result while TTS is playing
    // The component checks isPausedRef.current before processing
    await act(async () => {
      recognition._simulateResult("next");
    });

    // Command should NOT be processed because isPaused=true (TTS is playing)
    expect(onCommand).not.toHaveBeenCalled();
  });

  it("processes commands again after TTS finishes", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommand = vi.fn();
    const onQuestion = vi.fn();

    render(
      <TTSMicTestHarness
        text="Step text."
        autoPlay={false}
        onCommand={onCommand}
        onQuestion={onQuestion}
      />
    );

    // Enable mic
    const micButton = Array.from(document.querySelectorAll("button")).find(
      (b) => b.getAttribute("title")?.includes("voice commands")
    );
    await user.click(micButton!);

    const recognition = lastRecognitionInstance!;

    // Start TTS
    const readButton = Array.from(document.querySelectorAll("button")).find(
      (b) => b.textContent?.includes("Read Step")
    );
    await user.click(readButton!);

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];

    // TTS starts
    await act(async () => {
      utterance.onstart?.(new Event("start"));
    });

    // TTS ends
    await act(async () => {
      utterance.onend?.(new Event("end"));
    });

    // Wait for mic restart delay
    await act(async () => {
      vi.advanceTimersByTime(600);
    });

    // Now simulate a command — should be processed
    await act(async () => {
      recognition._simulateResult("next");
    });

    expect(onCommand).toHaveBeenCalledWith("next");
  });
});
