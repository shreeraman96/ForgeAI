import { z } from "zod";

export const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  // Audio
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/x-wav",
  "audio/webm",
  // Video
  "video/mp4",
  "video/webm",
  "video/mpeg",
];

export const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB for docs/images
export const MAX_MEDIA_FILE_SIZE = 25 * 1024 * 1024; // 25MB for audio/video (Whisper API limit)

export function getMaxFileSize(mimeType: string): number {
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    return MAX_MEDIA_FILE_SIZE;
  }
  return MAX_FILE_SIZE;
}

export function getFileType(mimeType: string): string {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.includes("wordprocessingml")) return "docx";
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  return "unknown";
}

export const chatMessageSchema = z.object({
  message: z.string().max(5000).default(""),
  sessionId: z.string().optional(),
  imageBase64: z.string().optional(),
  imageMimeType: z.string().optional(),
  useGemini: z.boolean().optional(),
});

export const inviteWorkerSchema = z.object({
  email: z.string().email(),
  role: z.enum(["ADMIN", "WORKER"]).default("WORKER"),
});

// Expert Capture — video-only, larger size limit for Gemini Files API
// Vercel Blob Pro supports up to 500MB. Gemini Files API supports up to 2GB.
export const MAX_EXPERT_CAPTURE_FILE_SIZE = 500 * 1024 * 1024; // 500MB

export const ALLOWED_EXPERT_CAPTURE_TYPES = [
  "video/mp4",
  "video/webm",
  "video/mpeg",
  "video/quicktime", // .mov from Mac recordings
];

export const expertCaptureUploadSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(200),
  description: z.string().max(1000).optional(),
});
