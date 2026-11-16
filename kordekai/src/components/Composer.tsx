"use client";

import { useEffect, useRef } from "react";
import { Icon } from "./icons";

export function Composer({
  value,
  onChange,
  onSend,
  onStop,
  busy,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  busy: boolean;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  // Grow with content up to a cap, then scroll.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [value]);

  useEffect(() => {
    if (autoFocus && matchMedia("(pointer: fine)").matches) ref.current?.focus();
  }, [autoFocus]);

  const canSend = value.trim().length > 0 && !busy;

  return (
    <div className="rounded-[26px] border border-border bg-surface px-4 py-2.5 transition-colors focus-within:border-muted/60">
      <div className="flex items-end gap-2">
        <textarea
          ref={ref}
          value={value}
          rows={1}
          maxLength={8000}
          placeholder="Message KordekAI"
          aria-label="Message"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              if (canSend) onSend();
            }
          }}
          className="max-h-[200px] min-h-[28px] flex-1 resize-none bg-transparent py-1 leading-6 outline-none placeholder:text-muted/70"
        />
        {busy ? (
          <button
            onClick={onStop}
            aria-label="Stop generating"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fg text-bg transition-opacity hover:opacity-85"
          >
            <Icon name="stop" size={14} />
          </button>
        ) : (
          <button
            onClick={onSend}
            disabled={!canSend}
            aria-label="Send message"
            className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-fg text-bg transition-opacity hover:opacity-85 disabled:opacity-25"
          >
            <Icon name="send" size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
