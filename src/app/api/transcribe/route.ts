import { auth } from "@/lib/auth";
import OpenAI from "openai";

const openai = new OpenAI();

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const audioFile = formData.get("audio");

    if (!audioFile || !(audioFile instanceof File)) {
      return Response.json({ error: "No audio file provided" }, { status: 400 });
    }

    // Whisper accepts: mp4, webm, mp3, wav, m4a, ogg, flac — all common recording formats
    const transcription = await openai.audio.transcriptions.create({
      model: "whisper-1",
      file: audioFile,
    });

    return Response.json({ text: transcription.text });
  } catch (error) {
    console.error("Transcription error:", error);
    return Response.json({ error: "Transcription failed" }, { status: 500 });
  }
}
