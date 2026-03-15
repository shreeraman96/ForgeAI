export type VoiceCommand = "next" | "previous" | "repeat" | "pause" | "play" | "exit-steps";

/**
 * Match a transcript to a voice command.
 * Short utterances (1-3 words) match single keywords.
 * Longer utterances only match specific multi-word phrases to avoid
 * misinterpreting questions as commands.
 */
export function matchVoiceCommand(transcript: string): VoiceCommand | null {
  const words = transcript.split(/\s+/);
  const isShort = words.length <= 3;

  // Multi-word phrases — match regardless of utterance length (high confidence)
  if (transcript.includes("go back")) return "previous";
  if (
    transcript.includes("say that again") ||
    transcript.includes("say again") ||
    transcript.includes("one more time") ||
    transcript.includes("read it") ||
    transcript.includes("read this") ||
    transcript.includes("read the step") ||
    transcript.includes("read step")
  )
    return "repeat";
  if (transcript.includes("stop reading") || transcript.includes("stop audio"))
    return "pause";
  if (transcript.includes("go ahead") || transcript.includes("move on"))
    return "next";
  if (transcript.includes("start reading")) return "play";
  if (
    transcript.includes("exit steps") ||
    transcript.includes("stop steps") ||
    transcript.includes("cancel steps") ||
    transcript.includes("done with steps") ||
    transcript.includes("exit procedure") ||
    transcript.includes("stop procedure")
  )
    return "exit-steps";

  // Short phrases (1-3 words) — single keyword matching
  if (isShort) {
    if (/\b(next|continue|done|forward|skip|proceed)\b/.test(transcript))
      return "next";
    if (/\b(back|previous|before)\b/.test(transcript)) return "previous";
    if (/\b(repeat|again|read|reread)\b/.test(transcript)) return "repeat";
    if (/\b(pause|halt|mute|quiet|silence)\b/.test(transcript)) return "pause";
    if (/\b(play|resume|speak|unmute)\b/.test(transcript)) return "play";
    if (/\b(exit|cancel|quit)\b/.test(transcript)) return "exit-steps";
  }

  return null;
}
