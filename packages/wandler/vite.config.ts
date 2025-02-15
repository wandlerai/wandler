import { resolve } from "path";
import { defineConfig } from "vite";

export default defineConfig({
	root: "../../tests/demo",
	server: {
		open: "chat.html",
		host: "127.0.0.1",
		port: 3001,
	},
	build: {
		lib: {
			entry: {
				index: resolve(__dirname, "index.ts"),
				"worker/worker": resolve(__dirname, "worker/worker.ts"),
			},
			formats: ["es", "umd"],
			fileName: (format, entryName) => {
				const ext = format === "es" ? "mjs" : format === "umd" ? "umd.cjs" : "js";
				return `${entryName}.${ext}`;
			},
		},
		outDir: resolve(__dirname, "dist"),
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
