"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera } from "lucide-react";

interface ImageCaptureProps {
  onCapture: (base64: string, mimeType: string, previewUrl: string) => void;
  disabled?: boolean;
}

export function ImageCapture({ onCapture, disabled }: ImageCaptureProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClick() {
    inputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const mimeType = file.type || "image/jpeg";
    const previewUrl = URL.createObjectURL(file);

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      // dataUrl is "data:<mimeType>;base64,<base64data>" — extract just the base64 part
      const base64 = dataUrl.split(",")[1];
      onCapture(base64, mimeType, previewUrl);
    };
    reader.readAsDataURL(file);

    // Reset so the same file can be re-selected if needed
    e.target.value = "";
  }

  return (
    <>
      {/* Hidden file input — capture="environment" opens the rear camera on iOS/Android */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
        aria-hidden="true"
        tabIndex={-1}
      />
      <Button
        type="button"
        size="icon"
        variant="ghost"
        onClick={handleClick}
        disabled={disabled}
        aria-label="Attach photo"
        className="flex-shrink-0"
      >
        <Camera className="h-4 w-4" />
      </Button>
    </>
  );
}
