import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { documentId } = await params;

  const document = await prisma.document.findFirst({
    where: {
      id: documentId,
      organizationId: session.user.organizationId,
      docType: "EXPERT_CAPTURE",
      status: "READY",
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      expertCaptureData: true,
      guidanceSessions: {
        where: { userId: session.user.id, status: "IN_PROGRESS" },
        take: 1,
        select: { id: true, currentStep: true },
      },
    },
  });

  if (!document) {
    return new Response(JSON.stringify({ error: "Guide not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return Response.json({
    ...document,
    activeSession: document.guidanceSessions[0] || null,
  });
}
