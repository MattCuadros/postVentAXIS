import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;

/**
 * Pruebas end-to-end del front sobre la compilación de producción (`npm run build` antes).
 * En local usa el Chrome instalado; en CI, el Chromium de Playwright.
 */
export default defineConfig({
  testDir: "tests/e2e",
  // Un solo worker: algunas pruebas graban video en el navegador (MediaRecorder + lectura de
  // duración), y varias grabaciones a la vez saturan la CPU y vuelven la lectura poco fiable.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    ...(process.env.CI ? {} : { channel: "chrome" }),
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], ...(process.env.CI ? {} : { channel: "chrome" }) } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
