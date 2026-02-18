"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  Video,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

interface ExpertCapture {
  id: string;
  title: string | null;
  fileName: string;
  fileSize: number;
  status: string;
  createdAt: string;
  uploadedBy: { name: string };
  _count: { chunks: number };
  expertCaptureData: {
    expertName?: string;
    duration?: number;
    procedures?: unknown[];
    qaTrainingPairs?: unknown[];
  } | null;
}

interface ExpertCaptureListProps {
  refreshTrigger: number;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "READY":
      return (
        <Badge className="gap-1 bg-green-100 text-green-800 border-green-200 hover:bg-green-100">
          <CheckCircle2 className="h-3 w-3" />
          Ready
        </Badge>
      );
    case "PROCESSING":
      return (
        <Badge variant="secondary" className="gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Processing
        </Badge>
      );
    case "PENDING":
      return (
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" />
          Pending
        </Badge>
      );
    case "FAILED":
      return (
        <Badge variant="destructive" className="gap-1">
          <XCircle className="h-3 w-3" />
          Failed
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

export function ExpertCaptureList({ refreshTrigger }: ExpertCaptureListProps) {
  const [captures, setCaptures] = useState<ExpertCapture[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCaptures = useCallback(async () => {
    try {
      const res = await fetch("/api/expert-captures");
      if (res.ok) {
        setCaptures(await res.json());
      }
    } catch {
      // Silently fail on polling
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCaptures();
  }, [fetchCaptures, refreshTrigger]);

  // Poll every 5s while any capture is PENDING or PROCESSING
  useEffect(() => {
    const hasProcessing = captures.some(
      (c) => c.status === "PENDING" || c.status === "PROCESSING"
    );
    if (!hasProcessing) return;
    const interval = setInterval(fetchCaptures, 5000);
    return () => clearInterval(interval);
  }, [captures, fetchCaptures]);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;

    const res = await fetch(`/api/expert-captures/${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      toast.success(`Deleted "${title}"`);
      fetchCaptures();
    } else {
      toast.error("Failed to delete expert capture");
    }
  }

  if (loading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading expert captures...
      </div>
    );
  }

  if (captures.length === 0) {
    return (
      <div className="py-12 text-center">
        <Video className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm text-muted-foreground">
          No expert captures yet. Upload a walkthrough video to capture expert
          knowledge.
        </p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead className="hidden sm:table-cell">Expert</TableHead>
          <TableHead className="hidden md:table-cell">Duration</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="hidden md:table-cell">Chunks</TableHead>
          <TableHead className="hidden lg:table-cell">Procedures / Q&As</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {captures.map((capture) => (
          <TableRow key={capture.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-medium truncate max-w-[180px]">
                    {capture.title || capture.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground truncate max-w-[180px]">
                    {capture.fileName}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="hidden sm:table-cell text-muted-foreground">
              {capture.expertCaptureData?.expertName || "—"}
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">
              {formatDuration(capture.expertCaptureData?.duration)}
            </TableCell>
            <TableCell>
              <StatusBadge status={capture.status} />
            </TableCell>
            <TableCell className="hidden md:table-cell text-muted-foreground">
              {capture._count.chunks || "—"}
            </TableCell>
            <TableCell className="hidden lg:table-cell text-muted-foreground text-xs">
              {capture.expertCaptureData
                ? `${capture.expertCaptureData.procedures?.length ?? 0} steps / ${capture.expertCaptureData.qaTrainingPairs?.length ?? 0} Q&As`
                : "—"}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() =>
                  handleDelete(
                    capture.id,
                    capture.title || capture.fileName
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
