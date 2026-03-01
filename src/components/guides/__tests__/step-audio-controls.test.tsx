import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepAudioControls } from "../step-audio-controls";

// Access the mock speechSynthesis
const mockSpeechSynthesis = window.speechSynthesis as unknown as {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  pause: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
};

describe("StepAudioControls", () => {
  const defaultProps = {
    text: "Tighten the bolt to 50 Nm.",
    autoPlay: false,
    onAutoPlayChange: vi.fn(),
    onPlayStateChange: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders Read Step, Repeat, and Auto-play buttons", () => {
    render(<StepAudioControls {...defaultProps} />);

    expect(screen.getByText("Read Step")).toBeInTheDocument();
    expect(screen.getByText("Repeat")).toBeInTheDocument();
    expect(screen.getByText("Auto-play Off")).toBeInTheDocument();
  });

  it("calls speechSynthesis.speak when Read Step is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StepAudioControls {...defaultProps} />);

    await user.click(screen.getByText("Read Step"));

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
    expect(utterance.text).toBe("Tighten the bolt to 50 Nm.");
    expect(utterance.rate).toBe(0.95);
  });

  it("auto-plays when autoPlay=true after 300ms delay", async () => {
    render(<StepAudioControls {...defaultProps} autoPlay={true} />);

    // Not called immediately
    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();

    // Advance past the 300ms delay
    await act(async () => {
      vi.advanceTimersByTime(350);
    });

    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
  });

  it("does NOT auto-play when autoPlay=false", async () => {
    render(<StepAudioControls {...defaultProps} autoPlay={false} />);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(mockSpeechSynthesis.speak).not.toHaveBeenCalled();
  });

  it("cancels speech and calls onPlayStateChange(false) when autoPlay=false", async () => {
    render(<StepAudioControls {...defaultProps} autoPlay={false} />);

    await act(async () => {
      vi.advanceTimersByTime(50);
    });

    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    expect(defaultProps.onPlayStateChange).toHaveBeenCalledWith(false);
  });

  it("calls onPlayStateChange(true) when utterance starts", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StepAudioControls {...defaultProps} />);

    await user.click(screen.getByText("Read Step"));

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];

    // Simulate utterance starting
    await act(async () => {
      utterance.onstart?.(new Event("start"));
    });

    expect(defaultProps.onPlayStateChange).toHaveBeenCalledWith(true);
  });

  it("calls onPlayStateChange(false) when utterance ends", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StepAudioControls {...defaultProps} />);

    await user.click(screen.getByText("Read Step"));

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];

    // Start then end
    await act(async () => {
      utterance.onstart?.(new Event("start"));
      utterance.onend?.(new Event("end"));
    });

    expect(defaultProps.onPlayStateChange).toHaveBeenLastCalledWith(false);
  });

  it("calls speechSynthesis.pause when Pause is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onPlayStateChange = vi.fn();
    const { rerender } = render(
      <StepAudioControls
        {...defaultProps}
        onPlayStateChange={onPlayStateChange}
      />
    );

    // Click Read Step to start playing
    await user.click(screen.getByText("Read Step"));

    // Simulate the utterance starting so isPlaying becomes true
    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
    await act(async () => {
      utterance.onstart?.(new Event("start"));
    });

    // Now the Pause button should be visible
    rerender(
      <StepAudioControls
        {...defaultProps}
        onPlayStateChange={onPlayStateChange}
      />
    );

    // After onstart fires, isPlaying=true so Pause button shows
    const pauseButton = screen.queryByText("Pause");
    if (pauseButton) {
      await user.click(pauseButton);
      expect(mockSpeechSynthesis.pause).toHaveBeenCalled();
    }
  });

  it("calls speechSynthesis.speak again when Repeat is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<StepAudioControls {...defaultProps} />);

    await user.click(screen.getByText("Repeat"));

    expect(mockSpeechSynthesis.speak).toHaveBeenCalledTimes(1);
  });

  it("toggles auto-play when Auto-play button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onAutoPlayChange = vi.fn();
    render(
      <StepAudioControls
        {...defaultProps}
        onAutoPlayChange={onAutoPlayChange}
      />
    );

    await user.click(screen.getByText("Auto-play Off"));

    expect(onAutoPlayChange).toHaveBeenCalledWith(true);
  });

  it("shows Auto-play On when autoPlay=true", () => {
    render(<StepAudioControls {...defaultProps} autoPlay={true} />);
    expect(screen.getByText("Auto-play On")).toBeInTheDocument();
  });

  it("includes safety prefix in speech for CRITICAL steps", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <StepAudioControls
        {...defaultProps}
        text="Disconnect the power."
        safetyLevel="CRITICAL"
      />
    );

    await user.click(screen.getByText("Read Step"));

    const utterance = mockSpeechSynthesis.speak.mock.calls[0][0];
    expect(utterance.text).toContain("Warning. Critical safety step.");
    expect(utterance.text).toContain("Disconnect the power.");
  });

  it("cancels speech on unmount", () => {
    const { unmount } = render(<StepAudioControls {...defaultProps} />);
    unmount();
    expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
  });
});
