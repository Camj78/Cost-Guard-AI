import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // cli/ is the old CommonJS distribution artifact (root-level)
    "cli/**",
    // packages/cli dist output
    "packages/cli/dist/**",
  ]),
  // packages/core and packages/cli are pure Node.js TypeScript —
  // disable Next.js/React-specific rules that don't apply there.
  {
    files: ["packages/**/*.ts"],
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
      "react/display-name": "off",
      "react-hooks/rules-of-hooks": "off",
      "react-hooks/exhaustive-deps": "off",
      "import/no-anonymous-default-export": "off",
      // Recognize _prefixed parameters as intentionally unused (Node.js convention)
      "@typescript-eslint/no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    },
  },
]);

export default eslintConfig;
