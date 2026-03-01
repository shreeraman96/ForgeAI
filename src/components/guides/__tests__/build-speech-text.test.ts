import { describe, it, expect } from "vitest";
import { buildSpeechText } from "../step-audio-controls";

describe("buildSpeechText", () => {
  it("returns plain text when no safety level or warnings", () => {
    expect(buildSpeechText("Tighten the bolt to 50 Nm.")).toBe(
      "Tighten the bolt to 50 Nm."
    );
  });

  it("prefixes CRITICAL safety level", () => {
    const result = buildSpeechText("Disconnect the power.", "CRITICAL");
    expect(result).toBe(
      "Warning. Critical safety step. Disconnect the power."
    );
  });

  it("prefixes WARNING safety level", () => {
    const result = buildSpeechText("Wear gloves.", "WARNING");
    expect(result).toBe(
      "Caution. Safety warning for this step. Wear gloves."
    );
  });

  it("ignores unknown safety levels", () => {
    const result = buildSpeechText("Do something.", "INFO");
    expect(result).toBe("Do something.");
  });

  it("appends warnings array", () => {
    const result = buildSpeechText("Apply sealant.", undefined, [
      "Use in ventilated area",
      "Avoid skin contact",
    ]);
    expect(result).toBe(
      "Apply sealant. Warnings: Use in ventilated area Avoid skin contact"
    );
  });

  it("combines CRITICAL safety level with warnings", () => {
    const result = buildSpeechText("Cut the wire.", "CRITICAL", [
      "Ensure power is off",
    ]);
    expect(result).toBe(
      "Warning. Critical safety step. Cut the wire. Warnings: Ensure power is off"
    );
  });

  it("handles empty warnings array", () => {
    const result = buildSpeechText("Measure the gap.", undefined, []);
    expect(result).toBe("Measure the gap.");
  });

  it("handles empty text", () => {
    const result = buildSpeechText("", "CRITICAL");
    expect(result).toBe("Warning. Critical safety step. ");
  });
});
