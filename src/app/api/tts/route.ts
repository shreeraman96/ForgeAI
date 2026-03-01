import { auth } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    const { text } = await request.json();
    if (!text || typeof text !== "string") {
      return new Response("Missing text", { status: 400 });
    }

    // Truncate to avoid excessive TTS costs
    const truncated = text.slice(0, 4096);

    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "nova",
      input: truncated,
      response_format: "mp3",
    });

    return new Response(mp3.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("TTS error:", error);
    return new Response("TTS failed", { status: 500 });
  }
}
