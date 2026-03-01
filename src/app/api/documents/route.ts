import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ALLOWED_FILE_TYPES, getMaxFileSize, getFileType } from "@/lib/validations";
import { processDocument } from "@/lib/ai/process-document";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const documents = await prisma.document.findMany({
    where: { organizationId: session.user.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      uploadedBy: { select: { name: true } },
      _count: { select: { chunks: true } },
    },
  });

  return NextResponse.json(documents);
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
  const { blobUrl, fileName, mimeType, fileSize } = body as {
    blobUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
  };

  if (!blobUrl || !fileName || !mimeType) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (!ALLOWED_FILE_TYPES.includes(mimeType)) {
    return NextResponse.json(
      { error: "File type not supported. Use PDF, DOCX, PNG, JPG, MP3, WAV, MP4, or WebM." },
      { status: 400 }
    );
  }

  const maxSize = getMaxFileSize(mimeType);
  if (fileSize > maxSize) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${maxSize / (1024 * 1024)}MB.` },
      { status: 400 }
    );
  }

  try {
    const document = await prisma.document.create({
      data: {
        fileName,
        fileType: getFileType(mimeType),
        mimeType,
        fileUrl: blobUrl,
        fileSize,
        organizationId: session.user.organizationId,
        uploadedById: session.user.id,
      },
    });

    // Process document asynchronously (fire-and-forget)
    processDocument(document.id).catch((err) => {
      console.error(`Failed to process document ${document.id}:`, err);
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Failed to create document record" },
      { status: 500 }
    );
  }
}
