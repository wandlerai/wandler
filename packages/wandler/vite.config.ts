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
			entry: resolve(__dirname, "index.ts"),
			name: "wandler",
			formats: ["es", "umd"],
			fileName: format => `index.${format === "es" ? "js" : "umd.cjs"}`,
		},
		outDir: resolve(__dirname, "dist"),
		emptyOutDir: true,
		sourcemap: false,
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
	worker: {
		format: "es", // Use ES modules for workers
	},
});
