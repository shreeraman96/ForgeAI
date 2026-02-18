import OpenAI from "openai";

const openai = new OpenAI();

const EXTENSION_MAP: Record<string, string> = {
  "video/mp4": "video.mp4",
  "video/webm": "video.webm",
  "video/mpeg": "video.mpeg",
};

export async function parseVideo(
  buffer: Buffer,
  mimeType: string
): Promise<string> {
  const fileName = EXTENSION_MAP[mimeType] || "video.mp4";
  const file = new File([new Uint8Array(buffer)], fileName, { type: mimeType });

  const transcription = await openai.audio.transcriptions.create({
    model: "whisper-1",
    file: file,
    response_format: "text",
  });

  return transcription as unknown as string;
}
