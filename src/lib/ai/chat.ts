import OpenAI from "openai";
import { generateEmbedding } from "./embeddings";
import { searchSimilarChunks, SearchResult } from "@/lib/vectors";

const openai = new OpenAI();

export function buildSystemPrompt(orgName: string, context: SearchResult[], hasImage: boolean): string {
  const contextBlock = context
    .map(
      (c, i) =>
        `[Source ${i + 1}: "${c.documentName}"]\n${c.content}`
    )
    .join("\n\n---\n\n");

  const imageRule = hasImage
    ? `- An image has been attached. Use your vision capabilities to analyze and describe what you see in the image, then cross-reference with the provided documentation to give specific guidance.`
    : "";

  return `You are ForgeAI, an AI knowledge assistant for ${orgName}. Your job is to help frontline workers by answering questions using ONLY the company's own documentation.

RULES:
- Answer ONLY from the provided context below. Do not use your general training data.
- If the context does not contain enough information to answer, say: "I don't have that information in the uploaded documents. Please ask your supervisor or upload the relevant documentation."
- Cite which document each piece of information comes from using [Source N] references.
- Be concise and practical. Workers are on the shop floor — give them clear, actionable answers.
- If a procedure has steps, number them clearly. Format each step on its own line as "1. [step text]", "2. [step text]", etc. Place any introductory context before step 1.
- For specs and measurements, always include units.
${imageRule}
CONTEXT FROM COMPANY DOCUMENTS:
${contextBlock || "No relevant documents found."}`;
}

export interface ChatStreamOptions {
  message: string;
  organizationId: string;
  organizationName: string;
  history?: { role: "user" | "assistant"; content: string }[];
  imageBase64?: string;
  imageMimeType?: string;
}

export async function streamChatResponse(
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

  // Use message text for embedding; fall back to a visual-query phrase when only an image is provided
  const embeddingText =
    message.trim() || "What is shown in this image? How do I work with it?";

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(embeddingText);

  // Search for relevant chunks
  const sourceChunks = await searchSimilarChunks(
    queryEmbedding,
    organizationId,
    5,
    0.3
  );

  // Build the user message content — multimodal when an image is attached
  let userContent: OpenAI.Chat.Completions.ChatCompletionUserMessageParam["content"];
  if (imageBase64 && imageMimeType) {
    userContent = [
      {
        type: "image_url",
        image_url: {
          url: `data:${imageMimeType};base64,${imageBase64}`,
          detail: "high",
        },
      },
      {
        type: "text",
        text:
          message.trim() ||
          "Describe what you see and answer using the provided documentation.",
      },
    ];
  } else {
    userContent = message;
  }

  // Build messages array
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(organizationName, sourceChunks, !!(imageBase64 && imageMimeType)) },
    ...history.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userContent },
  ];

  // Stream the response
  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages,
    stream: true,
    temperature: 0.2,
    max_tokens: 2048,
  });

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of completion) {
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            controller.enqueue(encoder.encode(content));
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
