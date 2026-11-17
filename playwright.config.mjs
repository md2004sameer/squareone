import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './src/test/browser',
  timeout: 45000,
  workers: 1,
  use: {
    baseURL: process.env.SQUAREONE_TEST_URL || 'http://127.0.0.1:8081',
    trace: 'retain-on-failure',
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: process.env.SQUAREONE_TEST_URL ? undefined : {
    command: "./gradlew bootRun --args='--server.port=8081 --server.address=127.0.0.1 --spring.config.import= --spring.profiles.active=h2-test --server.servlet.session.cookie.secure=false --spring.sql.init.mode=never --spring.flyway.baseline-on-migrate=false --DATABASE_SCHEMA=PUBLIC --spring.datasource.url=jdbc:h2:mem:squareone-browser-tests;DB_CLOSE_DELAY=-1 --spring.datasource.username=sa --spring.datasource.password= --debug=false --logging.level.root=WARN'",
    url: 'http://127.0.0.1:8081/api/documents/health',
    reuseExistingServer: false,
    timeout: 60000,
  },
});
