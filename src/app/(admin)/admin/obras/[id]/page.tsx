import { ProjectDetail } from "@/components/admin/project-detail";

export default async function ObraPage({ params }: PageProps<"/admin/obras/[id]">) {
  const { id } = await params;
  return <ProjectDetail projectId={id} />;
}
