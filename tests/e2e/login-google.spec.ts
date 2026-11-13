import { expect, test, type Page } from "@playwright/test";

/** El estado del proveedor Google se consulta a Supabase; en las pruebas se simula. */
async function mockGoogleProvider(page: Page, enabled: boolean) {
  await page.route("**/auth/v1/settings", (route) => route.fulfill({ json: { external: { google: enabled, email: true } } }));
}

test("con Google habilitado, el botón lleva a Google con el dominio de Axis y vuelve a /auth/callback", async ({ page }) => {
  await mockGoogleProvider(page, true);
  let authorize: URL | null = null;
  await page.route("**/auth/v1/authorize**", (route) => {
    authorize = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "<title>Google</title>" });
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Continuar con Google" }).click();
  await expect.poll(() => authorize?.searchParams.get("provider")).toBe("google");
  expect(authorize!.searchParams.get("hd")).toBe("axisdc.cl");
  expect(authorize!.searchParams.get("redirect_to")).toBe("http://localhost:3100/auth/callback");
  expect(authorize!.searchParams.get("code_challenge")).toBeTruthy(); // flujo PKCE
});

test("sin el proveedor habilitado no se ofrece Google y el ingreso actual no cambia", async ({ page }) => {
  await mockGoogleProvider(page, false);
  await page.goto("/login");
  await expect(page.getByRole("button", { name: "Ingresar", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar con Google" })).toHaveCount(0);
});

test("un ingreso rechazado explica el motivo en /login", async ({ page }) => {
  await mockGoogleProvider(page, true);
  await page.goto("/login?error=NO_REGISTRADO");
  await expect(page.getByText("Tu correo aún no está dado de alta en PostventAXIS. Pídele al superadministrador que te registre.")).toBeVisible();
  await page.goto("/login?error=DOMINIO");
  await expect(page.getByText("Ingresa con tu cuenta de Google Workspace de Axis (@axisdc.cl).")).toBeVisible();
});

test("la vuelta de Google sin código o con un código inválido termina en /login con aviso, sin sesión", async ({ page, context }) => {
  await mockGoogleProvider(page, true);
  await page.goto("/auth/callback");
  await expect(page).toHaveURL(/\/login\?error=ERROR$/);
  await page.goto("/auth/callback?error=access_denied");
  await expect(page).toHaveURL(/\/login\?error=CANCELADO$/);
  await page.goto("/?code=codigo-inventado");
  await expect(page).toHaveURL(/\/login\?error=ERROR$/);
  await expect(page.getByText("No pudimos completar el ingreso con Google. Inténtalo de nuevo.")).toBeVisible();
  const names = (await context.cookies()).map((cookie) => cookie.name);
  expect(names).not.toContain("pv_user_id");
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login$/);
});

test("tras validar la cuenta, el perfil del directorio queda en este navegador y abre la sección de su rol", async ({ page, context }) => {
  await page.route("**/rest/v1/rpc/session_profile", (route) =>
    route.fulfill({ json: { id: "dir-ana", name: "Ana Directorio", email: "ana.directorio@axisdc.cl", phone: "+56 9 1111 2222", role: "ENCARGADO", active: true, zone_ids: ["z-sur"], project_ids: [] } }),
  );
  await page.goto("/auth/listo");
  await page.waitForURL(/\/encargado$/);
  await expect(page.getByText("Ana Directorio").first()).toBeVisible();
  await expect(page.getByText("Encargado · Postventa Sur")).toBeVisible();
  const cookies = Object.fromEntries((await context.cookies()).map((cookie) => [cookie.name, cookie.value]));
  expect(cookies.pv_user_id).toBe("dir-ana");
  expect(cookies.pv_role).toBe("ENCARGADO");
});

test("sin perfil en el directorio no se abre sesión", async ({ page, context }) => {
  await page.route("**/rest/v1/rpc/session_profile", (route) => route.fulfill({ json: null }));
  await page.route("**/auth/v1/settings", (route) => route.fulfill({ json: { external: { google: true } } }));
  await page.goto("/auth/listo");
  await expect(page).toHaveURL(/\/login\?error=NO_REGISTRADO$/);
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain("pv_user_id");
});
