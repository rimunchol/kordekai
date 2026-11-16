"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Composer } from "./Composer";
import { MessageItem, type ChatMsg } from "./MessageItem";
import { ThinkingBubble } from "./ThinkingBubble";
import { Logo } from "./Logo";
import { Icon } from "./icons";
import { useApp } from "./AppShell";

type SseEvent =
  | { t: "meta"; conversationId: string; title: string | null }
  | { t: "delta"; v: string }
  | { t: "error"; message: string; partial?: boolean }
  | { t: "done"; messageId: string | null; status: "ok" | "error" | "aborted" };

export function Chat({ conversationId, initialMessages }: { conversationId?: string; initialMessages?: ChatMsg[] }) {
  const app = useApp();
  const [messages, setMessages] = useState<ChatMsg[]>(initialMessages ?? []);
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<"idle" | "thinking" | "streaming">("idle");
  const [startedAt, setStartedAt] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);

  const convRef = useRef(conversationId);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const bufferRef = useRef("");
  const rafRef = useRef<number | null>(null);

  // Batch streamed tokens into at most one render per frame.
  const flush = useCallback(() => {
    rafRef.current = null;
    const chunk = bufferRef.current;
    if (!chunk) return;
    bufferRef.current = "";
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (!last || last.role !== "assistant") return prev;
      return [...prev.slice(0, -1), { ...last, content: last.content + chunk }];
    });
    setPhase("streaming");
  }, []);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || phase !== "idle") return;

    setError(null);
    setInput("");
    stickRef.current = true;
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", content: text },
      { id: crypto.randomUUID(), role: "assistant", content: "" },
    ]);
    setPhase("thinking");
    setStartedAt(performance.now());

    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let status: ChatMsg["status"] = "complete";
    let failedBeforeStream = false;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: convRef.current, message: text }),
        signal: ctrl.signal,
      });

      if (!res.ok || !res.body) {
        failedBeforeStream = true;
        let msg = "Something went wrong. Please try again.";
        try {
          msg = (await res.json()).error ?? msg;
        } catch {}
        if (res.status === 401) {
          window.location.href = "/login";
          return;
        }
        if (res.status === 403) {
          window.location.href = "/login?reason=banned";
          return;
        }
        throw new Error(msg);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      const handle = (evt: SseEvent) => {
        if (evt.t === "meta") {
          if (!convRef.current) {
            convRef.current = evt.conversationId;
            app.addConversation({ id: evt.conversationId, title: evt.title ?? "New chat", updatedAt: new Date().toISOString() });
            // Update the URL without remounting this component.
            window.history.replaceState(null, "", `/c/${evt.conversationId}`);
          } else {
            app.touchConversation(convRef.current);
          }
        } else if (evt.t === "delta") {
          bufferRef.current += evt.v;
          if (rafRef.current === null) rafRef.current = requestAnimationFrame(flush);
        } else if (evt.t === "error") {
          setError(evt.message);
          status = "error";
        } else if (evt.t === "done") {
          if (evt.status === "aborted") status = "stopped";
          else if (evt.status === "error") status = "error";
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf("\n\n")) >= 0) {
          const raw = buf.slice(0, idx);
          buf = buf.slice(idx + 2);
          if (!raw.startsWith("data:")) continue;
          try {
            handle(JSON.parse(raw.slice(5)) as SseEvent);
          } catch {}
        }
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") {
        status = "stopped";
      } else if (failedBeforeStream) {
        status = "error";
        setError((err as Error).message);
      } else {
        status = "error";
        setError("The connection was interrupted.");
      }
    } finally {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const tail = bufferRef.current;
      bufferRef.current = "";
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (!last || last.role !== "assistant") return prev;
        const content = last.content + tail;
        if (!content.trim()) {
          // Nothing was generated: drop the placeholder; on pre-stream failure also drop the user message.
          const rest = prev.slice(0, -1);
          return failedBeforeStream ? rest.slice(0, -1) : rest;
        }
        return [...prev.slice(0, -1), { ...last, content, status }];
      });
      if (failedBeforeStream) setInput(text);
      setPhase("idle");
      abortRef.current = null;
    }
  }, [input, phase, app, flush]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Keep pinned to the bottom unless the user scrolled away.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, phase]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const near = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    stickRef.current = near;
    setShowJump((prev) => (prev === !near ? prev : !near));
  };

  const jumpToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  const busy = phase !== "idle";
  const empty = messages.length === 0;
  const composer = <Composer value={input} onChange={setInput} onSend={send} onStop={stop} busy={busy} autoFocus />;

  if (empty) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="fade-in w-full max-w-3xl">
          <div className="mb-8 flex flex-col items-center gap-4 text-center">
            <Logo size={40} />
            <h1 className="text-2xl font-semibold tracking-tight">Hello, {app.user.username}</h1>
            <p className="text-muted">What can I help you with today?</p>
          </div>
          {composer}
          {error && <p role="alert" className="mt-3 text-center text-sm text-danger">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-7 px-4 pb-8 pt-16">
          {messages.map((m, i) => {
            const last = i === messages.length - 1;
            if (last && phase === "thinking" && m.role === "assistant" && m.content === "") {
              return (
                <div key={m.id}>
                  <ThinkingBubble startedAt={startedAt} />
                </div>
              );
            }
            return <MessageItem key={m.id} message={m} streaming={last && busy && m.role === "assistant"} />;
          })}
        </div>
      </div>

      <div className="relative px-4 pb-3 pt-1">
        {showJump && (
          <button
            onClick={jumpToBottom}
            aria-label="Scroll to latest"
            className="fade-in absolute -top-11 left-1/2 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-bg text-muted shadow-md transition-colors hover:text-fg"
          >
            <Icon name="arrowDown" size={16} />
          </button>
        )}
        <div className="mx-auto w-full max-w-3xl">
          {error && <p role="alert" className="mb-2 text-center text-sm text-danger">{error}</p>}
          {composer}
          <p className="mt-2 text-center text-xs text-muted">KordekAI can make mistakes. Check important information.</p>
        </div>
      </div>
    </div>
  );
}
