"use client";

import { useState, useRef, useEffect } from "react";
import { ChatMessage } from "./chat-message";
import { ChatInput } from "./chat-input";
import { SourceCitation } from "./source-citation";
import { MessageSquare } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: { id: string; documentName: string; content: string; score: number }[];
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function handleSend(message: string) {
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: message,
    };

    const assistantMsg: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: "",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          sessionId: sessionId || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      // Capture session ID and sources from headers
      const newSessionId = response.headers.get("X-Chat-Session-Id");
      if (newSessionId) setSessionId(newSessionId);

      let sources: Message["sources"] = [];
      try {
        const sourcesHeader = response.headers.get("X-Source-Chunks");
        if (sourcesHeader) {
          sources = JSON.parse(decodeURIComponent(sourcesHeader));
        }
      } catch {
        // Ignore parse errors
      }

      // Stream the response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const text = decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: m.content + text, sources }
                : m
            )
          );
        }
      }

      // Final update with sources
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, sources } : m
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content:
                  "Sorry, I encountered an error. Please try again.",
              }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-lg font-semibold mb-2">
              Ask ForgeAI anything
            </h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Ask questions about your company&apos;s procedures, specs, and
              documentation. I&apos;ll find the answer from your uploaded files.
            </p>
          </div>
        ) : (
          <div className="py-4">
            {messages.map((msg) => (
              <div key={msg.id}>
                <ChatMessage
                  role={msg.role}
                  content={msg.content}
                  isStreaming={
                    isStreaming &&
                    msg.role === "assistant" &&
                    msg.id === messages[messages.length - 1]?.id
                  }
                />
                {msg.role === "assistant" &&
                  msg.sources &&
                  msg.sources.length > 0 &&
                  !isStreaming && <SourceCitation sources={msg.sources} />}
              </div>
            ))}
          </div>
        )}
      </div>
      <ChatInput onSend={handleSend} disabled={isStreaming} />
    </div>
  );
}
