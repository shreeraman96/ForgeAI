import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/upload";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: session.user.organizationId,
    },
    include: {
      uploadedBy: { select: { name: true } },
      chunks: {
        select: { id: true, content: true, chunkIndex: true, pageNumber: true },
        orderBy: { chunkIndex: "asc" },
      },
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(document);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: session.user.organizationId,
    },
  });

  if (!document) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Delete file from blob storage
  try {
    await deleteFile(document.fileUrl);
  } catch {
    // Continue even if blob deletion fails
  }

  // Delete document (chunks cascade)
  await prisma.document.delete({ where: { id: documentId } });

  return NextResponse.json({ success: true });
}
