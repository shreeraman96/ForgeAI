import OpenAI from "openai";
import { generateEmbedding } from "./embeddings";
import { searchSimilarChunks, SearchResult } from "@/lib/vectors";

const openai = new OpenAI();

function buildSystemPrompt(orgName: string, context: SearchResult[]): string {
  const contextBlock = context
    .map(
      (c, i) =>
        `[Source ${i + 1}: "${c.documentName}"]\n${c.content}`
    )
    .join("\n\n---\n\n");

  return `You are ForgeAI, an AI knowledge assistant for ${orgName}. Your job is to help frontline workers by answering questions using ONLY the company's own documentation.

RULES:
- Answer ONLY from the provided context below. Do not use your general training data.
- If the context does not contain enough information to answer, say: "I don't have that information in the uploaded documents. Please ask your supervisor or upload the relevant documentation."
- Cite which document each piece of information comes from using [Source N] references.
- Be concise and practical. Workers are on the shop floor — give them clear, actionable answers.
- If a procedure has steps, number them clearly.
- For specs and measurements, always include units.

CONTEXT FROM COMPANY DOCUMENTS:
${contextBlock || "No relevant documents found."}`;
}

export interface ChatStreamOptions {
  message: string;
  organizationId: string;
  organizationName: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

export async function streamChatResponse(
  options: ChatStreamOptions
): Promise<{
  stream: ReadableStream;
  sourceChunks: SearchResult[];
}> {
  const { message, organizationId, organizationName, history = [] } = options;

  // Generate embedding for the query
  const queryEmbedding = await generateEmbedding(message);

  // Search for relevant chunks
  const sourceChunks = await searchSimilarChunks(
    queryEmbedding,
    organizationId,
    5,
    0.3
  );

  // Build messages array
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: "system", content: buildSystemPrompt(organizationName, sourceChunks) },
    ...history.slice(-6).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: message },
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
