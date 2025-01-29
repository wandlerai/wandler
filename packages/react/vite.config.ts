import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
	build: {
		lib: {
			entry: resolve(__dirname, "index.ts"),
			name: "wandlerReact",
			fileName: "index",
			formats: ["es", "umd"],
		},
		outDir: resolve(__dirname, "dist"),
		sourcemap: true,
		rollupOptions: {
			external: ["react", "react-dom", "wandler"],
			output: {
				globals: {
					react: "React",
					"react-dom": "ReactDOM",
					wandler: "wandler",
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
