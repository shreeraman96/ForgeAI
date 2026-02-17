"use client";

import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, XCircle, Clock } from "lucide-react";

const statusConfig = {
  PENDING: {
    label: "Pending",
    variant: "secondary" as const,
    icon: Clock,
  },
  PROCESSING: {
    label: "Processing",
    variant: "default" as const,
    icon: Loader2,
  },
  READY: {
    label: "Ready",
    variant: "default" as const,
    icon: CheckCircle,
  },
  FAILED: {
    label: "Failed",
    variant: "destructive" as const,
    icon: XCircle,
  },
};

export function DocumentStatusBadge({ status }: { status: string }) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.PENDING;
  const Icon = config.icon;

  return (
    <Badge variant={config.variant} className="gap-1">
      <Icon
        className={`h-3 w-3 ${status === "PROCESSING" ? "animate-spin" : ""}`}
      />
      {config.label}
    </Badge>
  );
}
