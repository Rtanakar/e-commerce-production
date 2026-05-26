// eslint.config.mjs
// flat config - ESLint 9+ ka naya format
// purana .eslintrc.js deprecated hai, flat config future-proof hai

import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["dist/**", "node_modules/**", "coverage/**", "src/db/generated/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
    },
    rules: {
      // unused vars - underscore prefix se allowed
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // explicit any allow karte hai sometimes - third-party libs
      "@typescript-eslint/no-explicit-any": "warn",
      // console.log warn - production me logger use karo
      "no-console": ["warn", { allow: ["warn", "error"] }],
      // empty functions ok - placeholder patterns
      "@typescript-eslint/no-empty-function": "off",
    },
  },
];
