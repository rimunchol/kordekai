import { notFound } from "next/navigation";
import { Chat } from "@/components/Chat";
import { getSession } from "@/lib/session";
import { getConversationWithMessages } from "@/lib/conversations";
import { UUID_RE } from "@/lib/http";

export default async function ConversationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const user = await getSession();
  if (!user) notFound(); // layout already redirects; this narrows the type
  const data = await getConversationWithMessages(user.id, id);
  if (!data) notFound();
  return <Chat key={id} conversationId={id} initialMessages={data.messages} />;
}
