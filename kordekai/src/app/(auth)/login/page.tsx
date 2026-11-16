import type { Metadata } from "next";
import { AuthForm } from "@/components/AuthForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  return (
    <AuthForm
      mode="login"
      notice={reason === "banned" ? "This account is currently suspended. Sign in to see the details." : undefined}
    />
  );
}
