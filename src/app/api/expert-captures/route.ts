import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadFile } from "@/lib/upload";
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

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const title = formData.get("title") as string | null;
  const description = formData.get("description") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
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
  if (!ALLOWED_EXPERT_CAPTURE_TYPES.includes(file.type)) {
    return NextResponse.json(
      {
        error:
          "Only MP4, WebM, MPEG, and MOV video files are accepted for Expert Captures.",
      },
      { status: 400 }
    );
  }

  // Validate file size
  if (file.size > MAX_EXPERT_CAPTURE_FILE_SIZE) {
    const limitMB = MAX_EXPERT_CAPTURE_FILE_SIZE / (1024 * 1024);
    return NextResponse.json(
      { error: `File too large. Maximum size for Expert Captures is ${limitMB}MB.` },
      { status: 400 }
    );
  }

  try {
    // Buffer the video before uploading — reuse this buffer in the processor
    // to avoid a redundant Blob re-download (which fails with mock/local Blob storage).
    const videoBuffer = Buffer.from(await file.arrayBuffer());

    // Upload to Vercel Blob
    const blob = await uploadFile(file);

    // Create Document record with docType = EXPERT_CAPTURE
    const document = await prisma.document.create({
      data: {
        docType: "EXPERT_CAPTURE",
        title: metaResult.data.title,
        description: metaResult.data.description ?? null,
        fileName: file.name,
        fileType: "video",
        mimeType: file.type,
        fileUrl: blob.url,
        fileSize: file.size,
        organizationId: session.user.organizationId,
        uploadedById: session.user.id,
      },
    });

    // Fire-and-forget processing — pass the buffer directly to skip the Blob re-download.
    // NOTE: On Vercel serverless, background work after HTTP response is killed.
    // For production, migrate to a webhook queue (e.g. Upstash QStash).
    // For local dev and VPS, this works correctly.
    processExpertCapture(document.id, videoBuffer).catch((err) => {
      console.error(`Failed to process expert capture ${document.id}:`, err);
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Expert capture upload error:", error);
    return NextResponse.json(
      { error: "Failed to upload expert capture video" },
      { status: 500 }
    );
  }
}
