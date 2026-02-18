"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileUp } from "lucide-react";
import { toast } from "sonner";

interface DocumentUploadProps {
  onUploadComplete: () => void;
}

export function DocumentUpload({ onUploadComplete }: DocumentUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/documents", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Upload failed");
    }

    return res.json();
  }

  async function handleFiles(files: FileList | File[]) {
    setUploading(true);
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      try {
        await uploadFile(file);
        toast.success(`Uploaded ${file.name}`);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : `Failed to upload ${file.name}`
        );
      }
    }

    setUploading(false);
    onUploadComplete();
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
        dragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-muted-foreground/50"
      }`}
      onDragOver={(e) => {
        e.preventDefault();
        setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,.mp3,.m4a,.wav,.mp4,.webm,.mpeg"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
        }}
      />
      <div className="flex flex-col items-center gap-3">
        {uploading ? (
          <FileUp className="h-10 w-10 text-primary animate-bounce" />
        ) : (
          <Upload className="h-10 w-10 text-muted-foreground" />
        )}
        <div>
          <p className="text-sm font-medium">
            {uploading ? "Uploading..." : "Drag & drop files here"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            PDF, DOCX, PNG, JPG, MP3, WAV, MP4, WebM up to 25MB
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          Browse files
        </Button>
      </div>
    </div>
  );
}
