"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { Sidebar } from "./Sidebar";
import { SettingsModal } from "./SettingsModal";
import { Icon } from "./icons";
import { applyTheme, type Theme } from "@/lib/client";

export type Conversation = { id: string; title: string; updatedAt: string };
export type AppUser = { username: string; isDeveloper: boolean; theme: Theme; customInstructions: string };

type Ctx = {
  user: AppUser;
  setUser: (u: AppUser) => void;
  conversations: Conversation[];
  addConversation: (c: Conversation) => void;
  touchConversation: (id: string) => void;
  renameConversation: (id: string, title: string) => void;
  removeConversation: (id: string) => void;
  openSettings: () => void;
  closeMobileSidebar: () => void;
};

const AppContext = createContext<Ctx | null>(null);
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppShell");
  return ctx;
}

export function AppShell({
  user: initialUser,
  conversations: initial,
  children,
}: {
  user: AppUser;
  conversations: Conversation[];
  children: React.ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const [conversations, setConversations] = useState(initial);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Sync the saved theme to this device and follow OS changes when set to "system".
  useEffect(() => {
    applyTheme(user.theme);
    if (user.theme !== "system") return;
    const mq = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => applyTheme("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [user.theme]);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("kordek-sidebar") === "collapsed");
    } catch {}
  }, []);

  const toggleSidebar = useCallback(() => {
    if (matchMedia("(min-width: 768px)").matches) {
      setCollapsed((c) => {
        try {
          localStorage.setItem("kordek-sidebar", c ? "open" : "collapsed");
        } catch {}
        return !c;
      });
    } else {
      setMobileOpen((o) => !o);
    }
  }, []);

  const value = useMemo<Ctx>(
    () => ({
      user,
      setUser,
      conversations,
      addConversation: (c) => setConversations((list) => [c, ...list.filter((x) => x.id !== c.id)]),
      touchConversation: (id) =>
        setConversations((list) => {
          const hit = list.find((c) => c.id === id);
          return hit ? [{ ...hit, updatedAt: new Date().toISOString() }, ...list.filter((c) => c.id !== id)] : list;
        }),
      renameConversation: (id, title) => setConversations((list) => list.map((c) => (c.id === id ? { ...c, title } : c))),
      removeConversation: (id) => setConversations((list) => list.filter((c) => c.id !== id)),
      openSettings: () => {
        setMobileOpen(false);
        setSettingsOpen(true);
      },
      closeMobileSidebar: () => setMobileOpen(false),
    }),
    [user, conversations],
  );

  return (
    <AppContext.Provider value={value}>
      <div className="flex h-dvh overflow-hidden">
        {mobileOpen && <div className="fade-in fixed inset-0 z-30 bg-black/50 md:hidden" onClick={() => setMobileOpen(false)} />}
        <Sidebar collapsed={collapsed} mobileOpen={mobileOpen} onToggle={toggleSidebar} />
        <main className="relative flex min-w-0 flex-1 flex-col">
          <button
            onClick={toggleSidebar}
            aria-label="Toggle sidebar"
            className={`absolute left-3 top-3 z-20 rounded-lg p-2 text-muted transition-colors hover:bg-hover hover:text-fg ${collapsed ? "" : "md:hidden"}`}
          >
            <Icon name="sidebar" />
          </button>
          {children}
        </main>
      </div>
      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}
    </AppContext.Provider>
  );
}
