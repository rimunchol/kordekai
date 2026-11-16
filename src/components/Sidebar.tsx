"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "./Logo";
import { Icon } from "./icons";
import { Modal } from "./Modal";
import { useApp, type Conversation } from "./AppShell";
import { api } from "@/lib/client";

function groupByDate(list: Conversation[]) {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const today = startOfDay(new Date());
  const day = 86400000;
  const groups: { label: string; items: Conversation[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of list) {
    const t = startOfDay(new Date(c.updatedAt));
    const idx = t >= today ? 0 : t >= today - day ? 1 : t >= today - 7 * day ? 2 : 3;
    groups[idx].items.push(c);
  }
  return groups.filter((g) => g.items.length);
}

export function Sidebar({ collapsed, mobileOpen, onToggle }: { collapsed: boolean; mobileOpen: boolean; onToggle: () => void }) {
  const app = useApp();
  const router = useRouter();
  const pathname = usePathname();
  const groups = useMemo(() => groupByDate(app.conversations), [app.conversations]);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => !accountRef.current?.contains(e.target as Node) && setAccountOpen(false);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [accountOpen]);

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-[272px] shrink-0 flex-col border-r border-border bg-sidebar transition-[transform,margin] duration-200 ease-out md:static ${
        mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      } ${collapsed ? "md:-ml-[272px]" : "md:ml-0"}`}
      aria-label="Sidebar"
    >
      <div className="flex items-center justify-between px-3 pb-2 pt-3">
        <Link href="/" onClick={app.closeMobileSidebar} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5" aria-label="KordekAI home">
          <Logo size={24} />
          <span className="font-semibold tracking-tight">KordekAI</span>
        </Link>
        <button onClick={onToggle} aria-label="Close sidebar" className="rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-fg">
          <Icon name="sidebar" />
        </button>
      </div>

      <div className="px-3 pb-2">
        <button
          onClick={() => {
            app.closeMobileSidebar();
            router.push("/");
          }}
          className="flex w-full items-center gap-2.5 rounded-xl border border-border px-3 py-2 text-sm transition-colors hover:bg-hover"
        >
          <Icon name="plus" size={16} />
          New chat
        </button>
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-2" aria-label="Conversations">
        {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted">Your conversations will appear here.</p>}
        {groups.map((g) => (
          <div key={g.label} className="mb-3">
            <h3 className="px-3 pb-1 pt-2 text-xs font-medium text-muted">{g.label}</h3>
            {g.items.map((c) => (
              <ConversationItem key={c.id} conversation={c} active={pathname === `/c/${c.id}`} />
            ))}
          </div>
        ))}
      </nav>

      <div ref={accountRef} className="relative border-t border-border p-2">
        {accountOpen && (
          <div className="fade-in absolute inset-x-2 bottom-[calc(100%-4px)] rounded-xl border border-border bg-bg p-1 shadow-xl">
            <MenuButton icon="sliders" onClick={() => { setAccountOpen(false); app.openSettings(); }}>
              Settings
            </MenuButton>
            {app.user.isDeveloper && (
              <Link
                href="/admin"
                onClick={() => { setAccountOpen(false); app.closeMobileSidebar(); }}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-hover"
              >
                <Icon name="shield" size={16} />
                Developer dashboard
              </Link>
            )}
            <MenuButton icon="logout" onClick={logout}>
              Log out
            </MenuButton>
          </div>
        )}
        <button
          onClick={() => setAccountOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={accountOpen}
          className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-hover"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface2 text-sm font-medium uppercase">
            {app.user.username.slice(0, 1)}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm">{app.user.username}</span>
          <Icon name="chevron" size={14} className={`text-muted transition-transform ${accountOpen ? "" : "rotate-180"}`} />
        </button>
      </div>
    </aside>
  );
}

function MenuButton({ icon, onClick, children, danger }: { icon: Parameters<typeof Icon>[0]["name"]; onClick: () => void; children: React.ReactNode; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-hover ${danger ? "text-danger" : ""}`}
    >
      <Icon name={icon} size={16} />
      {children}
    </button>
  );
}

function ConversationItem({ conversation: c, active }: { conversation: Conversation; active: boolean }) {
  const app = useApp();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState(c.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setMenu(false);
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [menu]);

  async function saveRename() {
    const title = draft.trim();
    setRenaming(false);
    if (!title || title === c.title) return;
    const prev = c.title;
    app.renameConversation(c.id, title);
    try {
      await api(`/api/conversations/${c.id}`, { method: "PATCH", json: { title } });
    } catch {
      app.renameConversation(c.id, prev);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await api(`/api/conversations/${c.id}`, { method: "DELETE" });
      app.removeConversation(c.id);
      setConfirmDelete(false);
      if (active) router.push("/");
    } catch {
      setBusy(false);
    }
  }

  if (renaming) {
    return (
      <div className="px-1 py-0.5">
        <input
          autoFocus
          value={draft}
          maxLength={100}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={saveRename}
          onKeyDown={(e) => {
            if (e.key === "Enter") saveRename();
            if (e.key === "Escape") setRenaming(false);
          }}
          aria-label="Conversation title"
          className="w-full rounded-lg border border-accent bg-surface px-2.5 py-1.5 text-sm outline-none"
        />
      </div>
    );
  }

  return (
    <div ref={ref} className="group relative">
      <Link
        href={`/c/${c.id}`}
        onClick={app.closeMobileSidebar}
        title={c.title}
        className={`block truncate rounded-lg py-2 pl-3 pr-9 text-sm transition-colors ${active ? "bg-surface2" : "hover:bg-hover"}`}
      >
        {c.title}
      </Link>
      <button
        onClick={() => setMenu((m) => !m)}
        aria-label={`Options for ${c.title}`}
        className={`absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted transition-opacity hover:text-fg ${
          menu ? "opacity-100" : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 max-md:opacity-100"
        }`}
      >
        <Icon name="dots" size={16} />
      </button>
      {menu && (
        <div className="fade-in absolute right-1 top-full z-10 mt-1 w-40 rounded-xl border border-border bg-bg p-1 shadow-xl">
          <MenuButton icon="pencil" onClick={() => { setMenu(false); setDraft(c.title); setRenaming(true); }}>
            Rename
          </MenuButton>
          <MenuButton icon="trash" danger onClick={() => { setMenu(false); setConfirmDelete(true); }}>
            Delete
          </MenuButton>
        </div>
      )}
      {confirmDelete && (
        <Modal title="Delete conversation?" onClose={() => setConfirmDelete(false)}>
          <p className="text-sm text-muted">
            “{c.title}” and all of its messages will be permanently deleted.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button onClick={() => setConfirmDelete(false)} className="rounded-xl border border-border px-4 py-2 text-sm transition-colors hover:bg-hover">
              Cancel
            </button>
            <button onClick={remove} disabled={busy} className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50">
              {busy ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
