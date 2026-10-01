import { expect, test } from "@playwright/test";
import { loginAs } from "./helpers";

test("sin sesión, todo redirige a /login", async ({ page }) => {
  await page.goto("/encargado");
  await expect(page).toHaveURL(/\/login$/);
});

const HOMES = [
  { userId: "u-prop-1", role: "PROPIETARIO", home: "/propietario" },
  { userId: "u-enc-centro", role: "ENCARGADO", home: "/encargado" },
  { userId: "u-admin", role: "ADMIN", home: "/admin" },
  { userId: "u-admin-obra", role: "ADMIN_OBRA", home: "/admin-obra" },
] as const;

for (const { userId, role, home } of HOMES) {
  test(`${role} entra a su inicio y no a otras secciones`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await loginAs(context, userId, role);
    await page.goto("/");
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    const other = home === "/admin" ? "/encargado" : "/admin";
    await page.goto(other);
    await expect(page).toHaveURL(new RegExp(`${home}$`));
    await expect(page.getByRole("banner")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("el rol ADMIN se muestra como \"Superadministrador\" en login y encabezado, nunca \"Administrador\" a secas", async ({ page, context }) => {
  await page.goto("/pruebas");
  await expect(page.getByRole("heading", { name: "Superadministrador", level: 3 })).toBeVisible();
  await expect(page.getByText(/^Administrador$/)).toHaveCount(0);

  await loginAs(context, "u-admin", "ADMIN");
  await page.goto("/admin");
  const bannerText = await page.getByRole("banner").innerText();
  expect(bannerText).toContain("Superadministrador");
  // La palabra "Administrador" sola (sin "Super" antes ni "de obra" después) no debería aparecer.
  const bareAdmin = bannerText.replace(/Superadministrador/g, "").replace(/Administrador de obra/g, "");
  expect(bareAdmin).not.toMatch(/\bAdministrador\b/);
});

test("el administrador de obra solo ve indicadores de sus obras, sin datos personales", async ({ page, context }) => {
  await loginAs(context, "u-admin-obra", "ADMIN_OBRA");
  await page.goto("/admin-obra");
  await expect(page.getByRole("heading", { name: "Indicadores de obra" })).toBeVisible();
  await expect(page.getByText("Desempeño por equipo de trabajo")).toBeVisible();
  const main = page.locator("main");
  await expect(main).not.toContainText("Alto Bulnes");
  await expect(main).not.toContainText("@");
  await expect(main.locator("a")).toHaveCount(0);
});
