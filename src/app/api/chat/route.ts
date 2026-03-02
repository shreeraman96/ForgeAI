import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { streamChatResponse } from "@/lib/ai/chat";
import { streamChatResponseGemini } from "@/lib/ai/chat-gemini";
import { chatMessageSchema } from "@/lib/validations";

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
    const { message, sessionId, imageBase64, imageMimeType, useGemini } =
      chatMessageSchema.parse(body);

    // Get or create chat session
    let chatSessionId = sessionId;
    if (!chatSessionId) {
      const chatSession = await prisma.chatSession.create({
        data: { userId: session.user.id },
      });
      chatSessionId = chatSession.id;
    }

    // Get chat history for context
    const history: { role: string; content: string }[] = sessionId
      ? await prisma.chatMessage.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
          take: 10,
          select: { role: true, content: true },
        })
      : [];

    // Save user message
    await prisma.chatMessage.create({
      data: {
        role: "USER",
        content: message,
        sourceChunkIds: [],
        sessionId: chatSessionId,
      },
    });

    // Stream AI response
    const chatFn = useGemini ? streamChatResponseGemini : streamChatResponse;
    const { stream, sourceChunks } = await chatFn({
      message,
      organizationId: session.user.organizationId,
      organizationName: session.user.organizationName,
      history: history.map((m) => ({
        role: m.role.toLowerCase() as "user" | "assistant",
        content: m.content,
      })),
      imageBase64,
      imageMimeType,
    });

    // Collect the full response for saving to DB
    const [responseStream, saveStream] = stream.tee();

    // Save assistant message in background
    (async () => {
      const reader = saveStream.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          fullResponse += decoder.decode(value, { stream: true });
        }
        await prisma.chatMessage.create({
          data: {
            role: "ASSISTANT",
            content: fullResponse,
            sourceChunkIds: sourceChunks.map((c) => c.chunkId),
            sessionId: chatSessionId,
          },
        });
      } catch (err) {
        console.error("Failed to save assistant message:", err);
      }
    })();

    return new Response(responseStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Chat-Session-Id": chatSessionId!,
        "X-Source-Chunks": encodeURIComponent(
          JSON.stringify(
            sourceChunks.map((c) => ({
              id: c.chunkId,
              documentName: c.documentName,
              content: c.content.slice(0, 200),
              score: c.score,
            }))
          )
        ),
      },
    });
  } catch (error) {
    console.error("Chat error:", error);
    return new Response(JSON.stringify({ error: "Failed to process message" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
