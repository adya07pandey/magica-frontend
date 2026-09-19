import { MagicaChat } from "../../components/magica-chat";

export default async function TaskChatPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;

  return <MagicaChat taskId={taskId} />;
}
