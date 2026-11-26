/**
 * Create (or promote) the shop admin account from the terminal.
 *   npm run admin:create -- owner@yourshop.lk "Shop Owner"
 * You'll be asked for a password. After the first login, the admin must turn on
 * two-factor authentication (Account → Security) before the admin dashboard unlocks.
 */
import { createInterface } from "node:readline/promises";
import { eq } from "drizzle-orm";
import { passwordSchema } from "@seamwell/shared";
import { db, pool } from "../db/client.js";
import { users } from "../db/schema.js";
import { hashPassword } from "../lib/password.js";

const [email, name = "Shop Admin"] = process.argv.slice(2);
if (!email) {
  console.error('Usage: npm run admin:create -- owner@yourshop.lk "Shop Owner"');
  process.exit(1);
}

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question("Password (10+ chars, letters and a number): ");
rl.close();
const check = passwordSchema.safeParse(password);
if (!check.success) {
  console.error(check.error.issues.map((i) => i.message).join(", "));
  process.exit(1);
}

const lower = email.toLowerCase();
const existing = await db.query.users.findFirst({ where: eq(users.email, lower) });
if (existing) {
  await db.update(users).set({ role: "admin", passwordHash: await hashPassword(password) }).where(eq(users.id, existing.id));
  console.log(`✅ ${lower} is now an admin.`);
} else {
  await db.insert(users).values({ email: lower, name, role: "admin", passwordHash: await hashPassword(password) });
  console.log(`✅ Admin ${lower} created.`);
}
console.log("Next: sign in on the website and turn on two-factor authentication to unlock the admin dashboard.");
await pool.end();
