import { parsePdf } from "./pdf-parser";
import { parseDocx } from "./docx-parser";
import { parseImage } from "./image-parser";
import { parseAudio } from "./audio-parser";
import { parseVideo } from "./video-parser";

export async function parseFile(
  buffer: Buffer,
  fileType: string,
  mimeType?: string
): Promise<string> {
  switch (fileType) {
    case "pdf":
      return parsePdf(buffer);
    case "docx":
      return parseDocx(buffer);
    case "image":
      return parseImage(buffer, mimeType || "image/png");
    case "audio":
      return parseAudio(buffer, mimeType || "audio/mpeg");
    case "video":
      return parseVideo(buffer, mimeType || "video/mp4");
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
