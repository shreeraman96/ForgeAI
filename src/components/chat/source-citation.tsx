"use client";

import { useState } from "react";
import { FileText, ChevronDown, ChevronUp } from "lucide-react";

interface SourceCitationProps {
  sources: {
    id: string;
    documentName: string;
    content: string;
    score: number;
  }[];
}

export function SourceCitation({ sources }: SourceCitationProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  return (
    <div className="px-4 pb-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors ml-11"
      >
        <FileText className="h-3 w-3" />
        {sources.length} source{sources.length > 1 ? "s" : ""}
        {expanded ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
      {expanded && (
        <div className="ml-11 mt-2 space-y-2">
          {sources.map((source) => (
            <div
              key={source.id}
              className="text-xs bg-muted/50 border rounded-lg p-3"
            >
              <div className="font-medium text-foreground mb-1">
                {source.documentName}
              </div>
              <div className="text-muted-foreground line-clamp-3">
                {source.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
