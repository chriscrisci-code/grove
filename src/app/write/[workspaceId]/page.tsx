import { WriteWorkspaceLoader } from "@/features/write/write-workspace-loader";

export default async function WriteWorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <WriteWorkspaceLoader workspaceId={workspaceId} />;
}
