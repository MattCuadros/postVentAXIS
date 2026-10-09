import { describe, expect, it } from "vitest";
import { parseRecipients } from "@/lib/report-email-schema";

describe("destinatarios de informes", () => {
  it("acepta uno o varios separados por coma y punto y coma", () => {
    expect(parseRecipients("a@axisdc.cl").success).toBe(true);
    expect(parseRecipients("a@axisdc.cl, b@axisdc.cl; c@axisdc.cl").success).toBe(true);
  });
  it("rechaza formato inválido y más de cinco", () => {
    expect(parseRecipients("invalido").success).toBe(false);
    expect(parseRecipients("a@a.cl,b@a.cl,c@a.cl,d@a.cl,e@a.cl,f@a.cl").success).toBe(false);
  });
});
