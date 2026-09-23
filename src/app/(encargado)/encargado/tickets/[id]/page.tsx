import { StaffTicketDetail } from "@/components/tickets/staff-ticket-detail";

export default async function RequerimientoEncargadoPage({ params }: PageProps<"/encargado/tickets/[id]">) {
  const { id } = await params;
  return <StaffTicketDetail ticketId={id} backHref="/encargado" />;
}
