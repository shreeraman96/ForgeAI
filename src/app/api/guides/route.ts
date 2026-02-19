import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const documents = await prisma.document.findMany({
    where: {
      organizationId: session.user.organizationId,
      docType: "EXPERT_CAPTURE",
      status: "READY",
    },
    select: {
      id: true,
      title: true,
      fileName: true,
      expertCaptureData: true,
      createdAt: true,
      guidanceSessions: {
        where: { userId: session.user.id, status: "IN_PROGRESS" },
        take: 1,
        select: { id: true, currentStep: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const guides = documents
    .filter((d) => {
      const data = d.expertCaptureData as Record<string, unknown> | null;
      return data && Array.isArray(data.procedures) && (data.procedures as unknown[]).length > 0;
    })
    .map((d) => {
      const data = d.expertCaptureData as Record<string, unknown>;
      const procedures = data.procedures as Array<Record<string, unknown>>;
      return {
        id: d.id,
        title: d.title || d.fileName,
        expertName: (data.expertName as string) || null,
        duration: (data.duration as number) || null,
        stepCount: procedures.length,
        summary: (data.summary as string) || null,
        hasCriticalSteps: procedures.some(
          (p) => p.safetyLevel === "CRITICAL" || p.safetyLevel === "WARNING"
        ),
        activeSession: d.guidanceSessions[0] || null,
        createdAt: d.createdAt,
      };
    });

  return Response.json(guides);
}
