import { describe, it, expect } from "vitest";
import { matchVoiceCommand } from "../step-voice-commands";

describe("matchVoiceCommand", () => {
  describe("short commands (1-3 words) — single keyword matching", () => {
    it.each([
      ["next", "next"],
      ["continue", "next"],
      ["done", "next"],
      ["forward", "next"],
      ["skip", "next"],
      ["proceed", "next"],
    ])('"%s" → "next"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });

    it.each([
      ["back", "previous"],
      ["previous", "previous"],
      ["before", "previous"],
      ["go back", "previous"],
    ])('"%s" → "previous"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });

    it.each([
      ["repeat", "repeat"],
      ["again", "repeat"],
      ["read", "repeat"],
      ["reread", "repeat"],
    ])('"%s" → "repeat"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });

    it.each([
      ["pause", "pause"],
      ["stop", "pause"],
      ["halt", "pause"],
      ["mute", "pause"],
      ["quiet", "pause"],
      ["silence", "pause"],
    ])('"%s" → "pause"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });

    it.each([
      ["play", "play"],
      ["resume", "play"],
      ["start", "play"],
      ["speak", "play"],
      ["unmute", "play"],
    ])('"%s" → "play"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });
  });

  describe("multi-word phrases — match regardless of length", () => {
    it.each([
      ["go back to the previous step", "previous"],
      ["can you go back please", "previous"],
    ])('"%s" → "previous"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });

    it.each([
      ["say that again", "repeat"],
      ["say again please", "repeat"],
      ["one more time", "repeat"],
      ["read it for me", "repeat"],
      ["read this step", "repeat"],
      ["read the step again", "repeat"],
      ["read step please", "repeat"],
    ])('"%s" → "repeat"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });

    it.each([
      ["stop reading the step", "pause"],
      ["stop audio please", "pause"],
    ])('"%s" → "pause"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });

    it.each([
      ["go ahead to the next one", "next"],
      ["move on to the next step", "next"],
    ])('"%s" → "next"', (transcript, expected) => {
      expect(matchVoiceCommand(transcript)).toBe(expected);
    });

    it.each([["start reading the step", "play"]])(
      '"%s" → "play"',
      (transcript, expected) => {
        expect(matchVoiceCommand(transcript)).toBe(expected);
      }
    );
  });

  describe("questions — should return null (not match as commands)", () => {
    it.each([
      "what temperature should i use",
      "how long do i need to wait for this step",
      "can you read the instructions again for me please",
      "what do i do next after this step is done",
      "is there a safety concern with this material",
      "what tools do i need for the next step",
      "how much pressure should i apply here",
      "where do i find the replacement part",
    ])('"%s" → null', (transcript) => {
      expect(matchVoiceCommand(transcript)).toBeNull();
    });
  });

  describe("edge cases", () => {
    it("handles empty string", () => {
      expect(matchVoiceCommand("")).toBeNull();
    });

    it("handles single unrelated word", () => {
      expect(matchVoiceCommand("hello")).toBeNull();
    });

    it("is case-sensitive (expects lowercase input)", () => {
      // The component lowercases before calling this function,
      // but the function itself doesn't — verify it works with lowercase
      expect(matchVoiceCommand("next")).toBe("next");
    });

    it("short phrase with padding words still matches", () => {
      expect(matchVoiceCommand("okay next")).toBe("next");
      expect(matchVoiceCommand("please stop")).toBe("pause");
    });

    it("4+ word phrases without specific multi-word patterns return null", () => {
      // "next" appears but phrase is 4+ words and no multi-word pattern matches
      expect(
        matchVoiceCommand("what is the next thing i should do")
      ).toBeNull();
    });
  });
});
