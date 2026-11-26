import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  platform: "node",
  sourcemap: true,
  clean: true,
  // Bundle the workspace package; keep real npm deps external (native modules like argon2 must not be bundled).
  noExternal: ["@seamwell/shared"],
});
