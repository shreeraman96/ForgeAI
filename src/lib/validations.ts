import { z } from "zod";

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export function getFileType(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("wordprocessingml")) return "docx";
  if (mimeType.startsWith("image/")) return "image";
  return "unknown";
}

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(5000),
  sessionId: z.string().optional(),
});

export const inviteWorkerSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "WORKER"]).default("WORKER"),
});
