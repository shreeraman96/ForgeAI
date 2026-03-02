import { generateEmbedding } from "./embeddings";
import { searchSimilarChunks, type SearchResult } from "@/lib/vectors";
import { buildSystemPrompt, type ChatStreamOptions } from "./chat";
import { getGenAI, GEMINI_MODEL } from "./gemini";
import type { Content } from "@google/generative-ai";

export async function streamChatResponseGemini(
  options: ChatStreamOptions
): Promise<{
  stream: ReadableStream;
  sourceChunks: SearchResult[];
}> {
  const {
    message,
    organizationId,
    organizationName,
    history = [],
    imageBase64,
    imageMimeType,
  } = options;

  // --- RAG pipeline (identical to chat.ts) ---
  const embeddingText =
    message.trim() || "What is shown in this image? How do I work with it?";
  const queryEmbedding = await generateEmbedding(embeddingText);
  const sourceChunks = await searchSimilarChunks(
    queryEmbedding,
    organizationId,
    5,
    0.3
  );

  // --- Build system prompt ---
  const systemPrompt = buildSystemPrompt(
    organizationName,
    sourceChunks,
    !!(imageBase64 && imageMimeType)
  );

  // --- Build Gemini contents array ---
  const contents: Content[] = [];

  // Add conversation history (last 6 messages)
  for (const m of history.slice(-6)) {
    contents.push({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    });
  }

  // Build the user message parts
  const userParts: Content["parts"] = [];

  // Add image if provided
  if (imageBase64 && imageMimeType) {
    userParts.push({
      inlineData: {
        data: imageBase64,
        mimeType: imageMimeType,
      },
    });
  }

  // Add text
  userParts.push({
    text:
      message.trim() ||
      "Describe what you see and answer using the provided documentation.",
  });

  contents.push({ role: "user", parts: userParts });

  // --- Call Gemini ---
  const genAI = getGenAI();
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2048,
    },
  });

  const result = await model.generateContentStream({ contents });

  // --- Wrap Gemini async iterable into ReadableStream ---
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });

  return { stream, sourceChunks };
}
