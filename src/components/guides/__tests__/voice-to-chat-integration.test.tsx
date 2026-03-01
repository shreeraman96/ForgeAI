import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { StepChat } from "../step-chat";

// Mock fetch globally
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Access mocked speechSynthesis
const mockSpeechSynthesis = window.speechSynthesis as unknown as {
  speak: ReturnType<typeof vi.fn>;
  cancel: ReturnType<typeof vi.fn>;
  getVoices: ReturnType<typeof vi.fn>;
};

/**
 * Helper: create a streaming response that resolves with the given text.
 * Simulates the ReadableStream pattern used by /api/guidance-chat.
 */
function createStreamResponse(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

describe("Voice → Chat → TTS Integration", () => {
  const chatProps = {
    documentId: "doc-123",
    stepNumber: 1,
    stepTitle: "Apply Sealant",
    stepDescription: "Apply a thin bead of sealant around the gasket.",
    procedureTitle: "Engine Gasket Replacement",
    warnings: ["Ensure surface is clean"],
    onSpeakResponse: vi.fn(),
  };

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("submits a voice question and calls onSpeakResponse with the streamed answer", async () => {
    const responseText = "Use the sealant at room temperature for best adhesion.";
    mockFetch.mockResolvedValueOnce(createStreamResponse(responseText));

    const onSpeakResponse = vi.fn();
    const { rerender } = render(
      <StepChat {...chatProps} onSpeakResponse={onSpeakResponse} />
    );

    // Simulate voice question arriving
    const voiceQuestion = { text: "what temperature should i use", id: 1 };
    rerender(
      <StepChat
        {...chatProps}
        onSpeakResponse={onSpeakResponse}
        voiceQuestion={voiceQuestion}
      />
    );

    // Wait for fetch to be called
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/guidance-chat",
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining("what temperature should i use"),
        })
      );
    });

    // Wait for response to be processed and onSpeakResponse called
    await waitFor(() => {
      expect(onSpeakResponse).toHaveBeenCalledWith(responseText);
    });
  });

  it("opens the chat panel when a voice question arrives", async () => {
    mockFetch.mockResolvedValueOnce(createStreamResponse("Answer text."));

    const { rerender } = render(<StepChat {...chatProps} />);

    // Panel should be closed initially
    expect(screen.queryByPlaceholderText("Ask about this step...")).not.toBeInTheDocument();

    // Simulate voice question
    rerender(
      <StepChat
        {...chatProps}
        voiceQuestion={{ text: "how long should I wait", id: 2 }}
      />
    );

    // Panel should now be open
    await waitFor(() => {
      expect(screen.getByPlaceholderText("Ask about this step...")).toBeInTheDocument();
    });
  });

  it("displays the user's voice question in the chat", async () => {
    mockFetch.mockResolvedValueOnce(createStreamResponse("Wait 30 minutes."));

    const { rerender } = render(<StepChat {...chatProps} />);

    rerender(
      <StepChat
        {...chatProps}
        voiceQuestion={{ text: "how long should i wait", id: 3 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("how long should i wait")).toBeInTheDocument();
    });
  });

  it("displays the streamed assistant response", async () => {
    const responseText = "Wait 30 minutes for the sealant to cure.";
    mockFetch.mockResolvedValueOnce(createStreamResponse(responseText));

    const { rerender } = render(<StepChat {...chatProps} />);

    rerender(
      <StepChat
        {...chatProps}
        voiceQuestion={{ text: "how long should i wait", id: 4 }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(responseText)).toBeInTheDocument();
    });
  });

  it("sends step context in the chat API request", async () => {
    mockFetch.mockResolvedValueOnce(createStreamResponse("Answer."));

    const { rerender } = render(<StepChat {...chatProps} />);

    rerender(
      <StepChat
        {...chatProps}
        voiceQuestion={{ text: "is this safe", id: 5 }}
      />
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
    });

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(callBody.documentId).toBe("doc-123");
    expect(callBody.stepNumber).toBe(1);
    expect(callBody.stepTitle).toBe("Apply Sealant");
    expect(callBody.stepDescription).toContain("sealant");
    expect(callBody.procedureTitle).toBe("Engine Gasket Replacement");
    expect(callBody.warnings).toEqual(["Ensure surface is clean"]);
  });

  it("handles fetch errors gracefully", async () => {
    mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));

    const onSpeakResponse = vi.fn();
    const { rerender } = render(
      <StepChat {...chatProps} onSpeakResponse={onSpeakResponse} />
    );

    rerender(
      <StepChat
        {...chatProps}
        onSpeakResponse={onSpeakResponse}
        voiceQuestion={{ text: "test question", id: 6 }}
      />
    );

    await waitFor(() => {
      expect(
        screen.getByText("Sorry, I couldn't get an answer. Please try again.")
      ).toBeInTheDocument();
    });

    // Should NOT call onSpeakResponse on error
    expect(onSpeakResponse).not.toHaveBeenCalled();
  });
});
