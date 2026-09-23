import { EncargadoTicketDetail } from "@/components/tickets/encargado-ticket-detail";

export default async function RequerimientoEncargadoPage({ params }: PageProps<"/encargado/tickets/[id]">) {
  const { id } = await params;
  return <EncargadoTicketDetail ticketId={id} />;
}
