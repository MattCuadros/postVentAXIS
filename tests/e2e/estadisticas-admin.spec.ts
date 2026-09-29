import { expect, test } from "@playwright/test";
import * as XLSX from "xlsx";
import { loginAs } from "./helpers";

const PERIODS = ["Última semana", "Últimas 2 semanas", "Último mes", "Últimos 3 meses", "Todo el período"];

test("el superadministrador ve las estadísticas por zona, filtra por período y descarga el Excel", async ({ page, context }) => {
  await loginAs(context, "u-admin", "ADMIN");
  await page.goto("/admin");
  await page.getByRole("link", { name: "Estadísticas por zona" }).first().click();
  await expect(page.getByRole("heading", { name: "Estadísticas" })).toBeVisible();

  const value = (label: string) => page.getByText(label, { exact: true }).locator("xpath=preceding-sibling::p[1]");
  const counts: number[] = [];
  for (const period of PERIODS) {
    await page.getByRole("button", { name: period, exact: true }).click();
    await expect(page.getByRole("button", { name: period, exact: true })).toHaveAttribute("aria-pressed", "true");
    counts.push(Number(await value("Ingresados en el período").innerText()));
  }
  for (let index = 1; index < counts.length; index += 1) expect(counts[index]).toBeGreaterThanOrEqual(counts[index - 1]);

  const total = counts.at(-1)!;
  await page.getByLabel("Zona").selectOption({ label: "Postventa Centro" });
  await expect(page.getByText("Encargado: Rodrigo Pérez")).toBeVisible();
  const centro = Number(await value("Ingresados en el período").innerText());
  expect(centro).toBeLessThanOrEqual(total);

  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Descargar Excel" }).click()]);
  expect(download.suggestedFilename()).toMatch(/^estadisticas-postventa-centro-todo-el-periodo-\d{4}-\d{2}-\d{2}\.xlsx$/);
  const book = XLSX.read(await (await download.createReadStream()).toArray().then((parts) => Buffer.concat(parts)));
  expect(book.SheetNames).toEqual(["Resumen", "Tendencia", "Por estado", "Por origen", "Por obra", "Por equipo", "Requerimientos"]);
  expect(XLSX.utils.sheet_to_json(book.Sheets.Requerimientos)).toHaveLength(centro);
});

test("el encargado zonal no accede a las estadísticas del superadministrador", async ({ page, context }) => {
  await loginAs(context, "u-enc-centro", "ENCARGADO");
  await page.goto("/admin/estadisticas");
  await expect(page).not.toHaveURL(/\/admin\/estadisticas/);
});
