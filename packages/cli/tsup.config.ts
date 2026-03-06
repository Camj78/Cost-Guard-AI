import { defineConfig } from "tsup";

export default defineConfig({
  entry: { bin: "src/bin.ts" },
  format: ["cjs"],
  target: "node18",
  bundle: true,
  clean: true,
  outDir: "dist",
  shims: true,
  // Keep js-tiktoken external so its WASM assets resolve from node_modules
  external: ["js-tiktoken"],
  banner: { js: "#!/usr/bin/env node" },
  // Bundle @costguard/core inline (workspace package — esbuild would otherwise keep it external)
  noExternal: ["@costguard/core"],
});
