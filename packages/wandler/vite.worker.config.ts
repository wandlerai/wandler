import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, "worker/worker.ts"),
			formats: ["es"],
			fileName: () => "worker.js",
		},
		outDir: resolve(__dirname, "dist/worker"),
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
	resolve: {
		alias: {
			"@wandler": resolve(__dirname, "."),
		},
	},
});
