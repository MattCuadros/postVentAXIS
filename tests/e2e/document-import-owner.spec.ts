import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

/** PDF mínimo con texto digital (ASCII), suficiente para que pdfjs lo lea sin recurrir a OCR. */
function textPdf(lines: string[]): Buffer {
  const escape = (line: string) => line.replace(/[\\()]/g, "\\$&");
  const content = `BT /F1 12 Tf 50 750 Td 16 TL ${lines.map((line) => `(${escape(line)}) Tj T*`).join(" ")} ET`;
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let body = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, "latin1");
}

test("al elegir una unidad con propietario no quedan errores ocultos y se conserva su propietario", async ({ page, context }) => {
  await loginAs(context, "u-enc-centro", "ENCARGADO");
  await page.goto("/encargado/documentos");
  await page.locator("#document-file").setInputFiles({
    name: "correo.pdf",
    mimeType: "application/pdf",
    buffer: textPdf([
      "De: Pedro Nuevo <pnuevo@correo.cl>",
      "Asunto: Filtracion en bano de la unidad",
      "Hay una filtracion bajo el lavamanos del bano principal desde hace una semana.",
      "Quedo atento a su visita para revisar el problema.",
    ]),
  });
  await expect(page.getByRole("heading", { name: "Requerimiento 1" })).toBeVisible();

  await page.getByLabel("Obra").selectOption("p-mirador");
  await page.getByLabel("Unidad", { exact: true }).selectOption("un-1");
  await expect(page.getByText("Propietario registrado: Andrés Muñoz")).toBeVisible();
  await page.getByLabel("Recinto").fill("Baño principal");
  await page.getByLabel("Origen de la falla").selectOption("c-sanitarias");
  await page.getByLabel("Descripción").fill("Filtración bajo el lavamanos del baño principal.");

  await page.getByRole("button", { name: "Registrar 1 requerimiento" }).click();
  await expect(page.getByText("1 requerimiento registrado desde el documento.")).toBeVisible();

  const state = await page.evaluate(() => JSON.parse(localStorage.getItem("postventaxis:datos")!));
  expect(state.state.units.find((unit: { id: string }) => unit.id === "un-1").ownerId).toBe("u-prop-1");
});
