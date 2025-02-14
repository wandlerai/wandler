import eslint from "@eslint/js";
import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import unusedImports from "eslint-plugin-unused-imports";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import importPlugin from "eslint-plugin-import";
import prettier from "eslint-plugin-prettier";

export default [
	{
		files: ["**/*.{js,jsx,ts,tsx}"],
		plugins: {
			"@typescript-eslint": tseslint,
			"unused-imports": unusedImports,
			"simple-import-sort": simpleImportSort,
			import: importPlugin,
			prettier: prettier,
		},
		languageOptions: {
			parser: tsparser,
			parserOptions: {
				ecmaVersion: "latest",
				sourceType: "module",
			},
		},
		rules: {
			"react/no-unescaped-entities": "off",
			"no-unused-vars": "off",
			"@typescript-eslint/no-unused-vars": "off",
			"unused-imports/no-unused-imports": "error",
			"unused-imports/no-unused-vars": [
				"warn",
				{
					vars: "all",
					varsIgnorePattern: "^_",
					args: "after-used",
					argsIgnorePattern: "^_",
				},
			],
			"simple-import-sort/imports": [
				"error",
				{
					groups: [
						// External packages
						["^@?\\w"],
						// Internal packages (@wandler/*)
						["^@wandler"],
						// Relative imports
						["^\\."],
						// Side effect imports
						["^\\u0000"],
					],
				},
			],
			"simple-import-sort/exports": "error",
			"import/first": "error",
			"import/newline-after-import": "error",
			"import/no-duplicates": "error",
			"import/no-relative-parent-imports": "error",
			"import/no-relative-packages": "error",
			"import/no-internal-modules": [
				"error",
				{
					allow: ["@wandler/*"],
				},
			],
		},
	},
];
