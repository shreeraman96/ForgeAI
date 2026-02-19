import { GuidedProcedure } from "@/components/guides/guided-procedure";

export default async function GuidedModePage({
  params,
}: {
  params: Promise<{ documentId: string }>;
}) {
  const { documentId } = await params;
  return <GuidedProcedure documentId={documentId} />;
}
