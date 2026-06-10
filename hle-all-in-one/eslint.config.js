//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config"

export default [
  ...tanstackConfig,
  {
    rules: {
      "import/no-cycle": "off",
      "import/order": "off",
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      // Misfires on defensive null-handling of array index access and external
      // (DB) rows: tsconfig doesn't enable noUncheckedIndexedAccess, so the
      // rule treats `arr[0]` as always-defined and flags correct runtime
      // guards as "unnecessary". The guards are intentional.
      "@typescript-eslint/no-unnecessary-condition": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },
  {
    ignores: [
      "eslint.config.js",
      ".prettierrc",
      // Build output and generated files — never linted.
      ".output/**",
      "dist/**",
      "dist-ssr/**",
      "src/routeTree.gen.ts",
    ],
  },
]
