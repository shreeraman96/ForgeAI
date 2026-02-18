"use client";

import { useState } from "react";
import { ExpertCaptureUpload } from "@/components/expert-captures/expert-capture-upload";
import { ExpertCaptureList } from "@/components/expert-captures/expert-capture-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ExpertCapturesPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Expert Captures</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload expert walkthrough videos. ForgeAI uses Gemini AI to analyze
          the visual content and audio, then structures the knowledge into
          searchable procedures, Q&A pairs, and safety notes for workers to
          query in chat.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Upload Expert Walkthrough Video
          </CardTitle>
          <CardDescription>
            Processing takes 3–8 minutes per video. The expert knowledge will be
            available in worker chat once the status shows &ldquo;Ready&rdquo;.
            Supported formats: MP4, WebM, MPEG, MOV (up to 500MB).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ExpertCaptureUpload
            onUploadComplete={() => setRefreshTrigger((n) => n + 1)}
          />
        </CardContent>
      </Card>

      <ExpertCaptureList refreshTrigger={refreshTrigger} />
    </div>
  );
}
