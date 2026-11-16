import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (user && !user.banned) redirect("/");
  return <main className="flex min-h-dvh items-center justify-center px-4 py-10">{children}</main>;
}
