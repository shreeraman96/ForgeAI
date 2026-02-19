"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronDown, ChevronUp, Loader2, MessageSquare, Send } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface StepChatProps {
  documentId: string;
  stepNumber: number;
  stepTitle: string;
  stepDescription: string;
  procedureTitle: string;
  warnings?: string[];
  onSpeakResponse?: (text: string) => void;
  voiceQuestion?: { text: string; id: number } | null;
}

export function StepChat({
  documentId,
  stepNumber,
  stepTitle,
  stepDescription,
  procedureTitle,
  warnings,
  onSpeakResponse,
  voiceQuestion,
}: StepChatProps) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // When a voice question arrives, open the panel and submit it
  useEffect(() => {
    if (!voiceQuestion?.text) return;
    setOpen(true);
    handleSend(voiceQuestion.text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [voiceQuestion]);

  async function handleSend(question: string = input) {
    const q = question.trim();
    if (!q || isLoading) return;

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content: q };
    const assistantMsg: Message = {
      id: `a-${Date.now()}`,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/guidance-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: q,
          documentId,
          stepNumber,
          stepTitle,
          stepDescription,
          procedureTitle,
          warnings: warnings ?? [],
        }),
      });

      if (!res.ok) throw new Error("Failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          fullResponse += chunk;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id ? { ...m, content: fullResponse } : m
            )
          );
          // Auto-scroll
          if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
          }
        }
      }

      // Speak response aloud
      if (fullResponse && onSpeakResponse) {
        onSpeakResponse(fullResponse);
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "Sorry, I couldn't get an answer. Please try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Toggle header */}
      <button
        type="button"
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Ask a question about this step
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t">
          {/* Message list */}
          {messages.length > 0 && (
            <div
              ref={scrollRef}
              className="max-h-56 overflow-y-auto p-3 space-y-3"
            >
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`text-sm ${
                    msg.role === "user"
                      ? "text-right"
                      : "text-left text-muted-foreground"
                  }`}
                >
                  <span
                    className={`inline-block px-3 py-2 rounded-lg max-w-[85%] text-left ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    {msg.content || (
                      <span className="inline-flex items-center gap-1">
                        <Loader2 className="h-3 w-3 animate-spin" />
                        Thinking...
                      </span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 p-3 border-t">
            <Input
              placeholder="Ask about this step..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={isLoading}
              className="flex-1 text-sm"
            />
            <Button
              size="icon"
              onClick={() => handleSend()}
              disabled={!input.trim() || isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
