import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { auth } from "@/lib/auth";
import {
  ALLOWED_FILE_TYPES,
  ALLOWED_EXPERT_CAPTURE_TYPES,
  MAX_EXPERT_CAPTURE_FILE_SIZE,
  MAX_MEDIA_FILE_SIZE,
  MAX_FILE_SIZE,
} from "@/lib/validations";

/**
 * Client-upload token endpoint for Vercel Blob.
 *
 * The browser calls this route twice:
 *   1. POST with { type: "blob.generate-client-token" } → returns a short-lived token
 *   2. POST with { type: "blob.upload-completed" }      → fires after the upload lands
 *
 * The actual file bytes go directly from the browser to Vercel Blob storage and
 * never pass through this serverless function, so there is no FUNCTION_PAYLOAD_TOO_LARGE error.
 */
export async function POST(request: Request) {
  const body = (await request.json()) as HandleUploadBody;

  // IMPORTANT: This endpoint is called TWICE per upload:
  //   1. "blob.generate-client-token" — from the browser (has user session) → auth required
  //   2. "blob.upload-completed"       — from Vercel's infrastructure (no session) → no auth
  // Applying a blanket session check here blocks the completion callback and
  // causes Vercel Blob to fail the upload with "X-Length content header" errors.
  if (body.type === "blob.generate-client-token") {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname, clientPayload) => {
        // clientPayload carries the upload category set by the client
        const isExpertCapture = clientPayload === "expert-capture";
        const allowedContentTypes = isExpertCapture
          ? ALLOWED_EXPERT_CAPTURE_TYPES
          : ALLOWED_FILE_TYPES;
        const maximumSizeInBytes = isExpertCapture
          ? MAX_EXPERT_CAPTURE_FILE_SIZE
          : Math.max(MAX_FILE_SIZE, MAX_MEDIA_FILE_SIZE);

        return { allowedContentTypes, maximumSizeInBytes };
      },
      onUploadCompleted: async () => {
        // No-op — the client POSTs blob URL + metadata to the domain API after upload.
      },
    });

    return Response.json(jsonResponse);
  } catch (error) {
    return Response.json({ error: String(error) }, { status: 400 });
  }
}
