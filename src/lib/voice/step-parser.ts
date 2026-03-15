export interface ParsedStep {
  number: number;
  text: string; // stripped of markdown formatting for TTS
}

export interface ParsedSteps {
  preamble: string | null;
  steps: ParsedStep[];
  postamble: string | null;
}

/** Strip markdown formatting and source citations so text reads cleanly via TTS. */
function stripMarkdown(text: string): string {
  return text
    .replace(/\[Source \d+[^\]]*\]/gi, "")  // [Source 1: "doc name"]
    .replace(/\*\*(.+?)\*\*/g, "$1")         // **bold**
    .replace(/\*(.+?)\*/g, "$1")             // *italic*
    .replace(/`(.+?)`/g, "$1")              // `code`
    .replace(/#+\s*/g, "")                   // ## headings
    .replace(/\s+/g, " ")
    .trim();
}

const STEP_PATTERN = /^(\d+)[.)]\s+(.+)/;
const STEP_WORD_PATTERN = /^[Ss]tep\s+(\d+)[:.]\s+(.+)/;

/**
 * Parse an AI response into a structured step list.
 * Returns null if the response has fewer than 3 numbered steps (not procedural).
 */
export function parseSteps(text: string): ParsedSteps | null {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Find all numbered step positions
  const stepPositions: { lineIndex: number; number: number; firstLine: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m = STEP_PATTERN.exec(line);
    if (!m) m = STEP_WORD_PATTERN.exec(line);
    if (m) {
      stepPositions.push({ lineIndex: i, number: parseInt(m[1], 10), firstLine: m[2] });
    }
  }

  // Require at least 3 steps to trigger step-by-step mode
  if (stepPositions.length < 3) return null;

  // Preamble: any lines before the first step
  const preambleLines = lines.slice(0, stepPositions[0].lineIndex);
  const preamble = preambleLines.length > 0 ? stripMarkdown(preambleLines.join(" ")) : null;

  // Build steps — each step accumulates continuation lines until the next step starts
  const steps: ParsedStep[] = [];
  for (let s = 0; s < stepPositions.length; s++) {
    const pos = stepPositions[s];
    const nextStepLine =
      s + 1 < stepPositions.length ? stepPositions[s + 1].lineIndex : lines.length;

    const stepLines = [pos.firstLine];
    for (let l = pos.lineIndex + 1; l < nextStepLine; l++) {
      stepLines.push(lines[l]);
    }

    steps.push({
      number: pos.number,
      text: stripMarkdown(stepLines.join(" ")),
    });
  }

  return { preamble, steps, postamble: null };
}
