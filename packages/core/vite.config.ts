import { defineConfig } from "vite";
import { resolve } from "path";

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
			fileName: format => {
				switch (format) {
					case "es":
						return "index.mjs";
					case "umd":
						return "index.umd.cjs";
					default:
						return "index.js";
				}
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
