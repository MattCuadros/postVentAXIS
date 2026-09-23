import { OwnerTicketDetail } from "@/components/tickets/owner-ticket-detail";

export default async function RequerimientoPage({ params, searchParams }: PageProps<"/propietario/tickets/[id]">) {
  const { id } = await params;
  const { creado } = await searchParams;

  return <OwnerTicketDetail ticketId={id} justCreated={creado === "1"} />;
}
