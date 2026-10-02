import { z } from "zod";

export const AGENT_DRAFT_KEY = "postventaxis:agent-draft";

const draftSchema = z.object({
  categoryId: z.string().min(1),
  room: z.string().min(1),
  description: z.string().min(1).max(1000),
});

export type AgentTicketDraft = z.infer<typeof draftSchema>;

let cachedDraft: AgentTicketDraft | null | undefined;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToAgentDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAgentDraftSnapshot(): AgentTicketDraft | null {
  if (cachedDraft !== undefined) return cachedDraft;
  if (typeof window === "undefined") return null;

  const raw = window.sessionStorage.getItem(AGENT_DRAFT_KEY);
  if (!raw) {
    cachedDraft = null;
    return cachedDraft;
  }

  try {
    const result = draftSchema.safeParse(JSON.parse(raw));
    cachedDraft = result.success ? result.data : null;
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    cachedDraft = null;
  }
  return cachedDraft;
}

export function getServerAgentDraftSnapshot(): null {
  return null;
}

export function saveAgentDraft(draft: AgentTicketDraft): void {
  cachedDraft = draft;
  window.sessionStorage.setItem(AGENT_DRAFT_KEY, JSON.stringify(draft));
  notify();
}

export function clearAgentDraft(): void {
  cachedDraft = null;
  window.sessionStorage.removeItem(AGENT_DRAFT_KEY);
  notify();
}
