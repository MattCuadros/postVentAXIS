"use client";

import { useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useDataApi } from "@/data/api";
import { availableTransitions, type Transition } from "@/lib/ticket-status";
import type { Role, Ticket } from "@/types/domain";

const commentSchema = z.string().trim().min(10, "Cuéntanos el motivo (mínimo 10 caracteres).");

interface TransitionActionsProps {
  ticket: Ticket;
  role: Role;
  userId: string;
  /** Se llama tras una transición exitosa, con el mensaje a mostrar. */
  onDone?: (transition: Transition) => void;
  /** Títulos y ayudas del diálogo de comentario, por estado destino. */
  commentCopy?: Partial<Record<Transition["to"], { title: string; hint: string }>>;
}

/**
 * Botones con las transiciones que el rol puede ejecutar sobre el ticket.
 * La primera es la acción principal; las que exigen comentario abren un diálogo.
 */
export function TransitionActions({ ticket, role, userId, onDone, commentCopy }: TransitionActionsProps) {
  const { transitionTicket } = useDataApi();
  const transitions = availableTransitions(ticket.status, role);
  const [pending, setPending] = useState<Transition | null>(null);
  const [commentFor, setCommentFor] = useState<Transition | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);

  if (transitions.length === 0) return null;

  async function run(transition: Transition, text?: string) {
    setPending(transition);
    setError(null);
    try {
      await transitionTicket(ticket.id, transition.to, userId, text);
      setCommentFor(null);
      setComment("");
      onDone?.(transition);
    } catch {
      setError("No pudimos registrar la acción. Intenta nuevamente.");
    } finally {
      setPending(null);
    }
  }

  function handleConfirmComment() {
    if (commentFor === null) return;
    const result = commentSchema.safeParse(comment);
    if (!result.success) {
      setCommentError(result.error.issues[0]?.message);
      return;
    }
    void run(commentFor, result.data);
  }

  const copy = commentFor ? commentCopy?.[commentFor.to] : undefined;

  return (
    <>
      <div className="flex w-full flex-col gap-3">
        {transitions.map((transition, index) => (
          <Button
            key={transition.to}
            size="lg"
            fullWidth
            variant={index === 0 ? "primary" : "secondary"}
            disabled={pending !== null}
            onClick={() => (transition.requiresComment ? setCommentFor(transition) : void run(transition))}
          >
            {pending === transition ? "Guardando…" : transition.action}
          </Button>
        ))}
        {error && <p className="text-sm text-danger" role="alert">{error}</p>}
      </div>

      <Dialog
        open={commentFor !== null}
        title={copy?.title ?? commentFor?.action}
        onClose={() => {
          setCommentFor(null);
          setCommentError(undefined);
        }}
      >
        {copy?.hint && <p className="mb-4 text-sm text-ink-secondary">{copy.hint}</p>}
        <Textarea
          label="Motivo"
          name="transition-comment"
          value={comment}
          error={commentError}
          maxLength={1000}
          onChange={(event) => {
            setComment(event.target.value);
            setCommentError(undefined);
          }}
        />
        <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" disabled={pending !== null} onClick={() => setCommentFor(null)}>
            Cancelar
          </Button>
          <Button disabled={pending !== null} onClick={handleConfirmComment}>
            {pending ? "Guardando…" : "Enviar"}
          </Button>
        </div>
      </Dialog>
    </>
  );
}
