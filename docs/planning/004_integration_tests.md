# End-to-End Browser Testing Plan for Wandler

## Overview

This document outlines the E2E testing strategy for Wandler's main user-facing features in a real
browser environment:

- `loadModel`
- `generateText`
- `streamText`

The focus is on testing the complete integration with transformers.js in conditions that match real
user scenarios.

## Test Environment Setup

1. **Test Framework**

- Playwright for browser automation
- Jest as the test runner
- Real transformers.js package (no mocks)
- Actual model files for testing

2. **Test Directory Structure**

```
tests/
├── e2e/                      # End-to-end test directory
│   ├── load-model.test.ts   # Model loading tests
│   ├── generate-text.test.ts # Text generation tests
│   └── stream-text.test.ts  # Streaming tests
└── test-app/                # Test application
    ├── index.html           # Test page
    └── test-setup.ts        # Browser setup code
```

## Test Application Setup

```typescript
// test-app/test-setup.ts
import { loadModel, generateText, streamText } from "wandler";

// Expose test functions to browser context
window.testAPI = {
	loadModel,
	generateText,
	streamText,
};

// Add logging for test visibility
window.testLogs = [];
window.logTestEvent = event => {
	window.testLogs.push({
		timestamp: Date.now(),
		...event,
	});
};
```

```html
<!-- test-app/index.html -->
<!DOCTYPE html>
<html>
	<head>
		<title>Wandler E2E Tests</title>
	</head>
	<body>
		<div id="test-output"></div>
		<script type="module" src="./test-setup.ts"></script>
	</body>
</html>
```

## Core Test Cases

### 1. Model Loading (`load-model.test.ts`)

```typescript
import { test, expect } from "@playwright/test";

// Cache model between tests for performance
let loadedModel = null;

test.describe("loadModel E2E", () => {
	test("loads model in browser", async ({ page }) => {
		await page.goto("/test-app/");

		const modelLoaded = await page.evaluate(async () => {
			const model = await window.testAPI.loadModel("onnx-community/Phi-3.5-mini-instruct-onnx-web");
			return model.capabilities;
		});

		expect(modelLoaded.textGeneration).toBeTruthy();
	});

	test("shows loading progress", async ({ page }) => {
		await page.goto("/test-app/");

		const logs = await page.evaluate(async () => {
			const model = await window.testAPI.loadModel(
				"onnx-community/Phi-3.5-mini-instruct-onnx-web",
				{
					onProgress: info => window.logTestEvent({ type: "progress", info }),
				}
			);
			return window.testLogs;
		});

		expect(logs).toContainEqual(
			expect.objectContaining({
				type: "progress",
				info: expect.objectContaining({ status: "progress" }),
			})
		);
	});
});
```

### 2. Text Generation (`generate-text.test.ts`)

```typescript
test.describe("generateText E2E", () => {
	test("generates text in browser", async ({ page }) => {
		await page.goto("/test-app/");

		const result = await page.evaluate(async () => {
			const model = await window.testAPI.loadModel("onnx-community/Phi-3.5-mini-instruct-onnx-web");
			return window.testAPI.generateText({
				model,
				messages: [{ role: "user", content: "What is 2+2? Answer in one word." }],
			});
		});

		expect(result.trim().toLowerCase()).toBe("four");
	});

	test("respects generation parameters", async ({ page }) => {
		await page.goto("/test-app/");

		const result = await page.evaluate(async () => {
			const model = await window.testAPI.loadModel("onnx-community/Phi-3.5-mini-instruct-onnx-web");
			return window.testAPI.generateText({
				model,
				messages: [{ role: "user", content: "Write a story about a cat" }],
				max_new_tokens: 5,
			});
		});

		// Count tokens in response
		expect(result.split(/\s+/).length).toBeLessThanOrEqual(5);
	});
});
```

### 3. Text Streaming (`stream-text.test.ts`)

```typescript
test.describe("streamText E2E", () => {
	test("streams text in browser", async ({ page }) => {
		await page.goto("/test-app/");

		const chunks = await page.evaluate(async () => {
			const model = await window.testAPI.loadModel("onnx-community/Phi-3.5-mini-instruct-onnx-web");
			const chunks = [];

			const { stream } = await window.testAPI.streamText({
				model,
				messages: [{ role: "user", content: "Count from 1 to 5" }],
			});

			for await (const chunk of stream) {
				chunks.push(chunk);
				window.logTestEvent({ type: "chunk", content: chunk });
			}

			return chunks;
		});

		expect(chunks.length).toBeGreaterThan(0);
		const fullText = chunks.join("");
		expect(fullText).toMatch(/1.*2.*3.*4.*5/);
	});

	test("handles stream termination", async ({ page }) => {
		await page.goto("/test-app/");

		const result = await page.evaluate(async () => {
			const model = await window.testAPI.loadModel("onnx-community/Phi-3.5-mini-instruct-onnx-web");
			const { stream } = await window.testAPI.streamText({
				model,
				messages: [{ role: "user", content: "Write a long story" }],
			});

			// Terminate after first chunk
			let firstChunk;
			for await (const chunk of stream) {
				firstChunk = chunk;
				break;
			}

			return { terminated: true, firstChunk };
		});

		expect(result.terminated).toBe(true);
		expect(result.firstChunk).toBeTruthy();
	});
});
```

## Notes

- Tests run in real browser environment
- No mocking of transformers.js
- Focus on real-world scenarios
