import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { cookies } from "next/headers";
import { users } from "@/mocks/data";
import { reportEmailPayloadSchema } from "@/lib/report-email-schema";

export const runtime = "nodejs";
const MAX_PDF_BYTES = 4 * 1024 * 1024;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const sendsByUser = new Map<string, number[]>();

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const userId = cookieStore.get("pv_user_id")?.value;
  const role = cookieStore.get("pv_role")?.value;
  if (!userId || (role !== "ENCARGADO" && role !== "ADMIN")) return NextResponse.json({ ok: false, reason: "RECHAZADO" }, { status: 401 });
  const sender = users.find((user) => user.id === userId && user.active && user.role === role);
  if (!sender) return NextResponse.json({ ok: false, reason: "RECHAZADO" }, { status: 401 });

  let raw: unknown;
  try { raw = await request.json(); } catch { return NextResponse.json({ ok: false, reason: "RECHAZADO" }, { status: 400 }); }
  const parsed = reportEmailPayloadSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, reason: "RECHAZADO" }, { status: 400 });
  const payload = parsed.data;
  const domains = (process.env.REPORT_ALLOWED_DOMAINS ?? "axisdc.cl").split(",").map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (payload.to.some((email) => !domains.includes(email.slice(email.lastIndexOf("@") + 1).toLowerCase()))) {
    return NextResponse.json({ ok: false, reason: "RECHAZADO" }, { status: 400 });
  }
  const pdf = Buffer.from(payload.attachment.content, "base64");
  if (pdf.byteLength > MAX_PDF_BYTES || pdf.subarray(0, 4).toString() !== "%PDF") return NextResponse.json({ ok: false, reason: "RECHAZADO" }, { status: 400 });
  const now = Date.now();
  const recent = (sendsByUser.get(userId) ?? []).filter((sentAt) => now - sentAt < RATE_WINDOW_MS);
  if (recent.length >= 10) return NextResponse.json({ ok: false, reason: "RECHAZADO" }, { status: 429 });

  const { REPORT_SMTP_HOST, REPORT_SMTP_USER, REPORT_SMTP_PASS, REPORT_FROM } = process.env;
  if (!REPORT_SMTP_HOST || !REPORT_SMTP_USER || !REPORT_SMTP_PASS || !REPORT_FROM) {
    return NextResponse.json({ ok: false, reason: "NO_DISPONIBLE" }, { status: 503 });
  }
  sendsByUser.set(userId, [...recent, now]);
  try {
    const transport = nodemailer.createTransport({ host: REPORT_SMTP_HOST, port: Number(process.env.REPORT_SMTP_PORT ?? 587), secure: process.env.REPORT_SMTP_SECURE === "true", auth: { user: REPORT_SMTP_USER, pass: REPORT_SMTP_PASS } });
    await transport.sendMail({ from: REPORT_FROM, to: payload.to, replyTo: sender.email, subject: payload.subject, text: payload.text, attachments: [{ filename: payload.attachment.filename, content: pdf, contentType: "application/pdf" }] });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false, reason: "ERROR_RED" }, { status: 502 });
  }
}
