import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { isBreachedPassword, isWeakPassword } from "./password.js";

const sha1 = (s: string) => createHash("sha1").update(s).digest("hex").toUpperCase();
const reply = (body: string, status = 200) => vi.fn(async () => new Response(body, { status }));

describe("breached-password check (HIBP k-anonymity)", () => {
  const pw = "Correct-Horse-Battery-9";
  const hash = sha1(pw);

  it("sends only the 5-character hash prefix, never the password", async () => {
    const fetchFn = reply("");
    await isBreachedPassword(pw, fetchFn);
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
    expect(url).not.toContain(hash.slice(5));
    expect(JSON.stringify(init)).not.toContain(pw);
    expect((init.headers as Record<string, string>)["Add-Padding"]).toBe("true");
  });

  it("flags a password whose suffix is listed with a count", async () => {
    expect(await isBreachedPassword(pw, reply(`0000000000000000000000000000000000A:3\r\n${hash.slice(5)}:42\r\n`))).toBe(true);
  });

  it("ignores padding rows (count 0) and other suffixes", async () => {
    expect(await isBreachedPassword(pw, reply(`${hash.slice(5)}:0\r\nABCDEF0123456789ABCDEF0123456789ABC:9`))).toBe(false);
  });

  it("fails open when the service errors or times out", async () => {
    expect(await isBreachedPassword(pw, reply("oops", 503))).toBe(false);
    expect(await isBreachedPassword(pw, vi.fn(async () => { throw new DOMException("timed out", "TimeoutError"); }))).toBe(false);
  });

  it("isWeakPassword: common list wins without a network call; HIBP_CHECK=false skips the lookup", async () => {
    const fetchFn = reply("");
    expect(await isWeakPassword("Password1234", fetchFn)).toBe(true);
    expect(fetchFn).not.toHaveBeenCalled();
    expect(await isWeakPassword(pw)).toBe(false); // tests run with HIBP_CHECK=false
    expect(await isWeakPassword(pw, reply(`${hash.slice(5)}:7`))).toBe(true);
  });
});
