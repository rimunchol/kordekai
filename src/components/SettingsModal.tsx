"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { useApp } from "./AppShell";
import { api, applyTheme, type Theme } from "@/lib/client";

const THEMES: { id: Theme; label: string }[] = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "system", label: "System" },
];

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-border py-5 first:pt-1 last:border-0 last:pb-1">
      <h3 className="mb-3 text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

const inputCls = "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";

export function SettingsModal({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [prefs, setPrefs] = useState(app.user.customInstructions);
  const [prefsState, setPrefsState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [pw, setPw] = useState({ currentPassword: "", newPassword: "" });
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pwBusy, setPwBusy] = useState(false);

  async function chooseTheme(theme: Theme) {
    applyTheme(theme);
    app.setUser({ ...app.user, theme });
    try {
      await api("/api/me", { method: "PATCH", json: { theme } });
    } catch {}
  }

  async function savePrefs() {
    setPrefsState("saving");
    try {
      await api("/api/me", { method: "PATCH", json: { customInstructions: prefs } });
      app.setUser({ ...app.user, customInstructions: prefs });
      setPrefsState("saved");
    } catch {
      setPrefsState("error");
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwBusy(true);
    setPwMsg(null);
    try {
      await api("/api/auth/password", { method: "POST", json: pw });
      setPw({ currentPassword: "", newPassword: "" });
      setPwMsg({ ok: true, text: "Password updated. Other devices were signed out." });
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : "Could not update password." });
    } finally {
      setPwBusy(false);
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  }

  return (
    <Modal title="Settings" onClose={onClose} width="max-w-lg">
      <Section title="Appearance">
        <div role="radiogroup" aria-label="Theme" className="inline-flex rounded-xl border border-border p-1">
          {THEMES.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={app.user.theme === t.id}
              onClick={() => chooseTheme(t.id)}
              className={`rounded-lg px-4 py-1.5 text-sm transition-colors ${app.user.theme === t.id ? "bg-surface2" : "text-muted hover:text-fg"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Chat preferences">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">How should KordekAI respond to you? (optional)</span>
          <textarea
            value={prefs}
            onChange={(e) => {
              setPrefs(e.target.value);
              setPrefsState("idle");
            }}
            rows={4}
            maxLength={1500}
            placeholder="e.g. Keep answers short. I'm a software engineer — skip the basics."
            className={`${inputCls} resize-y`}
          />
        </label>
        <div className="mt-2 flex items-center gap-3">
          <button
            onClick={savePrefs}
            disabled={prefsState === "saving" || prefs === app.user.customInstructions}
            className="rounded-xl bg-fg px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Save
          </button>
          {prefsState === "saved" && <span className="text-sm text-ok">Saved</span>}
          {prefsState === "error" && <span className="text-sm text-danger">Couldn’t save</span>}
        </div>
      </Section>

      <Section title="Account">
        <p className="mb-4 text-sm text-muted">
          Signed in as <span className="text-fg">{app.user.username}</span>
        </p>
        <form onSubmit={changePassword} className="space-y-2.5">
          <input
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={pw.currentPassword}
            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            required
            className={inputCls}
          />
          <input
            type="password"
            autoComplete="new-password"
            placeholder="New password (min. 10 characters)"
            value={pw.newPassword}
            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            required
            minLength={10}
            className={inputCls}
          />
          {pwMsg && <p className={`text-sm ${pwMsg.ok ? "text-ok" : "text-danger"}`}>{pwMsg.text}</p>}
          <button
            type="submit"
            disabled={pwBusy}
            className="rounded-xl border border-border px-4 py-2 text-sm transition-colors hover:bg-hover disabled:opacity-50"
          >
            {pwBusy ? "Updating…" : "Change password"}
          </button>
        </form>
        <button onClick={logout} className="mt-5 rounded-xl border border-border px-4 py-2 text-sm text-danger transition-colors hover:bg-hover">
          Log out
        </button>
      </Section>
    </Modal>
  );
}
