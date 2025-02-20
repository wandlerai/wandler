import { expect, test } from "@playwright/test";

test.describe("streamText E2E", () => {
	test.beforeEach(async ({ page }) => {
		// Navigate to page first
		await page.goto("/stream-text.html");
	});

	test("streams text from prompt", async ({ page }) => {
		// Verify initial state
		await expect(page.getByText("Ready to stream")).toBeVisible();

		await page.fill("#prompt", "Explain what coding is in one sentence");

		// Click stream button and wait for model to load
		await page.click("#stream-btn");
		await expect(page.getByText("Loading model first...")).toBeVisible();

		// Wait for streaming to complete
		await expect(page.getByText("Stream complete!")).toBeVisible();

		// Verify output is visible
		await expect(page.locator("#output")).toBeVisible();

		// Verify logs contain expected events
		const logs = await page.evaluate(() => window.testLogs);
		expect(logs.some(log => log.type === "model_loaded")).toBeTruthy();
		expect(logs.some(log => log.type === "stream_started")).toBeTruthy();
		expect(logs.some(log => log.type === "stream_chunk")).toBeTruthy();
		expect(logs.some(log => log.type === "stream_complete")).toBeTruthy();

		// Get the final streamed result
		const streamLog = logs.find(log => log.type === "stream_complete");
		expect(streamLog?.result).toBeTruthy();
	});

	test("can abort streaming", async ({ page }) => {
		// Set a longer prompt to ensure we have time to abort
		await page.fill("#prompt", "Write a detailed essay about the history of computing.");
		await page.click("#stream-btn");

		// Wait for model loading to start
		await expect(page.getByText("Loading model first...")).toBeVisible();

		// Wait for streaming to start
		await expect(page.getByText("Streaming text...")).toBeVisible();

		// Wait for abort button to be visible and click it
		await expect(page.locator("#abort-btn")).toBeVisible();
		await page.click("#abort-btn");

		// Wait for abort status to be shown
		await expect(page.getByText("Stream aborted")).toBeVisible();

		// Verify abort button is hidden
		await expect(page.locator("#abort-btn")).toBeHidden();

		// Verify UI is re-enabled
		await expect(page.locator("#stream-btn")).toBeEnabled();
		await expect(page.locator("#prompt")).toBeEnabled();

		// Now that we know the abort handling is complete, verify the logs
		const logs = await page.evaluate(() => window.testLogs);
		expect(logs.some(log => log.type === "stream_aborted")).toBeTruthy();

		// Should be able to start a new stream
		await page.click("#stream-btn");
		await expect(page.getByText("Streaming text...")).toBeVisible();
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
		await expect(page.getByText("Ready to stream")).toBeVisible();

		// Click stream button and wait for model to load
		await page.click("#stream-btn");
		await expect(page.getByText("Loading model first...")).toBeVisible();

		// Wait for error message about dtype
		await expect(page.getByText("Stream failed:", { exact: false })).toBeVisible();

		// Verify error is logged
		const logs = await page.evaluate(() => window.testLogs);
		const errorLog = logs.find(log => log.type === "error");
		expect(errorLog).toBeTruthy();
		expect(errorLog?.error).toContain("Model execution failed");
	});
});
