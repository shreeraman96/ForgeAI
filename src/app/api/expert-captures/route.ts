import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  ALLOWED_EXPERT_CAPTURE_TYPES,
  MAX_EXPERT_CAPTURE_FILE_SIZE,
  expertCaptureUploadSchema,
} from "@/lib/validations";
import { processExpertCapture } from "@/lib/ai/process-expert-capture";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const expertCaptures = await prisma.document.findMany({
    where: {
      organizationId: session.user.organizationId,
      docType: "EXPERT_CAPTURE",
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      fileName: true,
      fileSize: true,
      status: true,
      errorMessage: true,
      createdAt: true,
      expertCaptureData: true,
      uploadedBy: { select: { name: true } },
      _count: { select: { chunks: true } },
    },
  });

  return NextResponse.json(expertCaptures);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // The file was uploaded directly to Vercel Blob by the client (to avoid
  // FUNCTION_PAYLOAD_TOO_LARGE on Vercel serverless). We receive only the
  // blob URL + metadata as JSON — no file bytes pass through this function.
  const body = await request.json();
  const { blobUrl, fileName, mimeType, fileSize, title, description } = body as {
    blobUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    title: string;
    description?: string;
  };

  if (!blobUrl || !fileName || !mimeType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate metadata
  const metaResult = expertCaptureUploadSchema.safeParse({ title, description });
  if (!metaResult.success) {
    return NextResponse.json(
      { error: metaResult.error.issues[0].message },
      { status: 400 }
    );
  }

  // Validate file type
  if (!ALLOWED_EXPERT_CAPTURE_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "Only MP4, WebM, MPEG, and MOV video files are accepted for Expert Captures." },
      { status: 400 }
    );
  }

  // Validate file size
  if (fileSize > MAX_EXPERT_CAPTURE_FILE_SIZE) {
    const limitMB = MAX_EXPERT_CAPTURE_FILE_SIZE / (1024 * 1024);
    return NextResponse.json(
      { error: `File too large. Maximum size for Expert Captures is ${limitMB}MB.` },
      { status: 400 }
    );
  }

  try {
    // Create Document record with docType = EXPERT_CAPTURE
    const document = await prisma.document.create({
      data: {
        docType: "EXPERT_CAPTURE",
        title: metaResult.data.title,
        description: metaResult.data.description ?? null,
        fileName,
        fileType: "video",
        mimeType,
        fileUrl: blobUrl,
        fileSize,
        organizationId: session.user.organizationId,
        uploadedById: session.user.id,
      },
    });

    // Fire-and-forget processing. The file is already in Vercel Blob so the
    // processor fetches it from blobUrl directly (no buffer needed).
    // NOTE: On Vercel serverless, background work after HTTP response is killed.
    // For production, migrate to a webhook queue (e.g. Upstash QStash).
    processExpertCapture(document.id).catch((err) => {
      console.error(`Failed to process expert capture ${document.id}:`, err);
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Expert capture upload error:", error);
    return NextResponse.json(
      { error: "Failed to create expert capture record" },
      { status: 500 }
    );
  }
}
