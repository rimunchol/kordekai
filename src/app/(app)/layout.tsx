import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getSession } from "@/lib/session";
import { listConversations } from "@/lib/conversations";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSession();
  if (!user) redirect("/login");
  if (user.banned) redirect("/login?reason=banned");
  const conversations = await listConversations(user.id);
  return (
    <AppShell
      user={{ username: user.username, isDeveloper: user.isDeveloper, theme: user.theme, customInstructions: user.customInstructions }}
      conversations={conversations}
    >
      {children}
    </AppShell>
  );
}
