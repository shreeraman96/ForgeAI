import * as pdfParse from "pdf-parse";

export async function parsePdf(buffer: Buffer): Promise<string> {
  const data = await (pdfParse as unknown as (buf: Buffer) => Promise<{ text: string }>)(buffer);
  return data.text;
}
