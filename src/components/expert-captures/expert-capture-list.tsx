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
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Trash2,
  Video,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface Procedure {
  stepNumber: number;
  title: string;
  description: string;
  timestamp?: { start: number; end: number };
  safetyLevel?: "NORMAL" | "WARNING" | "CRITICAL";
  warnings?: string[];
}

interface QAPair {
  question: string;
  answer: string;
}

interface SafetyNote {
  type: string;
  content: string;
}

interface ExpertCaptureData {
  expertName?: string;
  duration?: number;
  summary?: string;
  procedures?: Procedure[];
  qaTrainingPairs?: QAPair[];
  safetyNotes?: SafetyNote[];
  equipment?: Array<{ name: string; partNumber?: string; type?: string }>;
  tools?: Array<{ name: string; spec?: string }>;
}

interface ExpertCapture {
  id: string;
  title: string | null;
  fileName: string;
  fileSize: number;
  status: string;
  errorMessage: string | null;
  createdAt: string;
  uploadedBy: { name: string };
  _count: { chunks: number };
  expertCaptureData: ExpertCaptureData | null;
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

function SafetyLevelBadge({ level }: { level?: string }) {
  if (!level || level === "NORMAL") return null;
  if (level === "CRITICAL")
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <ShieldAlert className="h-3 w-3" />
        Critical
      </Badge>
    );
  return (
    <Badge className="gap-1 text-xs bg-yellow-100 text-yellow-800 border-yellow-200 hover:bg-yellow-100">
      <AlertTriangle className="h-3 w-3" />
      Warning
    </Badge>
  );
}

function formatDuration(seconds?: number): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}

function formatTimestamp(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function DetailSheet({
  capture,
  open,
  onClose,
}: {
  capture: ExpertCapture;
  open: boolean;
  onClose: () => void;
}) {
  const data = capture.expertCaptureData;
  const title = capture.title || capture.fileName;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <SheetTitle className="text-base leading-snug">{title}</SheetTitle>
          <p className="text-xs text-muted-foreground">
            {data?.expertName && `By ${data.expertName} · `}
            {formatDuration(data?.duration)}
          </p>
        </SheetHeader>

        {!data ? (
          <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-6">
            Knowledge extraction is still in progress. Check back when status is
            Ready.
          </div>
        ) : (
          <Tabs defaultValue="qa" className="flex-1 flex flex-col min-h-0">
            <TabsList className="mx-6 mt-4 w-auto self-start">
              <TabsTrigger value="qa">
                Q&amp;As ({data.qaTrainingPairs?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="procedures">
                Procedures ({data.procedures?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="safety">
                Safety ({data.safetyNotes?.length ?? 0})
              </TabsTrigger>
              <TabsTrigger value="summary">Summary</TabsTrigger>
            </TabsList>

            {/* Q&A Tab */}
            <TabsContent value="qa" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full px-6 py-4">
                {!data.qaTrainingPairs?.length ? (
                  <p className="text-sm text-muted-foreground">No Q&A pairs extracted.</p>
                ) : (
                  <div className="space-y-4">
                    {data.qaTrainingPairs.map((qa, i) => (
                      <div key={i} className="rounded-lg border p-4 space-y-2">
                        <p className="text-sm font-semibold text-foreground">
                          Q: {qa.question}
                        </p>
                        <Separator />
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {qa.answer}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Procedures Tab */}
            <TabsContent value="procedures" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full px-6 py-4">
                {!data.procedures?.length ? (
                  <p className="text-sm text-muted-foreground">No procedures extracted.</p>
                ) : (
                  <div className="space-y-4">
                    {data.procedures.map((proc) => (
                      <div key={proc.stepNumber} className="rounded-lg border p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">
                              Step {proc.stepNumber}
                            </span>
                            <p className="text-sm font-semibold">{proc.title}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <SafetyLevelBadge level={proc.safetyLevel} />
                            {proc.timestamp && (
                              <span className="text-xs text-muted-foreground">
                                {formatTimestamp(proc.timestamp.start)} – {formatTimestamp(proc.timestamp.end)}
                              </span>
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {proc.description}
                        </p>
                        {proc.warnings && proc.warnings.length > 0 && (
                          <div className="space-y-1 pt-1">
                            {proc.warnings.map((w, i) => (
                              <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400 flex items-start gap-1.5">
                                <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
                                {w}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Safety Tab */}
            <TabsContent value="safety" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full px-6 py-4">
                {!data.safetyNotes?.length ? (
                  <p className="text-sm text-muted-foreground">No safety notes extracted.</p>
                ) : (
                  <div className="space-y-3">
                    {data.safetyNotes.map((note, i) => (
                      <div key={i} className="rounded-lg border p-4 space-y-1">
                        <Badge variant="outline" className="text-xs">
                          {note.type}
                        </Badge>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {note.content}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* Summary Tab */}
            <TabsContent value="summary" className="flex-1 min-h-0 mt-0">
              <ScrollArea className="h-full px-6 py-4">
                {data.summary ? (
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
                    {data.summary}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">No summary available.</p>
                )}

                {(data.equipment?.length || data.tools?.length) ? (
                  <div className="mt-6 space-y-4">
                    {data.equipment?.length ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Equipment</p>
                        <div className="space-y-1">
                          {data.equipment.map((e, i) => (
                            <p key={i} className="text-sm">
                              {e.name}
                              {e.partNumber && <span className="text-muted-foreground"> · Part #{e.partNumber}</span>}
                              {e.type && <span className="text-muted-foreground"> [{e.type}]</span>}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {data.tools?.length ? (
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tools</p>
                        <div className="space-y-1">
                          {data.tools.map((t, i) => (
                            <p key={i} className="text-sm">
                              {t.name}
                              {t.spec && <span className="text-muted-foreground"> ({t.spec})</span>}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  );
}

export function ExpertCaptureList({ refreshTrigger }: ExpertCaptureListProps) {
  const [captures, setCaptures] = useState<ExpertCapture[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCapture, setSelectedCapture] = useState<ExpertCapture | null>(null);

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
      if (selectedCapture?.id === id) setSelectedCapture(null);
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
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Title</TableHead>
            <TableHead className="hidden sm:table-cell">Expert</TableHead>
            <TableHead className="hidden md:table-cell">Duration</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Chunks</TableHead>
            <TableHead className="hidden lg:table-cell">Procedures / Q&As</TableHead>
            <TableHead className="w-[90px]"></TableHead>
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
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    disabled={capture.status !== "READY"}
                    title="View extracted knowledge"
                    onClick={() => setSelectedCapture(capture)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
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
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {selectedCapture && (
        <DetailSheet
          capture={selectedCapture}
          open={!!selectedCapture}
          onClose={() => setSelectedCapture(null)}
        />
      )}
    </>
  );
}
