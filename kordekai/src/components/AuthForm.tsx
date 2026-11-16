"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "./Logo";
import { api } from "@/lib/client";

export function AuthForm({ mode, notice }: { mode: "login" | "register"; notice?: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isLogin = mode === "login";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    try {
      await api(isLogin ? "/api/auth/login" : "/api/auth/register", {
        method: "POST",
        json: {
          username: String(form.get("username") ?? ""),
          password: String(form.get("password") ?? ""),
          ...(isLogin ? {} : { website: String(form.get("website") ?? "") }),
        },
      });
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(false);
    }
  }

  return (
    <div className="fade-in w-full max-w-[360px]">
      <div className="mb-8 flex flex-col items-center gap-3">
        <Logo size={36} />
        <h1 className="text-xl font-semibold tracking-tight">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="text-sm text-muted">{isLogin ? "Sign in to continue to KordekAI." : "Pick a username and password to get started."}</p>
      </div>

      {notice && (
        <p role="status" className="mb-4 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-muted">
          {notice}
        </p>
      )}

      <form onSubmit={onSubmit} className="space-y-3" noValidate>
        {/* Honeypot: hidden from people, tempting to bots. */}
        {!isLogin && (
          <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0" />
        )}
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Username</span>
          <input
            name="username"
            required
            autoFocus
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            maxLength={isLogin ? 64 : 24}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 outline-none transition-colors placeholder:text-muted/60 focus:border-accent"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-sm text-muted">Password</span>
          <input
            name="password"
            type="password"
            required
            autoComplete={isLogin ? "current-password" : "new-password"}
            minLength={isLogin ? undefined : 10}
            maxLength={128}
            className="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 outline-none transition-colors focus:border-accent"
          />
          {!isLogin && <span className="mt-1.5 block text-xs text-muted">At least 10 characters.</span>}
        </label>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 w-full rounded-xl bg-fg py-2.5 font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-muted">
        {isLogin ? "New here? " : "Already have an account? "}
        <Link href={isLogin ? "/register" : "/login"} className="text-fg underline underline-offset-4 decoration-border hover:decoration-fg">
          {isLogin ? "Create an account" : "Sign in"}
        </Link>
      </p>
    </div>
  );
}
