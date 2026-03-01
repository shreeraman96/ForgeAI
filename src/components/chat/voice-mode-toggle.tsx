"use client";

import { Button } from "@/components/ui/button";
import { AudioLines } from "lucide-react";

interface VoiceModeToggleProps {
  onActivate: () => void;
  disabled?: boolean;
}

export function VoiceModeToggle({ onActivate, disabled }: VoiceModeToggleProps) {
  return (
    <Button
      type="button"
      size="icon"
      variant="ghost"
      disabled={disabled}
      onClick={onActivate}
      aria-label="Start voice conversation"
      title="Voice conversation mode"
      className="flex-shrink-0"
    >
      <AudioLines className="h-4 w-4" />
    </Button>
  );
}
