"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, ChevronRight, Clock, ListChecks, User } from "lucide-react";
import type { Guide } from "./guide-library";

function formatDuration(seconds: number | null): string {
  if (!seconds) return "";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

interface GuideCardProps {
  guide: Guide;
}

export function GuideCard({ guide }: GuideCardProps) {
  const duration = formatDuration(guide.duration);
  const isResuming = !!guide.activeSession;
  const resumeStep = guide.activeSession?.currentStep;

  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-snug line-clamp-2">
            {guide.title}
          </CardTitle>
          {guide.hasCriticalSteps && (
            <Badge className="flex-shrink-0 gap-1 bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Safety
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 space-y-2 pb-3">
        {guide.summary && (
          <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed">
            {guide.summary}
          </p>
        )}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {guide.expertName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {guide.expertName}
            </span>
          )}
          <span className="flex items-center gap-1">
            <ListChecks className="h-3 w-3" />
            {guide.stepCount} {guide.stepCount === 1 ? "step" : "steps"}
          </span>
          {duration && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {duration}
            </span>
          )}
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <Button asChild className="w-full" variant={isResuming ? "outline" : "default"}>
          <Link href={`/guides/${guide.id}`}>
            {isResuming ? (
              <>Resume (Step {resumeStep})<ChevronRight className="h-4 w-4 ml-1" /></>
            ) : (
              <>Start Guide<ChevronRight className="h-4 w-4 ml-1" /></>
            )}
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
