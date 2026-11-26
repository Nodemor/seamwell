import { adminPathOrDefault, isAdminSegment, isValidAdminPath } from "@seamwell/shared";
import { describe, expect, it } from "vitest";

const SECRET = "k7Qm2-x9TfLpW4zR";

describe("hidden admin address", () => {
  it("only accepts long, random-looking values", () => {
    expect(isValidAdminPath(SECRET)).toBe(true);
    expect(isValidAdminPath("a1b2c3d4e5f6a7b8c9d0e1f2")).toBe(true); // openssl rand -hex 12
    for (const bad of ["", "admin", "short-1234", "admin-panel-2026-xyz", "Dashboard_secret_99", "has space in it 123", "../../etc/passwd/xx", "slash/inside/path/12"]) {
      expect(isValidAdminPath(bad), bad).toBe(false);
    }
  });

  it("falls back to /admin when unset or invalid (dev)", () => {
    expect(adminPathOrDefault(undefined)).toBe("admin");
    expect(adminPathOrDefault("weak")).toBe("admin");
    expect(adminPathOrDefault(` /${SECRET}/ `)).toBe(SECRET);
    expect(isAdminSegment("admin", undefined)).toBe(true);
  });

  it("with a secret set, /admin and every other guess is a 404", () => {
    for (const guess of ["admin", "ADMIN", "Admin", "%61dmin", "administrator", "dashboard", "", SECRET.slice(0, -1), SECRET.toLowerCase(), `${SECRET}x`, "%E0%A4%A"]) {
      expect(isAdminSegment(guess, SECRET), guess).toBe(false);
    }
  });

  it("only the exact secret opens the admin area", () => {
    expect(isAdminSegment(SECRET, SECRET)).toBe(true);
    expect(isAdminSegment(encodeURIComponent(SECRET), SECRET)).toBe(true);
  });
});
