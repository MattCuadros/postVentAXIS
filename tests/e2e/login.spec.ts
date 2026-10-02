import { expect, test } from "@playwright/test";

test("/login es el ingreso con correo y contraseña", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "PostventAXIS" })).toBeVisible();
  await expect(page.getByText("Ingresa con tu correo y contraseña.")).toBeVisible();
  await expect(page.getByLabel("Correo")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Correo")).toHaveAttribute("autocomplete", "username");
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("type", "password");
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("button", { name: "Ingresar" })).toBeVisible();
  // Ya no es el selector de usuarios.
  await expect(page.getByText("Ingresar como")).toHaveCount(0);
});

test("la raíz lleva al login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("enviar vacío muestra los dos errores; un correo mal escrito, el de formato", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Ingresa tu correo.")).toBeVisible();
  await expect(page.getByText("Ingresa tu contraseña.")).toBeVisible();
  await expect(page.getByLabel("Correo")).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("aria-describedby", "login-password-error");

  await page.getByLabel("Correo").fill("no-es-un-correo");
  await page.getByLabel("Contraseña").fill("algo");
  await page.getByRole("button", { name: "Ingresar" }).click();
  await expect(page.getByText("Escribe un correo válido, por ejemplo nombre@empresa.cl.")).toBeVisible();
  await expect(page.getByText("Ingresa tu contraseña.")).toHaveCount(0);
});

test("datos válidos: avisa que aún no está disponible, sin crear sesión ni guardar la contraseña", async ({ page, context }) => {
  const secret = "clave-super-secreta-123";
  const logs: string[] = [];
  page.on("console", (message) => logs.push(message.text()));
  await page.goto("/login");
  await page.getByLabel("Correo").fill("persona@correo.cl");
  await page.getByLabel("Contraseña").fill(secret);
  await page.keyboard.press("Enter"); // Enter envía el formulario

  await expect(page.getByText("El ingreso con contraseña se habilitará cuando PostventAXIS pase a producción. Por ahora, entra a la pantalla de pruebas.")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);

  const cookies = (await context.cookies()).map((cookie) => cookie.name);
  expect(cookies).not.toContain("pv_user_id");
  expect(cookies).not.toContain("pv_role");

  const stored = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
  expect(stored).not.toContain(secret);
  expect(logs.join("\n")).not.toContain(secret);
});

test("Mostrar / Ocultar la contraseña", async ({ page }) => {
  await page.goto("/login");
  const toggle = page.getByRole("button", { name: "Mostrar", exact: true });
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(toggle).toHaveAttribute("aria-controls", "login-password");
  await toggle.click();
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("type", "text");
  await expect(page.getByRole("button", { name: "Ocultar", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Ocultar", exact: true }).click();
  await expect(page.getByLabel("Contraseña")).toHaveAttribute("type", "password");
});

test("el botón de pruebas lleva a /pruebas; elegir un usuario entra a la home de su rol; volver regresa al ingreso", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Solo durante la etapa de pruebas. Los datos se guardan en este navegador.")).toBeVisible();
  await page.getByRole("link", { name: "Entrar a la pantalla de pruebas" }).click();
  await expect(page).toHaveURL(/\/pruebas$/);
  await expect(page.getByText("Ambiente de pruebas: elige un usuario para ver la app desde su rol.")).toBeVisible();

  await page.getByRole("link", { name: "← Volver al ingreso" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByRole("link", { name: "Entrar a la pantalla de pruebas" }).click();
  await page.getByRole("button", { name: "Rodrigo Pérez" }).click();
  await expect(page).toHaveURL(/\/encargado$/);
});

test("con sesión, /login y /pruebas llevan a la home del rol; sin sesión, /pruebas es accesible", async ({ page, context }) => {
  await page.goto("/pruebas");
  await expect(page).toHaveURL(/\/pruebas$/);

  await context.addCookies([
    { name: "pv_user_id", value: "u-admin", url: "http://localhost:3100" },
    { name: "pv_role", value: "ADMIN", url: "http://localhost:3100" },
  ]);
  await page.goto("/login");
  await expect(page).toHaveURL(/\/admin$/);
  await page.goto("/pruebas");
  await expect(page).toHaveURL(/\/admin$/);
});

test("el aviso de mantenimiento se ve en /login y en /pruebas", async ({ page }) => {
  const inicio = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
  await page.route(/\/mantenimiento\.json/, (route) =>
    route.fulfill({ json: { programado: [{ rama: "x", titulo: "Mejoras", inicio, duracionMinutos: 30 }], ultimo: null } }),
  );
  for (const path of ["/login", "/pruebas"]) {
    await page.goto(path);
    await expect(page.getByTestId("maintenance-banner")).toContainText("Mantenimiento programado");
  }
});
