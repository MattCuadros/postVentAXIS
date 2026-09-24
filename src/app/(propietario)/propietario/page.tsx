"use client";

import Link from "next/link";
import { useCallback } from "react";
import { OwnerActionCallout } from "@/components/tickets/owner-action-callout";
import { OwnerTicketCard } from "@/components/tickets/owner-ticket-card";
import { BottomBar } from "@/components/ui/bottom-bar";
import { buttonClassName } from "@/components/ui/button";
import { PlusIcon } from "@/components/ui/icons";
import { PageHeader } from "@/components/ui/page-header";
import { ContentSkeleton } from "@/components/ui/skeleton";
import { useDataApi } from "@/data/api";
import { useSession } from "@/data/session-context";
import { useQuery } from "@/data/use-query";
import { requiresOwnerAction } from "@/lib/ticket-status";
import type { Ticket } from "@/types/domain";

export default function MisRequerimientosPage() {
  const { user } = useSession();
  const { getTicketsByOwner } = useDataApi();
  const ownerId = user?.id;
  const { data: tickets } = useQuery(
    useCallback(async (): Promise<Ticket[]> => (ownerId ? getTicketsByOwner(ownerId) : []), [getTicketsByOwner, ownerId]),
  );

  const pending = tickets?.filter((ticket) => requiresOwnerAction(ticket.status)) ?? [];
  const rest = tickets?.filter((ticket) => !requiresOwnerAction(ticket.status)) ?? [];

  return (
    <>
      <PageHeader title="Mis requerimientos" />

      {tickets === undefined ? (
        <ContentSkeleton label="Cargando requerimientos…" />
      ) : tickets.length === 0 ? (
        <div className="mt-6 rounded-lg border border-line-soft bg-surface p-6 text-center shadow-card">
          <p className="font-bold text-ink">Aún no tienes requerimientos</p>
          <p className="mt-1 text-sm text-ink-secondary">
            Si detectas una falla en tu vivienda, ingrésala aquí y te avisaremos cada avance.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-3">
          {pending.map((ticket) => <OwnerActionCallout key={ticket.id} ticket={ticket} />)}
          {rest.map((ticket) => <OwnerTicketCard key={ticket.id} ticket={ticket} />)}
        </div>
      )}

      <BottomBar>
        <Link href="/propietario/nuevo" className={buttonClassName({ size: "lg", fullWidth: true })}>
          <PlusIcon />
          Nuevo requerimiento
        </Link>
      </BottomBar>
    </>
  );
}
