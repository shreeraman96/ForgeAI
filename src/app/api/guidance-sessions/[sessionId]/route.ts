import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";

const updateSessionSchema = z.object({
  currentStep: z.number().min(1).optional(),
  status: z.enum(["COMPLETED", "ABANDONED"]).optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const { sessionId } = await params;
    const body = await request.json();
    const { currentStep, status } = updateSessionSchema.parse(body);

    const guidanceSession = await prisma.guidanceSession.findFirst({
      where: { id: sessionId, userId: session.user.id },
    });

    if (!guidanceSession) {
      return new Response(JSON.stringify({ error: "Session not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    const updated = await prisma.guidanceSession.update({
      where: { id: sessionId },
      data: {
        ...(currentStep !== undefined && { currentStep }),
        ...(status && {
          status,
          ...(status === "COMPLETED" && { completedAt: new Date() }),
        }),
      },
    });

    return Response.json(updated);
  } catch (error) {
    console.error("Update guidance session error:", error);
    return new Response(JSON.stringify({ error: "Failed to update session" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
