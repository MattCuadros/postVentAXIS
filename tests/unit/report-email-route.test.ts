import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ cookieValues: new Map<string, string>(), sendMail: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: (key: string) => ({ value: mocks.cookieValues.get(key) }) }) }));
vi.mock("nodemailer", () => ({ default: { createTransport: () => ({ sendMail: mocks.sendMail }) } }));
import { POST } from "@/app/api/reports/email/route";

const originalEnv = { ...process.env };
const pdf = Buffer.from("%PDF-1.7 simulated pdf").toString("base64");
function request(to: string[]) { return new Request("http://localhost/api/reports/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ to, subject: "Resumen", text: "Informe", attachment: { filename: "informe.pdf", content: pdf } }) }); }

describe("POST /api/reports/email", () => {
  afterEach(() => { process.env = { ...originalEnv }; mocks.cookieValues.clear(); mocks.sendMail.mockReset(); });
  it("requiere sesión encargada/admin", async () => {
    const response = await POST(request(["destino@axisdc.cl"]));
    expect(response.status).toBe(401);
  });
  it("rechaza dominio ajeno y más de cinco destinatarios", async () => {
    mocks.cookieValues.set("pv_user_id", "u-enc-centro"); mocks.cookieValues.set("pv_role", "ENCARGADO");
    process.env.REPORT_ALLOWED_DOMAINS = "axisdc.cl";
    expect((await POST(request(["afuera@example.com"]))).status).toBe(400);
    expect((await POST(request(Array.from({ length: 6 }, (_, i) => `u${i}@axisdc.cl`)))).status).toBe(400);
  });
  it("responde NO_DISPONIBLE sin SMTP configurado", async () => {
    mocks.cookieValues.set("pv_user_id", "u-enc-centro"); mocks.cookieValues.set("pv_role", "ENCARGADO");
    for (const key of ["REPORT_SMTP_HOST", "REPORT_SMTP_USER", "REPORT_SMTP_PASS", "REPORT_FROM"]) delete process.env[key];
    const response = await POST(request(["destino@axisdc.cl"]));
    expect(await response.json()).toMatchObject({ reason: "NO_DISPONIBLE" });
  });
  it("envía el adjunto PDF usando el transporte simulado", async () => {
    mocks.cookieValues.set("pv_user_id", "u-enc-centro"); mocks.cookieValues.set("pv_role", "ENCARGADO");
    Object.assign(process.env, { REPORT_SMTP_HOST: "smtp.test", REPORT_SMTP_USER: "user", REPORT_SMTP_PASS: "pass", REPORT_FROM: "PostventAXIS <mcuadros@axisdc.cl>", REPORT_ALLOWED_DOMAINS: "axisdc.cl" });
    mocks.sendMail.mockResolvedValue({});
    const response = await POST(request(["destino@axisdc.cl"]));
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.sendMail).toHaveBeenCalledWith(expect.objectContaining({ replyTo: "rperez@demo.cl", attachments: [expect.objectContaining({ contentType: "application/pdf" })] }));
  });
});
