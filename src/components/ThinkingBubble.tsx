"use client";

import { useEffect, useState } from "react";

/**
 * Shows a simple processing status and the real elapsed time since the request was sent.
 * The labels describe pipeline stages only; they are not the model's reasoning.
 */
export function ThinkingBubble({ startedAt }: { startedAt: number }) {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const id = setInterval(() => setNow(performance.now()), 100);
    return () => clearInterval(id);
  }, []);

  const secs = Math.max(0, (now - startedAt) / 1000);
  const label = secs < 3 ? "Thinking…" : secs < 10 ? "Processing your request…" : "Preparing a response…";

  return (
    <div className="msg-in inline-flex items-center gap-3 rounded-full border border-border bg-surface px-4 py-2 text-sm text-muted" role="status" aria-live="polite">
      <span className="flex items-center gap-1" aria-hidden="true">
        <span className="dot" />
        <span className="dot" />
        <span className="dot" />
      </span>
      <span>{label}</span>
      <span className="tabular-nums text-muted/80">{secs.toFixed(1)}s</span>
    </div>
  );
}
