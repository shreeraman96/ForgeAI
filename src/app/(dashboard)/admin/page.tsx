import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, MessageSquare, CheckCircle } from "lucide-react";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const orgId = session.user.organizationId;

  const [totalDocs, readyDocs, processingDocs, failedDocs, totalWorkers, totalQuestions] =
    await Promise.all([
      prisma.document.count({ where: { organizationId: orgId } }),
      prisma.document.count({ where: { organizationId: orgId, status: "READY" } }),
      prisma.document.count({ where: { organizationId: orgId, status: "PROCESSING" } }),
      prisma.document.count({ where: { organizationId: orgId, status: "FAILED" } }),
      prisma.user.count({ where: { organizationId: orgId } }),
      prisma.chatMessage.count({
        where: {
          role: "USER",
          session: { user: { organizationId: orgId } },
        },
      }),
    ]);

  const recentDocs: { id: string; fileName: string; status: string; createdAt: Date }[] = await prisma.document.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      fileName: true,
      status: true,
      createdAt: true,
    },
  });

  const recentQuestions: { id: string; content: string; createdAt: Date; session: { user: { name: string } } }[] = await prisma.chatMessage.findMany({
    where: {
      role: "USER",
      session: { user: { organizationId: orgId } },
    },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: {
      id: true,
      content: true,
      createdAt: true,
      session: { select: { user: { select: { name: true } } } },
    },
  });

  const stats = [
    {
      title: "Total Documents",
      value: totalDocs,
      detail: `${readyDocs} ready, ${processingDocs} processing, ${failedDocs} failed`,
      icon: FileText,
    },
    {
      title: "Workers",
      value: totalWorkers,
      detail: "Active members",
      icon: Users,
    },
    {
      title: "Questions Asked",
      value: totalQuestions,
      detail: "All time",
      icon: MessageSquare,
    },
    {
      title: "Knowledge Ready",
      value: readyDocs,
      detail: "Documents indexed",
      icon: CheckCircle,
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Overview of your ForgeAI knowledge base.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.detail}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Uploads</CardTitle>
          </CardHeader>
          <CardContent>
            {recentDocs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No documents uploaded yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="truncate max-w-[200px]">
                      {doc.fileName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(doc.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Questions</CardTitle>
          </CardHeader>
          <CardContent>
            {recentQuestions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No questions asked yet.
              </p>
            ) : (
              <div className="space-y-3">
                {recentQuestions.map((q) => (
                  <div key={q.id} className="text-sm">
                    <p className="truncate">{q.content}</p>
                    <p className="text-xs text-muted-foreground">
                      {q.session.user.name} &middot;{" "}
                      {new Date(q.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
