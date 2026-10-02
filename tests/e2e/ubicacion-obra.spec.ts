import { expect, test, type Page } from "@playwright/test";
import { loginAs, savedState } from "./helpers";

async function openNewProject(page: Page) {
  await page.goto("/admin/obras");
  await page.getByRole("button", { name: "Nueva obra" }).first().click();
  const dialog = page.locator("dialog[open]");
  await dialog.getByLabel("Nombre de la obra").fill("Edificio Prueba Norte");
  await dialog.getByLabel("Código de obra").fill("EPN");
  await dialog.getByLabel("Zona").selectOption({ index: 1 });
  return dialog;
}

test("las rutas /api no las intercepta la redirección por rol", async ({ request }) => {
  // Sin cookie de sesión: el proxy de roles mandaría a /login; las rutas /api responden por sí mismas.
  const response = await request.post("/api/geocode", { data: {} });
  expect(response.status()).toBe(400);
  const blocked = await request.post("/api/resolve-maps-link", { data: { url: "https://evil.com/" } });
  expect(blocked.status()).toBe(422);
});

test("una dirección se convierte en coordenadas al salir de la comuna, con el lugar encontrado para confirmar", async ({ page, context }) => {
  await page.route("**/api/geocode", (route) =>
    route.fulfill({ json: { lat: -33.4512, lng: -70.6601, label: "Av. Ejemplo 1234, Santiago, Chile" } }),
  );
  await loginAs(context, "u-admin", "ADMIN");
  const dialog = await openNewProject(page);
  await dialog.getByLabel("Dirección").fill("Av. Ejemplo 1234");
  await dialog.getByLabel("Comuna").fill("Santiago");
  await dialog.getByLabel("Ubicación").focus(); // sale del campo Comuna

  await expect(dialog.getByLabel("Ubicación")).toHaveValue("-33.451200, -70.660100");
  await expect(dialog.getByText("Encontramos: Av. Ejemplo 1234, Santiago, Chile.")).toBeVisible();
  await expect(dialog.getByRole("link", { name: "Revisar en el mapa" })).toBeVisible();

  await dialog.getByRole("button", { name: "Crear obra" }).click();
  await expect(dialog).toHaveCount(0);
  const project = (await savedState(page)).state.projects.find((item: { code: string }) => item.code === "EPN");
  expect(project.location).toEqual({ lat: -33.4512, lng: -70.6601 });
});

test("un enlace corto de Maps se resuelve en el servidor; uno largo se lee sin llamarlo", async ({ page, context }) => {
  let resolveCalls = 0;
  await page.route("**/api/resolve-maps-link", (route) => {
    resolveCalls += 1;
    return route.fulfill({ json: { lat: -33.4, lng: -70.6 } });
  });
  await loginAs(context, "u-admin", "ADMIN");
  const dialog = await openNewProject(page);

  await dialog.getByLabel("Ubicación").fill("https://maps.app.goo.gl/AbCdEf");
  await dialog.getByLabel("Nombre de la obra").focus();
  await expect(dialog.getByLabel("Ubicación")).toHaveValue("-33.400000, -70.600000");
  expect(resolveCalls).toBe(1);

  await dialog.getByLabel("Ubicación").fill("https://www.google.com/maps/place/X/data=!3d-33.5!4d-70.5");
  await dialog.getByLabel("Nombre de la obra").focus();
  await expect(dialog.getByText("Coordenadas: -33.500000, -70.500000")).toBeVisible();
  expect(resolveCalls).toBe(1);
});

test("una dirección inexistente muestra un error amable y no bloquea el guardado manual", async ({ page, context }) => {
  await page.route("**/api/geocode", (route) => route.fulfill({ status: 404, json: { error: "No encontramos esa dirección." } }));
  await loginAs(context, "u-admin", "ADMIN");
  const dialog = await openNewProject(page);
  await dialog.getByLabel("Dirección").fill("Calle que no existe 999");
  await dialog.getByLabel("Comuna").fill("Ninguna");
  await dialog.getByLabel("Ubicación").focus();
  await expect(dialog.getByText("No encontramos esa dirección. Prueba agregando la comuna o pega un enlace de Google Maps.")).toBeVisible();

  await dialog.getByLabel("Ubicación").fill("-33.44, -70.66");
  await dialog.getByRole("button", { name: "Crear obra" }).click();
  await expect(dialog).toHaveCount(0);
});
