"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, X } from "lucide-react";
import { ImageCapture } from "./image-capture";
import { VoiceRecorder } from "./voice-recorder";

interface ImageAttachment {
  base64: string;
  mimeType: string;
  previewUrl: string;
}

interface ChatInputProps {
  onSend: (message: string, image?: { base64: string; mimeType: string }) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [input, setInput] = useState("");
  const [imageAttachment, setImageAttachment] = useState<ImageAttachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if ((!trimmed && !imageAttachment) || disabled) return;
    onSend(
      trimmed,
      imageAttachment
        ? { base64: imageAttachment.base64, mimeType: imageAttachment.mimeType }
        : undefined
    );
    setInput("");
    setImageAttachment(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }

  function handleInput(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }

  function handleCapture(base64: string, mimeType: string, previewUrl: string) {
    setImageAttachment({ base64, mimeType, previewUrl });
  }

  function clearAttachment() {
    if (imageAttachment) URL.revokeObjectURL(imageAttachment.previewUrl);
    setImageAttachment(null);
  }

  function handleTranscription(text: string) {
    setInput((prev) => (prev ? prev + " " + text : text));
    textareaRef.current?.focus();
  }

  const canSend = (input.trim().length > 0 || imageAttachment !== null) && !disabled;

  return (
    <div className="border-t bg-background">
      {/* Image attachment preview */}
      {imageAttachment && (
        <div className="px-3 pt-3">
          <div className="relative inline-block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageAttachment.previewUrl}
              alt="Attachment preview"
              className="h-20 w-20 rounded-md object-cover border"
            />
            <button
              type="button"
              onClick={clearAttachment}
              className="absolute -top-2 -right-2 rounded-full bg-background border p-0.5 hover:bg-muted"
              aria-label="Remove attachment"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </div>
      )}
      <form onSubmit={handleSubmit} className="p-3 flex gap-2 items-end">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Ask a question about your documents..."
          disabled={disabled}
          rows={1}
          className="min-h-[40px] max-h-[120px] resize-none"
        />
        <ImageCapture onCapture={handleCapture} disabled={disabled} />
        <VoiceRecorder onTranscription={handleTranscription} disabled={disabled} />
        <Button
          type="submit"
          size="icon"
          disabled={!canSend}
          className="flex-shrink-0"
        >
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
