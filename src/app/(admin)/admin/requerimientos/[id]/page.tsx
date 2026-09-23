import { StaffTicketDetail } from "@/components/tickets/staff-ticket-detail";

export default async function RequerimientoAdminPage({ params }: PageProps<"/admin/requerimientos/[id]">) {
  const { id } = await params;
  return <StaffTicketDetail ticketId={id} backHref="/admin/requerimientos" />;
}
