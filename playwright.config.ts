import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [["list"], ["html"], ["json", { outputFile: "test-results/test-results.json" }]],

	/* Shared settings for all tests */
	use: {
		baseURL: "http://localhost:3001",
		trace: "on",
		screenshot: "off",
		video: "off",
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
