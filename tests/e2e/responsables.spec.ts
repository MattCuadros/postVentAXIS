import { expect, test } from "@playwright/test";
import { loginAs, patchRecord, savedState } from "./helpers";

test("un familiar con permiso ve y firma; el titular ya no puede firmar de nuevo; se registra su calidad", async ({ page, context }) => {
  // t-2 (Torre A 704, un-1) está EN_RECEPCION en los datos de ejemplo; Diego (u-prop-8) es
  // responsable "Familiar (hijo)" de esa unidad, con permiso de firma.
  await loginAs(context, "u-prop-8", "PROPIETARIO");
  await page.goto("/propietario");
  await expect(page.getByText("MIR-0002-C")).toBeVisible();
  await page.getByText("MIR-0002-C").click();
  await expect(page).toHaveURL(/\/propietario\/tickets\/t-2/);
  await expect(page.getByText("Familiar (hijo)")).toBeVisible();
  await page.getByRole("button", { name: "Recibir conforme" }).click();
  await expect(page.getByText(/Registramos tu conformidad/)).toBeVisible();

  const afterHijo = (await savedState(page)).state;
  const ticket = afterHijo.tickets.find((item: { id: string }) => item.id === "t-2");
  expect(ticket.status).toBe("CERRADO");
  const lastEntry = afterHijo.statusHistory.findLast((item: { ticketId: string }) => item.ticketId === "t-2");
  expect(lastEntry.actorCapacity).toBe("Familiar (hijo)");
  expect(lastEntry.changedById).toBe("u-prop-8");

  // El titular ve el mismo ticket ya cerrado, y no le quedan botones de conformidad.
  await context.clearCookies();
  await loginAs(context, "u-prop-1", "PROPIETARIO");
  await page.goto("/propietario/tickets/t-2");
  await expect(page.getByText("Cerrado", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Recibir conforme" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "No estoy conforme" })).toHaveCount(0);
});

test("el administrador del comité ve unidades de dos obras distintas", async ({ page, context }) => {
  await loginAs(context, "u-prop-9", "PROPIETARIO");
  await page.goto("/propietario/nuevo");
  await expect(page.getByText("Edificio Mirador Central")).toBeVisible();
  await expect(page.getByText("Condominio Los Robles")).toBeVisible();
  await expect(page.getByText("Administrador del comité")).toHaveCount(2);
});

test("quitar un responsable le quita el acceso de inmediato", async ({ page, context }) => {
  await loginAs(context, "u-enc-centro", "ENCARGADO");
  await page.goto("/encargado/tickets/t-2");
  await expect(page.getByText("Diego Muñoz", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Quitar", exact: true }).first().click();
  await expect(page.getByText("Diego Muñoz", { exact: true })).toHaveCount(0);

  await context.clearCookies();
  await loginAs(context, "u-prop-8", "PROPIETARIO");
  await page.goto("/propietario");
  await expect(page.getByText("Aún no tienes requerimientos")).toBeVisible();
  await page.goto("/propietario/tickets/t-2");
  await expect(page.getByText("No encontramos este requerimiento")).toBeVisible();
});

test("una unidad sin titular, pero con un responsable con permiso, sí puede pasar a recepción", async ({ page, context }) => {
  await loginAs(context, "u-enc-sur", "ENCARGADO");
  await page.goto("/encargado");
  await patchRecord(page, "units", "un-2", { ownerId: null });
  await patchRecord(page, "tickets", "t-3", { status: "EN_EJECUCION", encargadoId: "u-enc-sur" });
  await page.reload();

  await page.goto("/encargado/tickets/t-3");
  await expect(page.getByText("Sin propietario.")).toBeVisible();
  // Sigue pudiendo solicitar la recepción: la administradora del comité (responsable de un-2) puede firmar.
  await expect(page.getByRole("button", { name: "Solicitar recepción" })).toBeVisible();
  await expect(page.getByText("Agrega un titular o un responsable con permiso de firma")).toHaveCount(0);
});
