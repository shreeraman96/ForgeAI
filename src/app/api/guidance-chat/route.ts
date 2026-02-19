import { auth } from "@/lib/auth";
import { generateEmbedding } from "@/lib/ai/embeddings";
import { searchSimilarChunks } from "@/lib/vectors";
import { z } from "zod";
import OpenAI from "openai";

const openai = new OpenAI();

const guidanceChatSchema = z.object({
  question: z.string().max(5000),
  documentId: z.string(),
  stepNumber: z.number(),
  stepTitle: z.string(),
  stepDescription: z.string(),
  procedureTitle: z.string(),
  warnings: z.array(z.string()).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const {
      question,
      stepNumber,
      stepTitle,
      stepDescription,
      procedureTitle,
      warnings,
    } = guidanceChatSchema.parse(body);

    const queryEmbedding = await generateEmbedding(question);
    const sourceChunks = await searchSimilarChunks(
      queryEmbedding,
      session.user.organizationId,
      5,
      0.3
    );

    const contextBlock = sourceChunks
      .map((c, i) => `[Source ${i + 1}: "${c.documentName}"]\n${c.content}`)
      .join("\n\n---\n\n");

    const warningsText =
      warnings?.length
        ? `\nWARNINGS FOR THIS STEP:\n${warnings.map((w) => `- ${w}`).join("\n")}`
        : "";

    const systemPrompt = `You are ForgeAI, an AI assistant guiding a worker through a step-by-step procedure. The worker is currently performing this task:

PROCEDURE: ${procedureTitle}
CURRENT STEP ${stepNumber}: ${stepTitle}
DESCRIPTION: ${stepDescription}${warningsText}

Answer the worker's question specifically in the context of this step. Be concise, practical, and safety-aware. If the question involves something dangerous, always prioritize safety.

ADDITIONAL CONTEXT FROM COMPANY DOCUMENTS:
${contextBlock || "No additional context found."}

RULES:
- Answer from the step context and provided documents. Do not use general training data.
- Be brief — the worker is on the job and may be listening to this via audio.
- If you don't have enough information, say so and suggest asking a supervisor.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: question },
      ],
      stream: true,
      temperature: 0.2,
      max_tokens: 1024,
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

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("Guidance chat error:", error);
    return new Response(JSON.stringify({ error: "Failed to process question" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
