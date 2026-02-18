import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const GEMINI_MODEL = "gemini-2.0-flash";
const MAX_POLL_ATTEMPTS = 40; // 40 × 3s = 2 min max wait for file processing

const RETRY_DELAYS_MS = [15_000, 30_000, 60_000]; // 15s, 30s, 60s

function isRateLimitError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes("429") || msg.toLowerCase().includes("resource exhausted");
}

async function withRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt < RETRY_DELAYS_MS.length && isRateLimitError(error)) {
        const delay = RETRY_DELAYS_MS[attempt];
        console.warn(
          `[Gemini] ${label} hit rate limit (attempt ${attempt + 1}/${RETRY_DELAYS_MS.length + 1}). Retrying in ${delay / 1000}s...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  // TypeScript requires this — the loop above always either returns or throws
  throw new Error(`${label}: exhausted all retries`);
}

// Lazily-initialized module-level singletons — one instance per serverless invocation,
// consistent with the OpenAI `new OpenAI()` pattern used elsewhere in the codebase.
let _genAI: GoogleGenerativeAI | null = null;
let _fileManager: GoogleAIFileManager | null = null;

function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
    _genAI = new GoogleGenerativeAI(apiKey);
  }
  return _genAI;
}

function getFileManager(): GoogleAIFileManager {
  if (!_fileManager) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set");
    _fileManager = new GoogleAIFileManager(apiKey);
  }
  return _fileManager;
}

/**
 * Uploads a video buffer to the Gemini Files API and returns the file URI.
 * Writes to a temp file (GoogleAIFileManager.uploadFile requires a path),
 * then cleans up the temp file after upload.
 */
export async function uploadVideoToGemini(
  buffer: Buffer,
  mimeType: string,
  displayName: string
): Promise<string> {
  const fileManager = getFileManager();

  // Write buffer to a temp file — GoogleAIFileManager requires a file path
  const ext = mimeType.split("/")[1] || "mp4";
  const tempPath = join(tmpdir(), `expert-capture-${Date.now()}.${ext}`);

  await writeFile(tempPath, buffer);

  try {
    const uploadResponse = await fileManager.uploadFile(tempPath, {
      mimeType,
      displayName,
    });

    // Poll until the file is ACTIVE (Gemini processes it asynchronously)
    let fileInfo = uploadResponse.file;
    let attempts = 0;

    while (fileInfo.state === "PROCESSING") {
      if (attempts >= MAX_POLL_ATTEMPTS) {
        throw new Error(
          `Gemini file processing timed out after ${MAX_POLL_ATTEMPTS * 3} seconds`
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 3000));
      fileInfo = await fileManager.getFile(fileInfo.name);
      attempts++;
    }

    if (fileInfo.state !== "ACTIVE") {
      throw new Error(
        `Gemini file processing failed. Final state: ${fileInfo.state}`
      );
    }

    return fileInfo.uri;
  } finally {
    // Clean up temp file regardless of success or failure
    await unlink(tempPath).catch(() => {});
  }
}

/**
 * Analyzes an expert walkthrough video using Gemini 2.0 Flash.
 * Returns a raw JSON string with transcript, equipment, procedures, and safety notes.
 */
export async function analyzeExpertVideo(
  fileUri: string,
  mimeType: string,
  title: string,
  description?: string
): Promise<string> {
  const genAI = getGenAI();

  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.1,
    },
  });

  const result = await withRetry(
    () =>
      model.generateContent({
        contents: [
          {
            role: "user",
            parts: [
              { fileData: { fileUri, mimeType } },
              { text: buildAnalysisPrompt(title, description) },
            ],
          },
        ],
      }),
    "analyzeExpertVideo"
  );

  const text = result.response.text();
  if (!text) throw new Error("Gemini returned an empty response");
  return text;
}

function buildAnalysisPrompt(title: string, description?: string): string {
  return `You are analyzing an expert walkthrough video titled "${title}".
${description ? `Context provided: ${description}` : ""}

Watch this entire video carefully — all visual content and all spoken audio.

Return a JSON object with this exact structure:

{
  "fullTranscript": "complete word-for-word transcript of all spoken audio",
  "detectedExpertName": "name if mentioned in the video, otherwise null",
  "estimatedDurationSeconds": <number>,
  "equipment": [
    { "name": "string", "partNumber": "string or null", "type": "string or null", "timestampMentioned": <seconds> }
  ],
  "tools": [
    { "name": "string", "spec": "string or null" }
  ],
  "procedures": [
    {
      "stepNumber": <number>,
      "title": "brief 3-8 word step title",
      "description": "detailed description of what is done, how, and any specific settings or measurements",
      "timestampStart": <seconds>,
      "timestampEnd": <seconds>,
      "visualObservations": "what you see happening on screen during this step",
      "warnings": ["any warnings, cautions, or safety mentions"],
      "safetyLevel": "NORMAL or WARNING or CRITICAL"
    }
  ],
  "safetyNotes": [
    { "type": "PPE or HAZARD or PROCEDURE or ENVIRONMENTAL", "content": "string", "timestamp": <seconds> }
  ],
  "keyObservations": ["important visual details not captured in procedure steps"]
}

Rules:
- Capture every spoken word in fullTranscript
- Identify every distinct action or step as a separate procedure
- Mark safetyLevel as CRITICAL for any step involving electrical, hydraulic, heavy, or rotating hazards
- Include specific measurements, settings, part names, and visual indicators in descriptions`;
}
