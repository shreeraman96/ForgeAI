import Anthropic from "@anthropic-ai/sdk";

// Lazily-initialized module-level singleton — consistent with the OpenAI
// `new OpenAI()` pattern used elsewhere in the codebase.
let _client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!_client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey)
      throw new Error("ANTHROPIC_API_KEY environment variable is not set");
    _client = new Anthropic({ apiKey });
  }
  return _client;
}

export interface ExpertKnowledgeDocument {
  title: string;
  expertName: string;
  duration: number; // seconds
  recordedAt: string; // ISO 8601
  equipment: Array<{
    name: string;
    partNumber?: string;
    type?: string;
  }>;
  tools: Array<{
    name: string;
    spec?: string;
  }>;
  procedures: Array<{
    stepNumber: number;
    title: string;
    description: string;
    timestamp?: { start: number; end: number };
    safetyLevel?: "NORMAL" | "WARNING" | "CRITICAL";
    warnings?: string[];
  }>;
  safetyNotes: Array<{
    type: string;
    content: string;
  }>;
  qaTrainingPairs: Array<{
    question: string;
    answer: string;
  }>;
  summary: string;
  fullTranscript: string;
}

/**
 * Takes raw Gemini video analysis JSON and synthesizes a clean, structured
 * ExpertKnowledgeDocument using Claude Sonnet 4.5.
 */
export async function synthesizeExpertCapture(
  geminiAnalysisJson: string,
  metadata: {
    title: string;
    description?: string;
    uploadedAt: string;
  }
): Promise<ExpertKnowledgeDocument> {
  const client = getClient();

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 8000,
    temperature: 0.1,
    messages: [
      {
        role: "user",
        content: buildSynthesisPrompt(geminiAnalysisJson, metadata),
      },
    ],
  });

  const responseText =
    message.content[0].type === "text" ? message.content[0].text : "";

  if (!responseText) throw new Error("Claude returned an empty synthesis response");

  // Extract JSON (handles cases where Claude adds any surrounding text)
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch)
    throw new Error("Could not extract JSON from Claude synthesis response");

  return JSON.parse(jsonMatch[0]) as ExpertKnowledgeDocument;
}

function buildSynthesisPrompt(
  geminiAnalysisJson: string,
  metadata: { title: string; description?: string; uploadedAt: string }
): string {
  return `You are a technical knowledge engineer converting raw video analysis data into a structured industrial knowledge document.

VIDEO TITLE: ${metadata.title}
${metadata.description ? `DESCRIPTION: ${metadata.description}` : ""}
RECORDED AT: ${metadata.uploadedAt}

RAW GEMINI VIDEO ANALYSIS:
${geminiAnalysisJson}

Produce a JSON object matching this exact structure:

{
  "title": "${metadata.title}",
  "expertName": "<use detectedExpertName from analysis, or 'Unknown Expert'>",
  "duration": <number: estimatedDurationSeconds>,
  "recordedAt": "${metadata.uploadedAt}",
  "equipment": [{ "name": "<string>", "partNumber": "<string or omit>", "type": "<string or omit>" }],
  "tools": [{ "name": "<string>", "spec": "<string or omit>" }],
  "procedures": [{
    "stepNumber": <number>,
    "title": "<3-8 word action title>",
    "description": "<2-4 sentences: specific measurements, visual cues, exact settings>",
    "timestamp": { "start": <seconds>, "end": <seconds> },
    "safetyLevel": "<NORMAL|WARNING|CRITICAL>",
    "warnings": ["<warning text>"]
  }],
  "safetyNotes": [{ "type": "<PPE|HAZARD|PROCEDURE|ENVIRONMENTAL>", "content": "<string>" }],
  "qaTrainingPairs": [{
    "question": "<realistic question a new worker might ask>",
    "answer": "<specific, actionable answer grounded in the expert's narration>"
  }],
  "summary": "<2-3 paragraph executive summary of the full procedure>",
  "fullTranscript": "<complete transcript from the analysis>"
}

REQUIREMENTS:
1. Generate 8 to 20 Q&A training pairs. Cover: how-to questions, why questions, safety questions, measurement/spec questions, common mistakes, and troubleshooting.
2. Procedure descriptions must include exact values — temperatures, torques, pressures, part numbers, visual indicators.
3. Escalate safetyLevel to CRITICAL for any step with electrical, hydraulic, pneumatic, rotating, falling, or chemical hazards.
4. The summary must be comprehensive enough that a worker who has not seen the video can understand the full procedure.
5. Return ONLY the JSON object. No markdown code fences. No explanation text before or after.`;
}
