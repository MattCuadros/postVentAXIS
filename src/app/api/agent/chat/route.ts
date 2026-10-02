import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AgentCapacityError, handleAgentMessage } from "@/lib/agent-conversation";

const chatRequestSchema = z.object({
  thread_id: z.string().uuid(),
  message: z.string().trim().min(1).max(1000),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "El agente solo está habilitado en desarrollo local." }, { status: 404 });
  }

  if (request.headers.get("origin") !== new URL(request.url).origin) {
    return NextResponse.json({ error: "Origen de solicitud no permitido." }, { status: 403 });
  }

  const cookieStore = await cookies();
  if (cookieStore.get("pv_role")?.value !== "PROPIETARIO" || !cookieStore.get("pv_user_id")?.value) {
    return NextResponse.json({ error: "Debes iniciar sesión como propietario." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "El cuerpo de la solicitud no contiene JSON válido." }, { status: 400 });
  }
  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "El mensaje no es válido." }, { status: 400 });
  }

  try {
    const reply = handleAgentMessage(parsed.data.thread_id, parsed.data.message);
    return NextResponse.json(reply, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AgentCapacityError) {
      return NextResponse.json({ error: error.message }, { status: 429 });
    }
    throw error;
  }
}
