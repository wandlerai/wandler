import { expect, test } from "@playwright/test";

interface ChatMessage {
  role: string;
  content: string;
  id: string;
  isComplete?: boolean;
  timestamp?: number;
  metadata?: {
    reasoning?: string;
  };
}

test.describe("useChat E2E", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the useChat demo page
    await page.goto("/use-chat.html");
  });

  test("loads model and sends messages", async ({ page }) => {
    // Check initial state - Load Model button should be visible
    await expect(page.getByText("Load Model")).toBeVisible();
    
    // Load the model
    await page.getByText("Load Model").click();
    
    // Wait for model to load (this may take some time)
    await expect(page.getByText("Status: ready")).toBeVisible({ timeout: 200000 });
    
    // Verify chat input is now visible
    await expect(page.locator(".message-input")).toBeVisible();
    
    // Type a message
    await page.locator(".message-input").fill("Hello, who are you?");
    
    // Send the message
    await page.getByText("Send").click();
    
    // Verify user message appears
    await expect(page.getByText("Hello, who are you?")).toBeVisible();
    
    // Wait for assistant to start responding
    await expect(page.getByText("Status: streaming")).toBeVisible();
    
    // Wait for response to complete (may take some time)
    await expect(page.getByText("Status: ready")).toBeVisible({ timeout: 200000 });
    
    // Verify we got a response from the assistant
    const assistantMessages = await page.locator(".message.assistant").count();
    expect(assistantMessages).toBeGreaterThan(0);
  });

  test("can stop message generation", async ({ page }) => {
    // Load the model
    await page.getByText("Load Model").click();
    
    // Wait for model to load
    await expect(page.getByText("Status: ready")).toBeVisible({ timeout: 200000 });
    
    // Type a message that will generate a longer response
    await page.locator(".message-input").fill("Write a detailed essay about artificial intelligence and its impact on society");
    
    // Send the message
    await page.getByText("Send").click();
    
    // Wait for streaming to start
    await expect(page.getByText("Status: streaming")).toBeVisible();
    
    // Wait a moment to let some text generate
    await page.waitForTimeout(2000);
    
    // Click the Stop button
    await page.getByText("Stop").click();
    
    // Verify streaming stops and status returns to ready
    await expect(page.getByText("Status: ready")).toBeVisible();
    
    // Verify we can send another message
    await page.locator(".message-input").fill("Hello again");
    await expect(page.locator(".message-input")).toBeEnabled();
  });

  test("can clear chat history", async ({ page }) => {
    // Load the model
    await page.getByText("Load Model").click();
    
    // Wait for model to load
    await expect(page.getByText("Status: ready")).toBeVisible({ timeout: 200000 });
    
    // Send a message
    await page.locator(".message-input").fill("Hello!?");
    await page.getByText("Send").click();
    
    // Wait for response
    await expect(page.getByText("Status: streaming")).toBeVisible();
    await expect(page.getByText("Status: ready")).toBeVisible({ timeout: 200000 });
    
    // Verify message exists
    await expect(page.getByText("Hello!?")).toBeVisible();
    
    // Clear the chat
    await page.getByText("Clear").click();
    
    // Verify messages are gone
    const messages = await page.locator(".message").count();
    expect(messages).toBe(0);
  });
});
