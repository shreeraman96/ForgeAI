"use client";

import { useState } from "react";
import { DocumentUpload } from "@/components/documents/document-upload";
import { DocumentList } from "@/components/documents/document-list";

export default function DocumentsPage() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your SOPs, manuals, and training docs. ForgeAI will
          automatically process and index them for your workers.
        </p>
      </div>
      <DocumentUpload
        onUploadComplete={() => setRefreshTrigger((n) => n + 1)}
      />
      <DocumentList refreshTrigger={refreshTrigger} />
    </div>
  );
}
