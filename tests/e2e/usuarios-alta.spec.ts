import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

const EMAIL = "prueba.workspace@axisdc.cl";

test("el superadministrador da de alta un encargado con correo de Google Workspace y queda a cargo de su zona", async ({ page, context }) => {
  await loginAs(context, "u-admin", "ADMIN");
  await page.goto("/admin/usuarios");
  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  await expect(page.getByLabel("Rol", { exact: true })).toBeEnabled();
  await page.getByLabel("Nombre completo").fill("Prueba Workspace");
  await page.getByLabel("Correo").fill("  Prueba.Workspace@AXISDC.cl ");
  await page.getByLabel("Teléfono").fill("+56 9 1234 5678");
  await page.getByLabel("Rol", { exact: true }).selectOption("ENCARGADO");
  await page.getByRole("dialog").getByText("Postventa Centro", { exact: true }).click();
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText(/Prueba Workspace creado como encargado/i)).toBeVisible();
  await expect(page.getByRole("row", { name: /Prueba Workspace prueba\.workspace@axisdc\.cl .* Encargado Postventa Centro/ })).toBeVisible();

  await page.getByRole("button", { name: "Nuevo usuario" }).click();
  await page.getByLabel("Nombre completo").fill("Duplicado");
  await page.getByLabel("Correo").fill(EMAIL.toUpperCase());
  await page.getByLabel("Teléfono").fill("+56 9 0000 0000");
  await page.getByRole("button", { name: "Crear usuario" }).click();
  await expect(page.getByText("Ese correo ya está registrado.")).toBeVisible();

  await page.goto("/admin/estadisticas");
  await page.getByLabel("Zona").selectOption({ label: "Postventa Centro" });
  await expect(page.getByText(/Encargado: Rodrigo Pérez, Prueba Workspace/)).toBeVisible();
});

test("editar tu propio usuario sigue sin permitir cambiarte el rol", async ({ page, context }) => {
  await loginAs(context, "u-admin", "ADMIN");
  await page.goto("/admin/usuarios");
  await page.getByRole("row", { name: /Carolina Fuentes/ }).getByRole("button", { name: "Editar" }).click();
  await expect(page.getByLabel("Rol", { exact: true })).toBeDisabled();
});
