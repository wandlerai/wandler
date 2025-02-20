import { expect, test } from "@playwright/test";

// No need to redeclare Window interface as it's already declared in types.ts

test.describe("generateText E2E", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to page first
		await page.goto("/generate-text.html");
	});

	test("generates text from prompt", async ({ page }) => {
		// Verify initial state
		await expect(page.getByText("Ready to generate")).toBeVisible();

		// Click generate button and wait for model to load
		await page.click("#generate-btn");
		await expect(page.getByText("Loading model first...")).toBeVisible();

		// Wait for generation to complete
		await expect(page.getByText("Generation complete!")).toBeVisible({ timeout: 120000 });

		// Verify output is visible
		await expect(page.locator("#output")).toBeVisible();

		// Verify logs contain expected events
		const logs = await page.evaluate(() => window.testLogs);
		expect(logs.some(log => log.type === "model_loaded")).toBeTruthy();
		expect(logs.some(log => log.type === "generation_started")).toBeTruthy();
		expect(logs.some(log => log.type === "generation_complete")).toBeTruthy();

		// Get the generation result
		const generationLog = logs.find(log => log.type === "generation_complete");
		expect(generationLog?.result).toBeTruthy();
	});

	test("fails with incorrect dtype", async ({ page }) => {
		// Override loadModel to force q4f16 dtype
		await page.evaluate(() => {
			const originalLoadModel = window.testAPI.loadModel;
			window.testAPI.loadModel = async (model: string, options: any = {}) => {
				window.logTestEvent({
					type: "override_called",
					model,
					options: { ...options, dtype: "q4f16" },
				});
				return originalLoadModel(model, { ...options, dtype: "q4f16" });
			};
		});

		// Verify initial state
		await expect(page.getByText("Ready to generate")).toBeVisible();

		// Click generate button and wait for model to load
		await page.click("#generate-btn");
		await expect(page.getByText("Loading model first...")).toBeVisible();

		// Wait for error message about dtype
		await expect(page.getByText("Generation failed:", { exact: false })).toBeVisible({
			timeout: 120000,
		});

		// Verify error is logged
		const logs = await page.evaluate(() => window.testLogs);
		const errorLog = logs.find(log => log.type === "error");
		expect(errorLog).toBeTruthy();
		expect(errorLog?.error).toContain("Model execution failed");
	});
});
