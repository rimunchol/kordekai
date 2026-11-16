"use client";

import dynamic from "next/dynamic";
import { memo, useState } from "react";
import { Icon } from "./icons";

const Markdown = dynamic(() => import("./Markdown"), {
  loading: () => <div className="h-5" />,
});

export type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  content: string;
  status?: "complete" | "stopped" | "error";
};

function MessageItemImpl({ message, streaming }: { message: ChatMsg; streaming: boolean }) {
  const [copied, setCopied] = useState(false);

  if (message.role === "user") {
    return (
      <div className="msg-in flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap break-words rounded-3xl bg-surface2 px-4 py-2.5">{message.content}</div>
      </div>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }

  return (
    <div className="msg-in group">
      <Markdown>{message.content}</Markdown>
      {!streaming && (
        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
          <button
            onClick={copy}
            aria-label="Copy response"
            className="-ml-1.5 flex items-center gap-1.5 rounded-md p-1.5 opacity-0 transition-opacity hover:text-fg focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
          >
            <Icon name={copied ? "check" : "copy"} size={15} />
          </button>
          {message.status === "stopped" && <span>Stopped</span>}
          {message.status === "error" && <span className="text-danger">Response interrupted</span>}
        </div>
      )}
    </div>
  );
}

export const MessageItem = memo(MessageItemImpl);
