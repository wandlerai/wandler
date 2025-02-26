import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	build: {
		lib: {
			entry: {
				worker: resolve(__dirname, "worker/worker.ts"),
			},
			formats: ["es"],
			fileName: (_, entryName) => `${entryName}.js`,
		},
		outDir: resolve(__dirname, "dist/assets"),
		emptyOutDir: false,
		sourcemap: false,
		rollupOptions: {
			external: ["@huggingface/transformers"],
			output: {
				globals: {
					"@huggingface/transformers": "transformers",
				},
				format: "es",
			},
		},
		minify: false,
	},
	resolve: {
		alias: {
			"@wandler": resolve(__dirname, "."),
		},
	},
});
