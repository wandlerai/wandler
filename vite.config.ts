import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	root: "tests/demo",
	base: "",
	server: {
		port: 5173,
	},
	resolve: {
		alias: {
			"@wandler": resolve(__dirname, "../../packages/wandler/index.ts"),
			"@wandler/*": resolve(__dirname, "../../packages/wandler/*"),
		},
	},
	build: {
		sourcemap: true,
		rollupOptions: {
			external: ["@huggingface/transformers"],
			output: {
				globals: {
					"@huggingface/transformers": "transformers",
				},
			},
		},
	},
	optimizeDeps: {
		include: ["@huggingface/transformers"],
	},
});
