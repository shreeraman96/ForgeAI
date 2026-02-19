"use client";

import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldAlert } from "lucide-react";

export interface Procedure {
  stepNumber: number;
  title: string;
  description: string;
  timestamp?: { start: number; end: number };
  safetyLevel?: "NORMAL" | "WARNING" | "CRITICAL";
  warnings?: string[];
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function SafetyLevelBadge({ level }: { level?: string }) {
  if (!level || level === "NORMAL") return null;
  if (level === "CRITICAL")
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <ShieldAlert className="h-3 w-3" />
        Critical Safety Step
      </Badge>
    );
  return (
    <Badge className="gap-1 text-xs bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
      <AlertTriangle className="h-3 w-3" />
      Safety Warning
    </Badge>
  );
}

interface StepDisplayProps {
  procedure: Procedure;
  currentStepIndex: number;
  totalSteps: number;
}

export function StepDisplay({ procedure, currentStepIndex, totalSteps }: StepDisplayProps) {
  const percent = ((currentStepIndex + 1) / totalSteps) * 100;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Step {currentStepIndex + 1} of {totalSteps}
          </span>
          <span>{Math.round(percent)}% complete</span>
        </div>
        <div className="w-full bg-muted rounded-full h-2">
          <div
            className="bg-primary h-2 rounded-full transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Step header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
            Step {procedure.stepNumber}
          </span>
          <SafetyLevelBadge level={procedure.safetyLevel} />
          {procedure.timestamp && (
            <span className="text-xs text-muted-foreground">
              {formatTimestamp(procedure.timestamp.start)} –{" "}
              {formatTimestamp(procedure.timestamp.end)}
            </span>
          )}
        </div>
        <h2 className="text-xl font-semibold leading-snug">{procedure.title}</h2>
      </div>

      {/* Description */}
      <p className="text-sm leading-relaxed text-foreground">{procedure.description}</p>

      {/* Warnings */}
      {procedure.warnings && procedure.warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20 dark:border-yellow-900 p-4 space-y-2">
          <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-400 uppercase tracking-wide">
            Warnings
          </p>
          <div className="space-y-1">
            {procedure.warnings.map((w, i) => (
              <p
                key={i}
                className="text-sm text-yellow-800 dark:text-yellow-300 flex items-start gap-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                {w}
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
