import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { AdminDashboard } from "@/components/AdminDashboard";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Developer dashboard" };
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSession();
  if (!user) redirect("/login");
  // Server-side authorisation: anyone else gets a plain 404, revealing nothing about the dashboard.
  if (user.banned || !user.isDeveloper) notFound();

  return (
    <div className="mx-auto min-h-dvh w-full max-w-5xl px-4 pb-16">
      <header className="flex items-center justify-between py-5">
        <div className="flex items-center gap-2.5">
          <Logo size={24} />
          <span className="font-semibold tracking-tight">KordekAI</span>
          <span className="text-muted">/ Developer</span>
        </div>
        <Link href="/" className="rounded-xl border border-border px-3.5 py-2 text-sm transition-colors hover:bg-hover">
          Back to chat
        </Link>
      </header>
      <AdminDashboard />
    </div>
  );
}
