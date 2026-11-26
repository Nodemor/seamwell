import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    env: {
      NODE_ENV: "test",
      DATABASE_URL: "postgres://test:test@127.0.0.1:5432/test",
      JWT_ACCESS_SECRET: "test_access_secret_test_access_secret_123456",
      JWT_MFA_SECRET: "test_mfa_secret_test_mfa_secret_test_mfa_1234",
      DATA_ENCRYPTION_KEY: "0000000000000000000000000000000000000000000000000000000000000000",
      WEB_ORIGIN: "http://localhost:3000",
      HIBP_CHECK: "false",
    },
  },
});
