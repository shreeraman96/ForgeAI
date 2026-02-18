import { ExpertKnowledgeDocument } from "./expert-capture-synthesis";

export interface ExpertCaptureTextChunk {
  content: string;
  chunkIndex: number;
  chunkType:
    | "overview"
    | "equipment"
    | "procedure"
    | "safety"
    | "qa"
    | "transcript_segment";
}

/**
 * Converts an ExpertKnowledgeDocument into semantically pre-chunked text segments.
 *
 * Unlike the generic chunkText() which uses a sliding window, this produces chunks
 * aligned to semantic boundaries: one chunk per procedure step, one per Q&A pair,
 * etc. This ensures retrieval precision — asking "how do I do step 4?" returns
 * exactly that step, not a sliding window that spans steps 3–5.
 */
export function generateExpertCaptureChunks(
  doc: ExpertKnowledgeDocument
): ExpertCaptureTextChunk[] {
  const chunks: ExpertCaptureTextChunk[] = [];
  let idx = 0;

  // --- Chunk 1: Overview ---
  // Includes title, expert, summary, and all procedure titles so high-level
  // "what does this video cover?" queries surface this document.
  const procedureTitles = doc.procedures
    .map((p) => `  ${p.stepNumber}. ${p.title}`)
    .join("\n");

  chunks.push({
    content: `EXPERT CAPTURE: ${doc.title}
Expert: ${doc.expertName}
Duration: ${Math.round(doc.duration / 60)} minutes

SUMMARY:
${doc.summary}

PROCEDURES COVERED:
${procedureTitles}`,
    chunkIndex: idx++,
    chunkType: "overview",
  });

  // --- Chunk 2: Equipment & Tools ---
  if (doc.equipment.length > 0 || doc.tools.length > 0) {
    const equipmentLines = doc.equipment
      .map(
        (e) =>
          `- ${e.name}${e.partNumber ? ` (Part #${e.partNumber})` : ""}${e.type ? ` [${e.type}]` : ""}`
      )
      .join("\n");

    const toolLines = doc.tools
      .map((t) => `- ${t.name}${t.spec ? ` (${t.spec})` : ""}`)
      .join("\n");

    chunks.push({
      content: `EQUIPMENT AND TOOLS FOR: ${doc.title}
Expert: ${doc.expertName}

EQUIPMENT REQUIRED:
${equipmentLines || "None specified"}

TOOLS REQUIRED:
${toolLines || "None specified"}`,
      chunkIndex: idx++,
      chunkType: "equipment",
    });
  }

  // --- One chunk per procedure step ---
  for (const procedure of doc.procedures) {
    const safetyLine =
      procedure.safetyLevel && procedure.safetyLevel !== "NORMAL"
        ? `\nSAFETY LEVEL: ${procedure.safetyLevel}`
        : "";

    const warningsText =
      procedure.warnings && procedure.warnings.length > 0
        ? `\nWARNINGS:\n${procedure.warnings.map((w) => `- ${w}`).join("\n")}`
        : "";

    const timestampText = procedure.timestamp
      ? `\nTimestamp: ${formatTimestamp(procedure.timestamp.start)} – ${formatTimestamp(procedure.timestamp.end)}`
      : "";

    chunks.push({
      content: `PROCEDURE STEP ${procedure.stepNumber}: ${procedure.title}
From expert video: "${doc.title}" by ${doc.expertName}${timestampText}${safetyLine}

${procedure.description}${warningsText}`,
      chunkIndex: idx++,
      chunkType: "procedure",
    });
  }

  // --- Safety notes chunk ---
  if (doc.safetyNotes.length > 0) {
    const safetyLines = doc.safetyNotes
      .map((n) => `[${n.type}] ${n.content}`)
      .join("\n\n");

    chunks.push({
      content: `SAFETY NOTES FOR: ${doc.title}
Expert: ${doc.expertName}

${safetyLines}`,
      chunkIndex: idx++,
      chunkType: "safety",
    });
  }

  // --- One chunk per Q&A pair ---
  // Each pair becomes its own embedding so "how do I...?" directly matches
  // the question text, maximizing recall for common worker queries.
  for (const qa of doc.qaTrainingPairs) {
    chunks.push({
      content: `Q: ${qa.question}
A: ${qa.answer}

Source: Expert video "${doc.title}" by ${doc.expertName}`,
      chunkIndex: idx++,
      chunkType: "qa",
    });
  }

  // --- Transcript segments ---
  // The full transcript is chunked into 2000-char segments with 400-char overlap.
  // This catches anything the structured extraction missed — verbatim expert words.
  const transcriptChunks = chunkTranscript(
    doc.fullTranscript,
    doc.title,
    doc.expertName,
    idx
  );
  chunks.push(...transcriptChunks);

  return chunks;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function chunkTranscript(
  transcript: string,
  title: string,
  expertName: string,
  startIndex: number
): ExpertCaptureTextChunk[] {
  if (!transcript || transcript.trim().length === 0) return [];

  const CHUNK_SIZE = 2000;
  const OVERLAP = 400;
  const header = `TRANSCRIPT EXCERPT from expert video "${title}" by ${expertName}:\n\n`;

  const chunks: ExpertCaptureTextChunk[] = [];
  let start = 0;
  let chunkIndex = startIndex;
  const cleaned = transcript.replace(/\n{3,}/g, "\n\n").trim();

  while (start < cleaned.length) {
    let end = Math.min(start + CHUNK_SIZE, cleaned.length);

    // Try to break at a sentence or newline boundary
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf(". ", end);
      const lastNewline = cleaned.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);
      if (breakPoint > start + CHUNK_SIZE * 0.5) {
        end = breakPoint + 1;
      }
    }

    const segment = cleaned.slice(start, end).trim();
    if (segment.length > 0) {
      chunks.push({
        content: header + segment,
        chunkIndex: chunkIndex++,
        chunkType: "transcript_segment",
      });
    }

    start = end - OVERLAP;
    if (end === cleaned.length) break;
  }

  return chunks;
}
