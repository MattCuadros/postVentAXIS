import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { tickets } from "@/mocks/data";
import type { Ticket } from "@/types/domain";

const DESCRIPTION_LIMIT = 120;

function truncateDescription(description: Ticket["description"]): string {
  const characters = Array.from(description);

  if (characters.length <= DESCRIPTION_LIMIT) {
    return description;
  }

  return `${characters.slice(0, DESCRIPTION_LIMIT).join("").trimEnd()}…`;
}

export default function TicketsPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-ink">Tickets</h1>
        <p className="mt-1 text-sm text-ink-secondary">
          Revisa el estado de las solicitudes de postventa.
        </p>
      </div>

      <section aria-label="Listado de tickets" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tickets.length === 0 ? (
          <p className="text-sm text-ink-secondary">No hay tickets.</p>
        ) : (
          tickets.map((ticket: Ticket) => (
            <Card key={ticket.id} className="flex flex-col gap-4">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold text-ink">{ticket.folio}</p>
                <StatusBadge status={ticket.status} className="shrink-0" />
              </div>

              <div>
                <p className="text-sm font-medium text-ink">{ticket.room}</p>
                <p className="mt-2 text-sm leading-6 text-ink-secondary">
                  {truncateDescription(ticket.description)}
                </p>
              </div>
            </Card>
          ))
        )}
      </section>
    </main>
  );
}
