import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/cli.ts"],
  format: ["esm"],
  outExtension: () => ({ js: ".mjs" }),
  clean: true,
  sourcemap: true,
  dts: true,
  shims: false,
});
