"use client";

import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";

interface StepNavigationProps {
  currentStepIndex: number;
  totalSteps: number;
  onPrevious: () => void;
  onNext: () => void;
  onRepeat: () => void;
  onComplete: () => void;
}

export function StepNavigation({
  currentStepIndex,
  totalSteps,
  onPrevious,
  onNext,
  onRepeat,
  onComplete,
}: StepNavigationProps) {
  const isFirst = currentStepIndex === 0;
  const isLast = currentStepIndex === totalSteps - 1;

  return (
    <div className="flex items-center justify-between gap-2 border-t pt-4">
      <Button
        variant="outline"
        onClick={onPrevious}
        disabled={isFirst}
        className="gap-1.5"
      >
        <ChevronLeft className="h-4 w-4" />
        Previous
      </Button>

      <Button
        variant="ghost"
        onClick={onRepeat}
        className="gap-1.5 text-muted-foreground"
      >
        <RotateCcw className="h-3.5 w-3.5" />
        Repeat
      </Button>

      {isLast ? (
        <Button onClick={onComplete} className="gap-1.5">
          <CheckCircle2 className="h-4 w-4" />
          Complete
        </Button>
      ) : (
        <Button onClick={onNext} className="gap-1.5">
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
