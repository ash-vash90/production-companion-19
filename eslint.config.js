import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      // Block font-mono and font-data classes - use DataText/CodeText components instead
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/font-mono/]",
          message: "Do not use 'font-mono'. Use the DataText or CodeText component, or 'tabular-nums font-semibold tracking-wide' classes instead."
        },
        {
          selector: "TemplateElement[value.raw=/font-mono/]",
          message: "Do not use 'font-mono'. Use the DataText or CodeText component, or 'tabular-nums font-semibold tracking-wide' classes instead."
        },
        {
          selector: "Literal[value=/font-data/]",
          message: "Do not use 'font-data'. Use the DataText or CodeText component instead."
        },
        {
          selector: "TemplateElement[value.raw=/font-data/]",
          message: "Do not use 'font-data'. Use the DataText or CodeText component instead."
        }
      ],
    },
  },
);
