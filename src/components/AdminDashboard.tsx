"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { Modal } from "./Modal";

type Tab = "overview" | "users" | "ai";

export function AdminDashboard() {
  const [tab, setTab] = useState<Tab>("overview");
  const tabs: { id: Tab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "users", label: "Users" },
    { id: "ai", label: "AI configuration" },
  ];
  return (
    <div>
      <div role="tablist" className="mb-6 flex gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm transition-colors ${
              tab === t.id ? "border-fg text-fg" : "border-transparent text-muted hover:text-fg"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === "overview" && <Overview />}
      {tab === "users" && <Users />}
      {tab === "ai" && <AiConfig />}
    </div>
  );
}

/* ---------------------------------- Overview --------------------------------- */

type Stats = {
  totals: Record<string, number>;
  daily: { day: string; total: number; errors: number }[];
  errors: { at: string; model: string | null; error: string | null; username: string | null }[];
};

function Overview() {
  const [data, setData] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api<Stats>("/api/admin/stats").then(setData, (e) => setError(e.message));
  }, []);
  if (error) return <p className="text-danger">{error}</p>;
  if (!data) return <p className="text-muted">Loading…</p>;
  const t = data.totals;
  const max = Math.max(1, ...data.daily.map((d) => d.total));
  const cells: [string, string | number, string?][] = [
    ["Users", t.users, `${t.users_7d} new in 7 days`],
    ["Banned", t.banned],
    ["Conversations", t.conversations, `${t.messages} messages`],
    ["AI requests (24h)", t.requests_24h],
    ["Errors (24h)", t.errors_24h],
    ["Avg latency (24h)", `${t.avg_latency_ms} ms`, "full response time"],
  ];
  return (
    <div className="fade-in space-y-8">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {cells.map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-border p-4">
            <div className="text-sm text-muted">{label}</div>
            <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
            {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
          </div>
        ))}
      </div>

      <section>
        <h2 className="mb-3 text-sm font-medium">AI requests, last 7 days</h2>
        <div className="flex h-36 items-end gap-2 rounded-2xl border border-border p-4">
          {data.daily.map((d) => (
            <div key={d.day} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${d.day}: ${d.total} requests, ${d.errors} errors`}>
              <div className="flex w-full flex-1 items-end">
                <div className="w-full rounded-t bg-accent/70" style={{ height: `${(d.total / max) * 100}%`, minHeight: d.total ? 2 : 0 }} />
              </div>
              <span className="text-[10px] text-muted">{d.day.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-sm font-medium">Recent failed requests</h2>
        {data.errors.length === 0 ? (
          <p className="text-sm text-muted">No errors recorded.</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-sm">
              <thead className="text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">When</th>
                  <th className="px-4 py-2.5 font-medium">User</th>
                  <th className="px-4 py-2.5 font-medium">Model</th>
                  <th className="px-4 py-2.5 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {data.errors.map((e, i) => (
                  <tr key={i} className="border-t border-border align-top">
                    <td className="whitespace-nowrap px-4 py-2.5 text-muted">{new Date(e.at).toLocaleString()}</td>
                    <td className="px-4 py-2.5">{e.username ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted">{e.model ?? "—"}</td>
                    <td className="px-4 py-2.5 break-words">{e.error ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/* ----------------------------------- Users ----------------------------------- */

type AdminUser = {
  id: string;
  username: string;
  role: string;
  createdAt: string;
  lastLoginAt: string | null;
  status: "active" | "banned";
  banReason: string | null;
  banExpiresAt: string | null;
  conversations: number;
};

type BanRecord = {
  id: string;
  reason: string;
  bannedBy: string;
  createdAt: string;
  expiresAt: string | null;
  liftedAt: string | null;
  liftedBy: string | null;
};

const DURATIONS: { label: string; hours: number | null }[] = [
  { label: "1 hour", hours: 1 },
  { label: "24 hours", hours: 24 },
  { label: "7 days", hours: 168 },
  { label: "30 days", hours: 720 },
  { label: "Permanent", hours: null },
];

const field = "w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-accent";
const btn = "rounded-lg border border-border px-2.5 py-1 text-xs transition-colors hover:bg-hover";

function Users() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [banTarget, setBanTarget] = useState<AdminUser | null>(null);
  const [historyTarget, setHistoryTarget] = useState<AdminUser | null>(null);
  const [removeTarget, setRemoveTarget] = useState<AdminUser | null>(null);

  const load = useCallback(async (query: string) => {
    try {
      const res = await api<{ users: AdminUser[] }>(`/api/admin/users?q=${encodeURIComponent(query)}`);
      setUsers(res.users);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => load(q), 250);
    return () => clearTimeout(id);
  }, [q, load]);

  async function unban(u: AdminUser) {
    try {
      await api(`/api/admin/users/${u.id}/ban`, { method: "DELETE" });
      load(q);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="fade-in">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by username" aria-label="Search users" className={`${field} mb-4 max-w-sm`} />
      {error && <p className="mb-3 text-sm text-danger">{error}</p>}
      {!users ? (
        <p className="text-muted">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-muted">No users found.</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-4 py-2.5 font-medium">Username</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Created</th>
                <th className="px-4 py-2.5 font-medium">Last sign-in</th>
                <th className="px-4 py-2.5 text-right font-medium">Chats</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-2.5">
                    {u.username}
                    {u.role === "admin" && <span className="ml-2 rounded-md bg-surface2 px-1.5 py-0.5 text-xs text-muted">admin</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {u.status === "banned" ? (
                      <span className="text-danger" title={u.banReason ?? ""}>
                        Banned{u.banExpiresAt ? ` until ${new Date(u.banExpiresAt).toLocaleDateString()}` : ""}
                      </span>
                    ) : (
                      <span className="text-ok">Active</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString() : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{u.conversations}</td>
                  <td className="px-4 py-2.5">
                    {u.role !== "admin" && (
                      <div className="flex justify-end gap-1.5">
                        <button className={btn} onClick={() => setHistoryTarget(u)}>History</button>
                        {u.status === "banned" ? (
                          <button className={btn} onClick={() => unban(u)}>Unban</button>
                        ) : (
                          <button className={btn} onClick={() => setBanTarget(u)}>Ban</button>
                        )}
                        <button className={`${btn} text-danger`} onClick={() => setRemoveTarget(u)}>Remove</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {banTarget && <BanModal user={banTarget} onClose={() => setBanTarget(null)} onDone={() => { setBanTarget(null); load(q); }} />}
      {historyTarget && <HistoryModal user={historyTarget} onClose={() => setHistoryTarget(null)} />}
      {removeTarget && <RemoveModal user={removeTarget} onClose={() => setRemoveTarget(null)} onDone={() => { setRemoveTarget(null); load(q); }} />}
    </div>
  );
}

function BanModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState<number | null>(24);
  const [restrict, setRestrict] = useState(false);
  const [days, setDays] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/api/admin/users/${user.id}/ban`, {
        method: "POST",
        json: { reason, durationHours: duration, restrictSignups: restrict, restrictDays: days },
      });
      onDone();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <Modal title={`Ban ${user.username}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Reason (shown to the user)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} rows={3} className={`${field} resize-none`} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Duration</span>
          <select value={duration ?? "perm"} onChange={(e) => setDuration(e.target.value === "perm" ? null : Number(e.target.value))} className={field}>
            {DURATIONS.map((d) => (
              <option key={d.label} value={d.hours ?? "perm"}>{d.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2.5 text-sm">
          <input type="checkbox" checked={restrict} onChange={(e) => setRestrict(e.target.checked)} className="mt-1" />
          <span>
            Also block new sign-ups from this account’s network for
            <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="mx-1.5 rounded-md border border-border bg-surface px-1.5 py-0.5" disabled={!restrict}>
              {[1, 3, 7, 14, 30].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
            days
            <span className="mt-0.5 block text-xs text-muted">Temporary by design, so people sharing that network aren’t locked out for good.</span>
          </span>
        </label>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-hover">Cancel</button>
          <button type="submit" disabled={busy} className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
            {busy ? "Banning…" : "Ban user"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function HistoryModal({ user, onClose }: { user: AdminUser; onClose: () => void }) {
  const [bans, setBans] = useState<BanRecord[] | null>(null);
  useEffect(() => {
    api<{ bans: BanRecord[] }>(`/api/admin/users/${user.id}/bans`).then((r) => setBans(r.bans), () => setBans([]));
  }, [user.id]);
  return (
    <Modal title={`Ban history — ${user.username}`} onClose={onClose} width="max-w-lg">
      {!bans ? (
        <p className="text-muted">Loading…</p>
      ) : bans.length === 0 ? (
        <p className="text-sm text-muted">This account has never been banned.</p>
      ) : (
        <ul className="space-y-3">
          {bans.map((b) => (
            <li key={b.id} className="rounded-xl border border-border p-3.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="font-medium">{b.reason}</span>
                <span className="whitespace-nowrap text-muted">{new Date(b.createdAt).toLocaleDateString()}</span>
              </div>
              <div className="mt-1 text-muted">
                By {b.bannedBy} · {b.expiresAt ? `until ${new Date(b.expiresAt).toLocaleString()}` : "permanent"}
                {b.liftedAt && ` · lifted ${new Date(b.liftedAt).toLocaleDateString()} by ${b.liftedBy}`}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}

function RemoveModal({ user, onClose, onDone }: { user: AdminUser; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function remove() {
    setBusy(true);
    try {
      await api(`/api/admin/users/${user.id}`, { method: "DELETE" });
      onDone();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <Modal title="Remove account?" onClose={onClose}>
      <p className="text-sm text-muted">
        <span className="text-fg">{user.username}</span> and all of their conversations will be permanently deleted. This can’t be undone. Their ban history is kept.
      </p>
      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <div className="mt-5 flex justify-end gap-2">
        <button onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm hover:bg-hover">Cancel</button>
        <button onClick={remove} disabled={busy} className="rounded-xl bg-danger px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Removing…" : "Remove permanently"}
        </button>
      </div>
    </Modal>
  );
}

/* --------------------------------- AI config --------------------------------- */

function AiConfig() {
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("");
  const [defaultPrompt, setDefaultPrompt] = useState("");
  const [models, setModels] = useState<string[]>([]);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ systemPrompt: string; model: string; defaultSystemPrompt: string }>("/api/admin/settings").then(
      (r) => {
        setPrompt(r.systemPrompt);
        setModel(r.model);
        setDefaultPrompt(r.defaultSystemPrompt);
        setState("idle");
      },
      (e) => {
        setError(e.message);
        setState("error");
      },
    );
    api<{ models: string[] }>("/api/admin/models").then((r) => setModels(r.models), () => {});
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setState("saving");
    setError(null);
    try {
      await api("/api/admin/settings", { method: "PUT", json: { systemPrompt: prompt, model } });
      setState("saved");
    } catch (err) {
      setError((err as Error).message);
      setState("error");
    }
  }

  if (state === "loading") return <p className="text-muted">Loading…</p>;

  return (
    <form onSubmit={save} className="fade-in max-w-3xl space-y-6">
      <label className="block">
        <span className="mb-1 block text-sm font-medium">Global system prompt</span>
        <span className="mb-2 block text-sm text-muted">
          Defines personality, tone, length and formatting for every conversation. Saved changes apply to the next message anyone sends.
        </span>
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setState("idle"); }}
          rows={14}
          maxLength={8000}
          required
          className={`${field} resize-y font-mono text-[13px] leading-relaxed`}
        />
        <div className="mt-1.5 flex justify-between text-xs text-muted">
          <button type="button" className="underline underline-offset-4 hover:text-fg" onClick={() => { setPrompt(defaultPrompt); setState("idle"); }}>
            Reset to default
          </button>
          <span>{prompt.length} / 8000</span>
        </div>
      </label>

      <label className="block max-w-sm">
        <span className="mb-1 block text-sm font-medium">Model</span>
        <span className="mb-2 block text-sm text-muted">Pick from the models your Cerebras key can access, or type an id.</span>
        <input list="models" value={model} onChange={(e) => { setModel(e.target.value); setState("idle"); }} required className={field} />
        <datalist id="models">{models.map((m) => <option key={m} value={m} />)}</datalist>
      </label>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={state === "saving"} className="rounded-xl bg-fg px-5 py-2.5 text-sm font-medium text-bg hover:opacity-90 disabled:opacity-50">
          {state === "saving" ? "Saving…" : "Save changes"}
        </button>
        {state === "saved" && <span className="text-sm text-ok">Saved — applies to new messages.</span>}
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>
    </form>
  );
}
