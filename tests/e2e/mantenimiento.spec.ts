import { expect, test, type Page } from "@playwright/test";
import { loginAs } from "./helpers";

async function serveMaintenance(page: Page, body: unknown) {
  await page.route(/\/mantenimiento\.json/, (route) => route.fulfill({ json: body }));
}

test.beforeEach(async ({ context }) => {
  await loginAs(context, "u-enc-centro", "ENCARGADO");
});

test("sin mantenimiento programado no hay aviso", async ({ page }) => {
  await page.goto("/encargado");
  await expect(page.getByRole("heading", { name: "Requerimientos" })).toBeVisible();
  await expect(page.getByTestId("maintenance-banner")).toHaveCount(0);
});

test("anuncia el mantenimiento programado sin bloquear la app, y se puede ocultar", async ({ page }) => {
  const inicio = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  await serveMaintenance(page, { programado: [{ rama: "programado/x", titulo: "Estadísticas nuevas", inicio, duracionMinutos: 30 }], ultimo: null });
  await page.goto("/encargado");
  const banner = page.getByTestId("maintenance-banner");
  await expect(banner).toContainText("Mantenimiento programado para el");
  await expect(banner).toContainText("Estadísticas nuevas");

  // La app sigue funcionando con el aviso visible.
  await page.getByRole("link", { name: "Calendario" }).first().click();
  await expect(page).toHaveURL(/\/encargado\/calendario$/);
  await expect(banner).toBeVisible();

  await banner.getByRole("button", { name: "Ocultar aviso" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Calendario" })).toBeVisible();
  await expect(page.getByTestId("maintenance-banner")).toHaveCount(0);
});

test("tras un despliegue, ofrece actualizar a quien tiene la versión anterior", async ({ page }) => {
  // Despliegue "posterior" a la compilación que se está probando.
  const completadoEn = new Date(Date.now() + 60 * 1000).toISOString();
  await serveMaintenance(page, { programado: [], ultimo: { completadoEn, novedades: ["Estadísticas nuevas"] } });
  await page.clock.install({ time: new Date(Date.now() + 2 * 60 * 1000) });
  await page.goto("/encargado");
  const banner = page.getByTestId("maintenance-banner");
  await expect(banner).toContainText("Hay una versión nueva de PostventAXIS");
  await expect(banner.getByRole("button", { name: "Actualizar ahora" })).toBeVisible();
});
