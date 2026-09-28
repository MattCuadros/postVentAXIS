import { expect, test } from "@playwright/test";
import { loginAs, patchRecord, removeRecords, savedState } from "./helpers";

const CSV = [
  "Tipo;Torre;Piso;Número;Fecha entrega;Correo propietario;Nombre propietario;Teléfono propietario",
  "Departamento;X;1;901;15-10-2026;;;",
  "Departamento;X;1;902;15-10-2026;amunoz@correo.cl;;",
  "Departamento;X;1;903;15-10-2026;no-es-un-correo;;",
].join("\r\n");

test("importar unidades: sin propietario no bloquea, correo inválido sí", async ({ page, context }) => {
  await loginAs(context, "u-admin", "ADMIN");
  await page.goto("/admin/obras/p-mirador");
  await page.getByRole("button", { name: "Importar unidades (CSV)" }).click();
  await page.locator("#unit-import-file").setInputFiles({ name: "unidades.csv", mimeType: "text/csv", buffer: Buffer.from(CSV, "utf8") });

  // 901 (sin datos de propietario) y 902 (correo existente) quedan listas; 903 (correo inválido) bloquea.
  const summary = page.getByText(/unidades? listas?/);
  await expect(summary).toContainText("2 unidades listas");
  await expect(summary).toContainText("1 con propietario");
  await expect(summary).toContainText("1 sin propietario (se importa igual)");
  await expect(summary).toContainText("1 con errores (no se importan)");
  await expect(page.getByText('Correo "no-es-un-correo" no válido.')).toBeVisible();

  await page.getByRole("button", { name: /Importar 2 unidades/ }).click();
  await expect(page.getByText(/procesadas/)).toContainText("2 unidades procesadas");

  const state = (await savedState(page)).state;
  const created = state.units.filter((unit: { number: string }) => ["901", "902"].includes(unit.number));
  expect(created).toHaveLength(2);
  const withoutOwner = created.find((unit: { number: string }) => unit.number === "901");
  const withOwner = created.find((unit: { number: string }) => unit.number === "902");
  expect(withoutOwner.ownerId).toBeNull();
  expect(withOwner.ownerId).toBe(state.users.find((user: { email: string }) => user.email === "amunoz@correo.cl").id);
  expect(state.units.some((unit: { number: string }) => unit.number === "903")).toBe(false);

  // La unidad de arriba muestra "Sin propietario" en gris, no un guion en blanco.
  await expect(page.locator("main")).toContainText("Sin propietario");
});

test("reimportar el mismo archivo asigna el propietario a la unidad ya creada", async ({ page, context }) => {
  await loginAs(context, "u-admin", "ADMIN");
  await page.goto("/admin/obras/p-mirador");
  await page.getByRole("button", { name: "Importar unidades (CSV)" }).click();
  await page.locator("#unit-import-file").setInputFiles({
    name: "unidades.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(["Tipo;Torre;Piso;Número;Fecha entrega;Correo propietario", "Departamento;Y;2;201;15-10-2026;"].join("\r\n"), "utf8"),
  });
  await page.getByRole("button", { name: /Importar 1 unidad/ }).click();
  await expect(page.getByText(/procesad/)).toBeVisible();
  await page.getByRole("button", { name: "Importar unidades (CSV)" }).click();

  await page.locator("#unit-import-file").setInputFiles({
    name: "unidades2.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(["Tipo;Torre;Piso;Número;Fecha entrega;Correo propietario", "Departamento;Y;2;201;15-10-2026;amunoz@correo.cl"].join("\r\n"), "utf8"),
  });
  await expect(page.getByText("Se asignará propietario")).toBeVisible();
  await page.getByRole("button", { name: /Importar 1 unidad/ }).click();
  await expect(page.getByText(/asignación a unidad existente/)).toBeVisible();
  // El aviso ya confirma que la importación terminó, pero guardar en localStorage es un efecto
  // aparte (useEffect de DataProvider): se espera a que quede reflejado antes de leerlo.
  await page.waitForFunction(() => {
    const raw = JSON.parse(localStorage.getItem("postventaxis:datos") ?? "null");
    const unit = raw?.state.units.find((item: { tower: string; number: string }) => item.tower === "Y" && item.number === "201");
    return unit?.ownerId !== null;
  });

  const state = (await savedState(page)).state;
  const unit = state.units.find((item: { tower: string; number: string }) => item.tower === "Y" && item.number === "201");
  expect(state.units.filter((item: { tower: string; number: string }) => item.tower === "Y" && item.number === "201")).toHaveLength(1);
  expect(unit.ownerId).toBe(state.users.find((user: { email: string }) => user.email === "amunoz@correo.cl").id);
});

test("un ticket no puede pasar a recepción si su unidad no tiene propietario, hasta asignarlo", async ({ page, context }) => {
  await loginAs(context, "u-enc-centro", "ENCARGADO");
  await page.goto("/encargado");
  await patchRecord(page, "units", "un-1", { ownerId: null });
  await patchRecord(page, "tickets", "t-2", { status: "EN_EJECUCION" });
  // un-1 trae responsables de ejemplo (Tarea 3) que sí pueden firmar: para probar el bloqueo sin
  // nadie que firme, se quitan aquí (no afecta a otras pruebas: cada una tiene su propio contexto).
  await removeRecords(page, "unitResponsibles", "unitId", "un-1");
  await page.reload();

  await page.goto("/encargado/tickets/t-2");
  await expect(page.getByText("Agrega un titular o un responsable con permiso de firma para solicitar la recepción.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar recepción" })).toHaveCount(0);
  await expect(page.getByText("Sin propietario.")).toBeVisible();

  await page.getByRole("button", { name: "Asignar propietario" }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("Propietario").selectOption({ label: "Andrés Muñoz · amunoz@correo.cl" });
  await dialog.getByRole("button", { name: "Asignar" }).click();
  await expect(dialog).toHaveCount(0);

  await expect(page.getByText(/asignado como propietario/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Solicitar recepción" })).toBeVisible();
  await expect(page.getByText("Agrega un titular o un responsable con permiso de firma para solicitar la recepción.")).toHaveCount(0);

  const state = (await savedState(page)).state;
  expect(state.units.find((unit: { id: string }) => unit.id === "un-1").ownerId).toBe("u-prop-1");
});
