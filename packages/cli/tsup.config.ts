import { defineConfig } from "tsup";

export default defineConfig({
  entry: { bin: "src/bin.ts" },
  format: ["cjs"],
  target: "node18",
  bundle: true,
  clean: true,
  outDir: "dist",
  shims: true,
  // Keep js-tiktoken external so rank assets resolve from node_modules at runtime
  external: [/^js-tiktoken/],
  banner: { js: "#!/usr/bin/env node" },
});
