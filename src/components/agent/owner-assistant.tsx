"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { buttonClassName } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { useSession } from "@/data/session-context";
import { cn } from "@/lib/cn";
import { saveAgentDraft } from "@/lib/agent-ticket-draft";

type Classification = "CONVERSATION" | "RESOLVED" | "ESCALATE";
const agentResponseSchema = z.object({
  reply: z.string(),
  classification: z.enum(["CONVERSATION", "RESOLVED", "ESCALATE"]),
  draft: z.object({
    categoryId: z.string(),
    room: z.string(),
    description: z.string(),
  }).nullable().optional(),
});
type AgentDraft = NonNullable<z.infer<typeof agentResponseSchema>["draft"]>;
interface Message {
  role: "assistant" | "user";
  content: string;
}

const INTRO: Message = {
  role: "assistant",
  content: "Cuéntame qué problema tienes y en qué recinto ocurre. Revisaremos las guías disponibles y veremos si hay una solución segura antes de crear un requerimiento.",
};

export function OwnerAssistant() {
  const router = useRouter();
  const { user } = useSession();
  const [threadId, setThreadId] = useState(() => crypto.randomUUID());
  const [messages, setMessages] = useState<Message[]>([INTRO]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [classification, setClassification] = useState<Classification>("CONVERSATION");
  const [draft, setDraft] = useState<AgentDraft | null>(null);

  async function sendMessage(message: string) {
    const cleanMessage = message.trim();
    if (!cleanMessage || sending || !user) return;
    setMessages((current) => [...current, { role: "user", content: cleanMessage }]);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thread_id: threadId, message: cleanMessage }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(typeof body?.error === "string" ? body.error : "No pudimos procesar tu mensaje.");
      }
      const payload = agentResponseSchema.safeParse(body);
      if (!payload.success) throw new Error("El agente respondió con un formato no válido.");
      setMessages((current) => [...current, { role: "assistant", content: payload.data.reply }]);
      setClassification(payload.data.classification);
      if (payload.data.classification === "ESCALATE" && payload.data.draft) setDraft(payload.data.draft);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "No pudimos conectar con el agente.");
    } finally {
      setSending(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage(input);
  }

  function startAnotherConversation() {
    setThreadId(crypto.randomUUID());
    setMessages([INTRO]);
    setInput("");
    setError(null);
    setDraft(null);
    setClassification("CONVERSATION");
  }

  function continueToTicket() {
    if (!draft) return;
    saveAgentDraft(draft);
    router.push("/propietario/nuevo?origen=agente");
  }

  const terminal = classification !== "CONVERSATION";

  return (
    <>
      <PageHeader
        title="Autogestión guiada"
        subtitle="Revisemos si puedes resolverlo de forma segura antes de crear un requerimiento."
        back={{ href: "/propietario", label: "Mis requerimientos" }}
        className="-mx-4 -mt-6 border-b border-line-soft bg-surface px-4 pb-4 pt-4 sm:-mx-6 sm:px-6"
      />

      <p className="mt-4 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs text-ink-secondary">
        Prototipo local basado en fichas de referencia; no usa un modelo de IA ni envía mensajes fuera de esta app. No incluyas nombres, direcciones, teléfonos ni otros datos personales. Ante una emergencia, llama a los servicios de emergencia.
      </p>

      <section aria-label="Conversación de autogestión" aria-live="polite" className="mt-4 flex flex-1 flex-col gap-3 pb-4">
        {messages.map((message, index) => (
          <p
            key={`${message.role}-${index}`}
            className={cn(
              "max-w-[90%] whitespace-pre-wrap rounded-lg px-4 py-3 text-sm",
              message.role === "assistant"
                ? "self-start border border-line-soft bg-surface text-ink"
                : "self-end bg-accent text-white",
            )}
          >
            {message.content}
          </p>
        ))}
        {sending && <p role="status" className="text-sm text-ink-secondary">Revisando tu mensaje…</p>}
        {error && (
          <div role="alert" className="rounded-md border border-danger/30 bg-danger/5 p-3 text-sm text-ink">
            <p>{error}</p>
            <Link href="/propietario/nuevo" className="mt-2 inline-block font-bold text-accent underline">
              Ir directamente al formulario de requerimiento
            </Link>
          </div>
        )}
        {classification === "RESOLVED" && (
          <div className="rounded-md bg-success/10 p-3 text-sm text-ink" role="status">
            <p>No se creó ningún requerimiento. Si tienes otro problema, puedes iniciar una nueva consulta.</p>
            <button type="button" onClick={startAnotherConversation} className="mt-2 font-bold text-accent underline">
              Consultar otro problema
            </button>
          </div>
        )}
        {classification === "ESCALATE" && draft && (
          <button type="button" className={buttonClassName({ fullWidth: true })} onClick={continueToTicket}>
            Revisar y crear requerimiento
          </button>
        )}
      </section>

      <form onSubmit={handleSubmit} className="sticky bottom-0 -mx-4 border-t border-line-soft bg-surface p-3 sm:-mx-6 sm:px-6">
        <label htmlFor="agent-message" className="sr-only">Escribe tu respuesta</label>
        <div className="flex gap-2">
          <input
            id="agent-message"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            disabled={sending || terminal}
            maxLength={1000}
            autoComplete="off"
            className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm text-ink"
            placeholder="Escribe tu respuesta…"
          />
          <button type="submit" disabled={sending || terminal || !input.trim()} className={buttonClassName()}>
            Enviar
          </button>
        </div>
        {terminal && (
          <Link href="/propietario" className="mt-3 inline-block text-sm font-bold text-accent underline">
            Volver a mis requerimientos
          </Link>
        )}
      </form>
    </>
  );
}
