import { expect, test } from "@playwright/test";
import { loginAs, PNG_1PX, recordVideo, savedState } from "./helpers";

test("el propietario ingresa un requerimiento con foto y recibe folio por obra", async ({ page, context }) => {
  await context.setDefaultTimeout(15_000);
  await loginAs(context, "u-prop-1", "PROPIETARIO");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/propietario/nuevo");

  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByText("Sanitarias", { exact: true }).click();
  await page.getByLabel("Recinto").selectOption("Baño principal");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("textbox", { name: "Descripción" }).fill("Prueba e2e: gotea la llave del lavamanos del baño principal.");
  await page.getByTestId("media-input").setInputFiles({ name: "llave.png", mimeType: "image/png", buffer: PNG_1PX });
  await expect(page.getByText(/1 de 5 archivos/)).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText("1 foto", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Enviar requerimiento" }).click();

  await expect(page).toHaveURL(/\/propietario\/tickets\/.+\?creado=1/);
  const state = await savedState(page);
  const created = state.state.tickets.find((ticket: { description: string }) => ticket.description.startsWith("Prueba e2e:"));
  expect(created.folio).toMatch(/^MIR-\d{4}-C$/);
  expect(created.media).toHaveLength(1);
  expect(created.media[0]).toMatchObject({ type: "IMAGE", stage: "PROBLEMA" });
  await expect(page.getByText(created.folio)).toBeVisible();
});

test("el encargado registra la visita con foto y video corto; un video largo se rechaza", async ({ page, context }) => {
  test.setTimeout(120_000);
  await loginAs(context, "u-enc-centro", "ENCARGADO");
  await page.goto("/encargado");
  const state = await savedState(page);
  const ticket = state.state.tickets.find((item: { status: string; encargadoId: string }) => item.status === "ASIGNADO" && item.encargadoId === "u-enc-centro");
  expect(ticket).toBeTruthy();

  await page.goto(`/encargado/tickets/${ticket.id}`);
  await page.getByRole("button", { name: "Registrar visita" }).first().click();
  const dialog = page.locator("dialog[open]");
  const [short, long] = [await recordVideo(page, 2), await recordVideo(page, 7)];
  await dialog.getByTestId("media-input").setInputFiles([
    { name: "falla.png", mimeType: "image/png", buffer: PNG_1PX },
    { name: "corto.webm", mimeType: "video/webm", buffer: short },
    { name: "largo.webm", mimeType: "video/webm", buffer: long },
  ]);
  await expect(dialog.getByText(/2 de 5 archivos/)).toBeVisible({ timeout: 45_000 });
  await expect(dialog.getByRole("alert")).toContainText("largo.webm: El video dura 7 segundos; el máximo es 5.");

  await dialog.getByLabel("Diagnóstico").fill("Cerámica suelta por falta de adhesivo; se debe reinstalar.");
  await dialog.getByRole("button", { name: "Registrar visita" }).click();
  await expect(dialog).toHaveCount(0);

  const after = (await savedState(page)).state.tickets.find((item: { id: string }) => item.id === ticket.id);
  expect(after.status).toBe("VISITA_INSPECTIVA");
  expect(after.media.map((item: { type: string; stage: string }) => `${item.type}:${item.stage}`)).toEqual(["IMAGE:VISITA", "VIDEO:VISITA"]);
  await expect(page.locator("main video")).toHaveCount(1);
});
