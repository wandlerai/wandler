import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 1,
	workers: 2,
	reporter: [["list"], ["html"], ["json", { outputFile: "test-results/test-results.json" }]],

	/* Shared settings for all tests */
	use: {
		baseURL: "http://localhost:3001",
		trace: "on",
		screenshot: "on",
		video: "on",
		/* Open DevTools automatically in debug mode */
		launchOptions: {
			devtools: process.env.PWDEBUG ? true : false,
		},
	},

	/* Configure timeouts */
	timeout: 2 * 60 * 1000,
	expect: {
		timeout: 2 * 60 * 1000,
	},

	/* Configure projects for different browsers */
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],
});
