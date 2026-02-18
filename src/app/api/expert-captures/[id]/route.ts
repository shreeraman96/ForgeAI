import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { deleteFile } from "@/lib/upload";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const doc = await prisma.document.findFirst({
    where: {
      id,
      organizationId: session.user.organizationId,
      docType: "EXPERT_CAPTURE",
    },
  });

  if (!doc) {
    return NextResponse.json(
      { error: "Expert capture not found" },
      { status: 404 }
    );
  }

  try {
    // Delete from Vercel Blob (ignore error if already deleted)
    await deleteFile(doc.fileUrl).catch(() => {});

    // Delete Document record — cascade handles DocumentChunk rows
    await prisma.document.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete expert capture error:", error);
    return NextResponse.json({ error: "Failed to delete" }, { status: 500 });
  }
}
