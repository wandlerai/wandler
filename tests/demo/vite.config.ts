import path from "path";
import { defineConfig } from "vite";

export default defineConfig({
	resolve: {
		alias: {
			"@wandler": path.resolve(__dirname, "../../packages"),
		},
	},
	optimizeDeps: {
		exclude: ["@wandler/react"],
	},
});
