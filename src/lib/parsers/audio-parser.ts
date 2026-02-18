import OpenAI from "openai";

const openai = new OpenAI();

const EXTENSION_MAP: Record<string, string> = {
  "audio/mpeg": "audio.mp3",
  "audio/mp4": "audio.m4a",
  "audio/wav": "audio.wav",
  "audio/x-wav": "audio.wav",
  "audio/webm": "audio.webm",
};

export async function parseAudio(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const fileName = EXTENSION_MAP[mimeType] || "audio.mp3";
  const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: file,
    response_format: "text",
  });

  return transcription as unknown as string;
}
