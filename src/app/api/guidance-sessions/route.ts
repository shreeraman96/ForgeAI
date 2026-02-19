import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const createSessionSchema = z.object({
  documentId: z.string(),
});

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { documentId } = createSessionSchema.parse(body);

    const document = await prisma.document.findFirst({
      where: {
        id: documentId,
        organizationId: session.user.organizationId,
        docType: "EXPERT_CAPTURE",
        status: "READY",
      },
      select: { id: true, expertCaptureData: true },
    });

    if (!document) {
      return new Response(JSON.stringify({ error: "Guide not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = document.expertCaptureData as Record<string, unknown>;
    const procedures = (data?.procedures as unknown[]) || [];

    // Return existing active session if one exists
    const existing = await prisma.guidanceSession.findFirst({
      where: {
        userId: session.user.id,
        documentId,
        status: "IN_PROGRESS",
      },
    });

    if (existing) {
      return Response.json(existing);
    }

    const guidanceSession = await prisma.guidanceSession.create({
      data: {
        userId: session.user.id,
        documentId,
        totalSteps: procedures.length,
        currentStep: 1,
      },
    });

    return Response.json(guidanceSession, { status: 201 });
  } catch (error) {
    console.error("Create guidance session error:", error);
    return new Response(JSON.stringify({ error: "Failed to create session" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
