import { expect, test } from "@playwright/test";

import type { ModelCapabilities, ProgressInfo } from "@wandler/types/model";

// Extend window interface for our test API
declare global {
	interface Window {
		testAPI: {
			loadModel: (model: string, options?: any) => Promise<any>;
			generateText: (options: any) => Promise<string>;
			streamText: (options: any) => Promise<any>;
		};
		testLogs: Array<{
			timestamp: number;
			type: string;
			info?: ProgressInfo;
			capabilities?: ModelCapabilities;
			error?: string;
		}>;
		logTestEvent: (event: any) => void;
	}
}

// Cache model between tests for performance
let loadedModel = null;

test.describe("loadModel E2E", () => {
	test("loads model and shows capabilities", async ({ page }) => {
		console.log("Starting test...");

		// Try direct URL first
		console.log("Checking if server is accessible...");
		const checkResponse = await page.goto("http://localhost:3001");
		console.log("Server check response:", checkResponse?.status());
		console.log("Server root content:", await page.content());

		// Go to the load-model demo page with full URL
		console.log("Navigating to load-model.html");
		const response = await page.goto("http://localhost:3001/load-model.html");
		console.log("Navigation response status:", response?.status());
		console.log("Final URL:", page.url());
		console.log("Page content:", await page.content());

		// Verify initial state
		console.log("Checking initial state...");
		await expect(page.getByText("Ready to load model")).toBeVisible();
		await expect(page.locator("#model-info")).toBeHidden();

		// Click load button and wait for model to load
		await page.click("#load-btn");
		await expect(page.getByText("Loading model...")).toBeVisible();

		// Wait for model to finish loading and verify success
		await expect(page.getByText("Model loaded successfully!")).toBeVisible({ timeout: 120000 });
		await expect(page.locator("#model-info")).toBeVisible();

		// Verify test logs contain progress and loaded events
		const logs = await page.evaluate(() => window.testLogs);

		// Should have progress events
		expect(logs.some(log => log.type === "progress")).toBeTruthy();

		// Should have loaded event with capabilities
		const loadedEvent = logs.find(log => log.type === "loaded");
		expect(loadedEvent).toBeTruthy();
		expect(loadedEvent?.capabilities?.textGeneration).toBeTruthy();
	});

	test("shows loading progress", async ({ page }) => {
		await page.goto("/load-model.html");

		// Start loading and track status text changes
		const statusElement = page.locator("#status");
		const progressTexts: string[] = [];
		await statusElement.evaluate(element => {
			const observer = new MutationObserver(mutations => {
				mutations.forEach(mutation => {
					if (mutation.type === "characterData") {
						progressTexts.push(mutation.target.textContent || "");
					}
				});
			});
			observer.observe(element, { characterData: true, subtree: true });
		});

		await page.click("#load-btn");

		// Wait for loading to complete
		await expect(page.getByText("Model loaded successfully!")).toBeVisible({ timeout: 30000 });

		// Verify we got progress updates
		const logs = await page.evaluate(() => window.testLogs);
		const progressEvents = logs.filter(log => log.type === "progress");
		expect(progressEvents.length).toBeGreaterThan(0);

		// Verify progress events have expected structure
		progressEvents.forEach(event => {
			expect(event.info).toHaveProperty("status");
		});
	});

	test("handles loading errors gracefully", async ({ page }) => {
		await page.goto("/load-model.html");

		// Inject a function that will throw an error
		await page.evaluate(() => {
			window.testAPI.loadModel = async () => {
				throw new Error("Test error");
			};
		});

		await page.click("#load-btn");

		// Verify error is displayed
		await expect(page.getByText("Error loading model: Test error")).toBeVisible();
		await expect(page.getByText("Failed to load model")).toBeVisible();

		// Verify error is logged
		const logs = await page.evaluate(() => window.testLogs);
		expect(logs.some(log => log.type === "error" && log.error === "Test error")).toBeTruthy();

		// Verify button is re-enabled
		await expect(page.locator("#load-btn")).toBeEnabled();
	});
});
