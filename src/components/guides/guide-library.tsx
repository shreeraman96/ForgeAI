"use client";

import { useState, useEffect } from "react";
import { GuideCard } from "./guide-card";
import { Input } from "@/components/ui/input";
import { BookOpen, Search } from "lucide-react";

export interface Guide {
  id: string;
  title: string;
  expertName: string | null;
  duration: number | null;
  stepCount: number;
  summary: string | null;
  hasCriticalSteps: boolean;
  activeSession: { id: string; currentStep: number } | null;
  createdAt: string;
}

export function GuideLibrary() {
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/guides")
      .then((r) => r.json())
      .then((data) => setGuides(Array.isArray(data) ? data : []))
      .catch(() => setGuides([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = guides.filter((g) =>
    g.title.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-48 rounded-lg border bg-muted/30 animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (guides.length === 0) {
    return (
      <div className="py-16 text-center">
        <BookOpen className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">
          No guided procedures available yet.
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Ask your admin to upload expert walkthrough videos to create guides.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search guides..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">
          No guides match &quot;{search}&quot;.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((guide) => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </div>
      )}
    </div>
  );
}
