import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { loginAs } from "./helpers";

const PERIODS = ["Última semana", "Últimas 2 semanas", "Último mes", "Últimos 3 meses", "Todo el período"];

test("el encargado filtra sus estadísticas por período y descarga el Excel", async ({ page, context }) => {
  await loginAs(context, "u-enc-centro", "ENCARGADO");
  await page.goto("/encargado");
  await page.getByRole("link", { name: "Estadísticas" }).first().click();
  await expect(page.getByRole("heading", { name: "Estadísticas" })).toBeVisible();

  const value = (label: string) => page.getByText(label, { exact: true }).locator("xpath=preceding-sibling::p[1]");
  const counts: number[] = [];
  for (const period of PERIODS) {
    await page.getByRole("button", { name: period, exact: true }).click();
    await expect(page.getByRole("button", { name: period, exact: true })).toHaveAttribute("aria-pressed", "true");
    const count = Number(await value("Ingresados en el período").innerText());
    counts.push(count);
    const rows = page.locator("main table tbody tr");
    await expect(rows).toHaveCount(count === 0 ? 0 : Math.min(count, 50));
  }
  for (let index = 1; index < counts.length; index += 1) expect(counts[index]).toBeGreaterThanOrEqual(counts[index - 1]);

  const openTile = page.getByRole("button", { name: /Ver los \d+ requerimientos: Abiertos$/ });
  await openTile.click();
  await expect(openTile).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/^Mostrando: Abiertos \(\d+\)/)).toBeVisible();
  const expectedOpen = Number((await page.getByText(/^Mostrando: Abiertos \((\d+)\)/).innerText()).match(/\((\d+)\)/)?.[1]);
  if (expectedOpen > 50) {
    await page.getByRole("button", { name: `Mostrar los ${expectedOpen} requerimientos` }).click();
    await expect(page.locator("main table tbody tr")).toHaveCount(expectedOpen);
  }
  const firstFolio = page.locator("main table tbody tr a").first();
  await firstFolio.click();
  await page.waitForURL(/\/tickets\//);
  await page.goBack();
  await expect(page).toHaveURL(/ver=abiertos/);
  await expect(page.getByText(/^Mostrando: Abiertos/)).toBeVisible();
  await expect(page.locator('button[aria-label^="Ver los 0 requerimientos:"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Todo el período", exact: true }).click();
  await page.getByLabel("Estado").selectOption("ABIERTOS");
  const open = Number(await value("Ingresados en el período").innerText());
  expect(open).toBeLessThanOrEqual(counts.at(-1)!);
  await expect(page.getByRole("button", { name: "Quitar filtros" })).toBeVisible();

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar Excel" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^estadisticas-postventa-centro-todo-el-periodo-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const book = XLSX.read(await (await download.createReadStream()).toArray().then((parts) => Buffer.concat(parts)));
  expect(book.SheetNames).toEqual(["Resumen", "Tendencia", "Por estado", "Por origen", "Por obra", "Por equipo", "Requerimientos"]);
  expect(XLSX.utils.sheet_to_json(book.Sheets.Requerimientos)).toHaveLength(open);
});

test("el envío del informe valida destinatarios y mantiene disponible el Excel", async ({ page, context }) => {
  await loginAs(context, "u-enc-centro", "ENCARGADO");
  await page.goto("/encargado/estadisticas");
  const input = page.getByLabel("Enviar a");
  await input.fill("no-es-correo");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText(/Ingresa entre 1 y 5 correos válidos/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Descargar Excel" })).toBeEnabled();
});

test("envía el PDF con éxito y ofrece mailto cuando SMTP no está disponible", async ({ page, context }) => {
  await loginAs(context, "u-enc-centro", "ENCARGADO");
  await page.goto("/encargado/estadisticas");
  await page.getByLabel("Enviar a").fill("destino@axisdc.cl");
  await page.route("**/api/reports/email", async (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) }));
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Informe enviado a destino@axisdc.cl" })).toBeVisible();

  await page.getByLabel("Enviar a").fill("destino@axisdc.cl");
  await page.unroute("**/api/reports/email");
  await page.route("**/api/reports/email", async (route) => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "NO_DISPONIBLE" }) }));
  await page.addInitScript(() => { window.addEventListener("beforeunload", (event) => event.preventDefault()); });
  const downloads = page.waitForEvent("download");
  await page.getByRole("button", { name: "Enviar" }).click();
  const downloaded = await downloads;
  expect(downloaded.suggestedFilename()).toMatch(/\.pdf$/);
  await expect(page.getByText(/Adjunta el archivo descargado/)).toBeVisible();
});
