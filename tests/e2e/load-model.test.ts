import { expect, test } from "@playwright/test";

// No need to redeclare Window interface as it's already declared in types.ts

test.describe("loadModel E2E", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to page first
		await page.goto("/load-model.html");
	});

	test("loads model and shows capabilities", async ({ page }) => {
		// Verify initial state
		await expect(page.getByText("Ready to load model")).toBeVisible();

		// Click load button and wait for model to load
		await page.click("#load-btn");
		await expect(page.getByText("Loading model...")).toBeVisible();

		// Wait for model to finish loading and verify success
		await expect(page.getByText("Model loaded successfully!")).toBeVisible({ timeout: 120000 });

		// Verify test logs contain progress and loaded events
		const logs = await page.evaluate(() => window.testLogs);

		// Should have progress events
		expect(logs.some(log => log.type === "progress")).toBeTruthy();

		// Should have loaded event with capabilities
		const loadedEvent = logs.find(log => log.type === "loaded");
		expect(loadedEvent).toBeTruthy();
		expect(loadedEvent?.capabilities?.textGeneration).toBeTruthy();
	});

	test("handles invalid model paths", async ({ page }) => {
		// Test case 1: multi-part invalid path
		await page.fill("#model-id", "this/does/not/exist");
		await page.click("#load-btn");

		await expect(page.getByText("Loading model...")).toBeVisible();
		await expect(page.locator("#load-btn")).toBeDisabled();
		await expect(page.locator("#model-id")).toBeDisabled();

		await expect(
			page.getByText('The model "this/does/not/exist" does not exist on Hugging Face')
		).toBeVisible();
		await expect(page.locator(".status-icon")).toHaveClass(/status-error/);

		await expect(page.locator("#load-btn")).toBeEnabled();
		await expect(page.locator("#model-id")).toBeEnabled();

		// Test case 2: single-word invalid path
		await page.fill("#model-id", "doesnotexist");
		await page.click("#load-btn");

		await expect(page.getByText("Loading model...")).toBeVisible();
		await expect(page.locator("#load-btn")).toBeDisabled();
		await expect(page.locator("#model-id")).toBeDisabled();

		await expect(
			page.getByText('The model "doesnotexist" does not exist on Hugging Face')
		).toBeVisible();
		await expect(page.locator(".status-icon")).toHaveClass(/status-error/);

		await expect(page.locator("#load-btn")).toBeEnabled();
		await expect(page.locator("#model-id")).toBeEnabled();

		// Verify errors are logged
		const logs = await page.evaluate(() => window.testLogs);
		const errorLogs = logs.filter(log => log.type === "error");
		expect(errorLogs.length).toBe(2);
	});
});
