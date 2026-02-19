import { GuideLibrary } from "@/components/guides/guide-library";

export default function GuidesPage() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Step-by-Step Guides</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a guide to walk through a procedure step by step with audio guidance.
        </p>
      </div>
      <GuideLibrary />
    </div>
  );
}
