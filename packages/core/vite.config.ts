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
			fileName: "index",
		},
		outDir: resolve(__dirname, "dist"),
	},
	resolve: {
		alias: {
			"@wandler": resolve(__dirname, ".")
		}
	}
});
