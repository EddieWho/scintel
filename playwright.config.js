import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:4175/scintel/",
    browserName: "chromium",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node scripts/serve.mjs --dist --port 4175",
    url: "http://127.0.0.1:4175/scintel/",
    reuseExistingServer: !process.env.CI,
  },
});
