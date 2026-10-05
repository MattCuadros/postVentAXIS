export type SendReportEmailResult = { ok: true } | { ok: false; reason: "NO_DISPONIBLE" | "RECHAZADO" | "ERROR_RED" };
export interface ReportAttachment { filename: string; content: string }

export async function sendReportEmail(input: { to: string[]; subject: string; text: string; attachment: ReportAttachment }): Promise<SendReportEmailResult> {
  try {
    const response = await fetch("/api/reports/email", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const data = await response.json() as { ok?: boolean; reason?: string };
    if (response.ok && data.ok) return { ok: true };
    if (data.reason === "NO_DISPONIBLE" || data.reason === "RECHAZADO") return { ok: false, reason: data.reason };
    return { ok: false, reason: "ERROR_RED" };
  } catch {
    return { ok: false, reason: "ERROR_RED" };
  }
}
