import { parsePdf } from "./pdf-parser";
import { parseDocx } from "./docx-parser";
import { parseImage } from "./image-parser";

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
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}
