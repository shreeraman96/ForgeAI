import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepVoiceCommands } from "../step-voice-commands";
import { lastRecognitionInstance } from "@/test/setup";
import { toast } from "sonner";

describe("StepVoiceCommands", () => {
  const defaultProps = {
    onCommand: vi.fn(),
    onQuestion: vi.fn(),
    isPaused: false,
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders a mic toggle button", () => {
    render(<StepVoiceCommands {...defaultProps} />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("title", "Enable voice commands");
  });

  it("starts recognition when enabled via toggle", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StepVoiceCommands {...defaultProps} />);

    await user.click(screen.getByRole("button"));

    expect(lastRecognitionInstance).not.toBeNull();
    expect(lastRecognitionInstance!.continuous).toBe(true);
    expect(lastRecognitionInstance!.lang).toBe("en-US");
    expect(lastRecognitionInstance!.start).toHaveBeenCalled();
  });

  it("routes 'next' transcript to onCommand", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommand = vi.fn();
    render(<StepVoiceCommands {...defaultProps} onCommand={onCommand} />);

    // Enable voice
    await user.click(screen.getByRole("button"));

    // Simulate recognition result
    await act(async () => {
      lastRecognitionInstance!._simulateResult("next");
    });

    expect(onCommand).toHaveBeenCalledWith("next");
    expect(toast.success).toHaveBeenCalled();
  });

  it("routes 'pause' transcript to onCommand", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommand = vi.fn();
    render(<StepVoiceCommands {...defaultProps} onCommand={onCommand} />);

    await user.click(screen.getByRole("button"));

    await act(async () => {
      lastRecognitionInstance!._simulateResult("pause");
    });

    expect(onCommand).toHaveBeenCalledWith("pause");
  });

  it("routes question transcript to onQuestion", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onQuestion = vi.fn();
    render(<StepVoiceCommands {...defaultProps} onQuestion={onQuestion} />);

    await user.click(screen.getByRole("button"));

    await act(async () => {
      lastRecognitionInstance!._simulateResult(
        "what temperature should i use"
      );
    });

    expect(onQuestion).toHaveBeenCalledWith("what temperature should i use");
    expect(toast.info).toHaveBeenCalled();
  });

  it("stops recognition when isPaused changes to true", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(
      <StepVoiceCommands {...defaultProps} isPaused={false} />
    );

    // Enable voice
    await user.click(screen.getByRole("button"));
    const recognition = lastRecognitionInstance!;

    // Pause (TTS starts)
    rerender(
      <StepVoiceCommands
        {...defaultProps}
        isPaused={true}
        onCommand={defaultProps.onCommand}
        onQuestion={defaultProps.onQuestion}
      />
    );

    expect(recognition.stop).toHaveBeenCalled();
  });

  it("restarts recognition after isPaused changes back to false (500ms delay)", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { rerender } = render(
      <StepVoiceCommands {...defaultProps} isPaused={false} />
    );

    // Enable voice
    await user.click(screen.getByRole("button"));
    const recognition = lastRecognitionInstance!;
    const startCallsBefore = recognition.start.mock.calls.length;

    // Pause
    rerender(
      <StepVoiceCommands
        {...defaultProps}
        isPaused={true}
        onCommand={defaultProps.onCommand}
        onQuestion={defaultProps.onQuestion}
      />
    );

    // Unpause
    rerender(
      <StepVoiceCommands
        {...defaultProps}
        isPaused={false}
        onCommand={defaultProps.onCommand}
        onQuestion={defaultProps.onQuestion}
      />
    );

    // Not restarted yet (need 500ms)
    expect(recognition.start.mock.calls.length).toBe(startCallsBefore);

    // Advance 500ms
    await act(async () => {
      vi.advanceTimersByTime(550);
    });

    // Should have restarted
    expect(recognition.start.mock.calls.length).toBeGreaterThan(
      startCallsBefore
    );
  });

  it("disables on 'not-allowed' error", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StepVoiceCommands {...defaultProps} />);

    await user.click(screen.getByRole("button"));

    await act(async () => {
      lastRecognitionInstance!._simulateError("not-allowed");
    });

    expect(toast.error).toHaveBeenCalledWith(
      "Microphone access denied for voice commands."
    );
  });

  it("auto-restarts on natural end (onend) when still enabled", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StepVoiceCommands {...defaultProps} />);

    await user.click(screen.getByRole("button"));
    const recognition = lastRecognitionInstance!;
    const startCallsBefore = recognition.start.mock.calls.length;

    // Simulate natural end (e.g. no-speech timeout)
    await act(async () => {
      recognition._simulateEnd();
    });

    // Should auto-restart
    expect(recognition.start.mock.calls.length).toBeGreaterThan(
      startCallsBefore
    );
  });

  it("stops and cleans up recognition when toggled off", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StepVoiceCommands {...defaultProps} />);

    // Enable
    await user.click(screen.getByRole("button"));
    const recognition = lastRecognitionInstance!;

    // Disable
    await user.click(screen.getByRole("button"));

    expect(recognition.stop).toHaveBeenCalled();
  });

  it("does not process results when isPaused is true", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onCommand = vi.fn();
    render(
      <StepVoiceCommands {...defaultProps} isPaused={true} onCommand={onCommand} />
    );

    await user.click(screen.getByRole("button"));

    await act(async () => {
      lastRecognitionInstance?._simulateResult("next");
    });

    // Should not fire because isPaused is true
    expect(onCommand).not.toHaveBeenCalled();
  });
});
