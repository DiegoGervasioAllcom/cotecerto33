import { defineConfig, devices } from "@playwright/test";

const PORT = 8080;
const baseURL = `http://localhost:${PORT}`;

// Robô Quiver MOCKADO (tests/e2e/personalizar-seguradora.spec.ts). Só com opt-in
// (CI ou E2E_ROBO_MOCK=1): força o servidor da app a enviar para o mock local,
// nunca para o robô/portal reais (a porta 3000 local pode ser o robô real).
// Porta do mock != 8080 (app) e != 3000 (robô real).
const ROBO_MOCK = !!process.env.CI || process.env.E2E_ROBO_MOCK === "1";
export const ROBO_MOCK_PORT = 3999;
if (ROBO_MOCK) process.env.SELF_QUIVER_API_URL = `http://127.0.0.1:${ROBO_MOCK_PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL,
    trace: "on-first-retry",
    // Screenshot só em falha, e só na CI (evita mudar o comportamento local).
    screenshot: process.env.CI ? "only-on-failure" : "off",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "bun run dev",
    url: baseURL,
    // Com o mock ligado o servidor TEM de nascer daqui (com a URL forçada acima);
    // reaproveitar um dev server antigo poderia apontar para o robô real.
    reuseExistingServer: !process.env.CI && !ROBO_MOCK,
    env: ROBO_MOCK ? { SELF_QUIVER_API_URL: `http://127.0.0.1:${ROBO_MOCK_PORT}` } : {},
    timeout: 120_000,
  },
});
