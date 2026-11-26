import { beforeEach, describe, expect, it, vi } from "vitest";

const log = vi.hoisted(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
const env = vi.hoisted(() => ({ NODE_ENV: "production", SMTP_URL: undefined as string | undefined, MAIL_FROM: "Shop <shop@example.com>" }));
vi.mock("./logger.js", () => ({ logger: log }));
vi.mock("../config/env.js", () => ({ env }));

const { sendMail } = await import("./mailer.js");

describe("mailer without SMTP", () => {
  beforeEach(() => vi.clearAllMocks());

  it("production: never writes the email (reset links, addresses) or the recipient to the logs", async () => {
    env.NODE_ENV = "production";
    await sendMail("kasun@example.com", "Reset your password", "Open https://shop.lk/reset-password?token=SECRET123 — 12 Galle Road");
    const logged = JSON.stringify([...log.info.mock.calls, ...log.warn.mock.calls]);
    expect(logged).not.toContain("SECRET123");
    expect(logged).not.toContain("Galle Road");
    expect(logged).not.toContain("kasun@example.com");
    expect(log.warn).toHaveBeenCalledWith({ subject: "Reset your password" }, expect.stringContaining("SMTP_URL"));
  });

  it("development: prints the email so it can be read in the console", async () => {
    env.NODE_ENV = "development";
    await sendMail("kasun@example.com", "Hello", "Body text");
    expect(log.info.mock.calls[0]?.[1]).toContain("Body text");
  });
});
