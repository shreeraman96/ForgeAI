"use client";

import { useState, useRef } from "react";
import { upload } from "@vercel/blob/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Video, Upload } from "lucide-react";
import { toast } from "sonner";

interface ExpertCaptureUploadProps {
  onUploadComplete: () => void;
}

export function ExpertCaptureUpload({
  onUploadComplete,
}: ExpertCaptureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileSelect(file: File) {
    if (!file.type.startsWith("video/")) {
      toast.error("Only video files are accepted for Expert Captures");
      return;
    }
    setSelectedFile(file);
    // Auto-suggest title from filename if title is empty (functional update avoids stale closure)
    const derived = file.name
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    setTitle((prev) => prev || derived);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedFile) {
      toast.error("Please select a video file");
      return;
    }
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }

    setUploading(true);

    try {
      // Step 1: Upload directly to Vercel Blob (bypasses the serverless function
      // payload limit — the file bytes never touch our API routes).
      const blob = await upload(selectedFile.name, selectedFile, {
        access: "public",
        handleUploadUrl: "/api/blob/upload",
        clientPayload: "expert-capture",
        multipart: true,
      });

      // Step 2: POST only the blob URL + metadata to create the DB record.
      const res = await fetch("/api/expert-captures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blobUrl: blob.url,
          fileName: selectedFile.name,
          mimeType: selectedFile.type,
          fileSize: selectedFile.size,
          title: title.trim(),
          description: description.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Upload failed");
      }

      toast.success(
        "Expert capture uploaded. AI processing will begin shortly and may take several minutes."
      );
      setSelectedFile(null);
      setTitle("");
      setDescription("");
      if (inputRef.current) inputRef.current.value = "";
      onUploadComplete();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Upload failed"
      );
    } finally {
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* File drop zone */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors cursor-pointer ${
          dragActive
            ? "border-primary bg-primary/5"
            : selectedFile
              ? "border-green-500 bg-green-50 dark:bg-green-950/20"
              : "border-muted-foreground/25 hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          const file = e.dataTransfer.files[0];
          if (file) handleFileSelect(file);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept="video/mp4,video/webm,video/mpeg,video/quicktime"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFileSelect(file);
          }}
        />
        <div className="flex flex-col items-center gap-2">
          <Video className="h-8 w-8 text-muted-foreground" />
          {selectedFile ? (
            <div>
              <p className="text-sm font-medium text-green-700 dark:text-green-400">
                {selectedFile.name}
              </p>
              <p className="text-xs text-muted-foreground">
                {(selectedFile.size / (1024 * 1024)).toFixed(1)} MB
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium">
                Drop expert walkthrough video here
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                MP4, WebM, MPEG, MOV up to 500MB
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <Label htmlFor="ec-title">
          Procedure Title{" "}
          <span className="text-destructive">*</span>
        </Label>
        <Input
          id="ec-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Hydraulic Pump Seal Replacement"
          maxLength={200}
          required
        />
      </div>

      {/* Description */}
      <div className="space-y-1.5">
        <Label htmlFor="ec-description">
          Description{" "}
          <span className="text-xs text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="ec-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief context: what equipment, what environment, any prerequisites..."
          rows={3}
          maxLength={1000}
        />
      </div>

      <Button
        type="submit"
        disabled={uploading || !selectedFile}
        className="w-full"
      >
        {uploading ? (
          <>
            <Upload className="h-4 w-4 mr-2 animate-bounce" />
            Uploading...
          </>
        ) : (
          <>
            <Upload className="h-4 w-4 mr-2" />
            Upload Expert Capture
          </>
        )}
      </Button>
    </form>
  );
}
