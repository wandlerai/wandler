# Worker Implementation Improvements

## User Story

**As a** developer using the Wandler library  
**I want** a more robust, type-safe, and consistent worker implementation  
**So that** I can rely on the worker for text generation without encountering unexpected errors or
inconsistencies

## Background

The current worker implementation in Wandler has several areas that could be improved to better
align with the codebase conventions and ensure more consistent behavior between worker and main
thread implementations. These improvements will enhance type safety, error handling, and overall
code quality.

## Requirements

### 1. Improve Type Safety

- Replace `any` types with specific interfaces from the types directory
- Use type guards consistently for runtime type checking
- Ensure all worker message payloads have proper type definitions

**Example:**

```typescript
// Current implementation
async function loadModel(modelPath: string, options: any = {}) {
	// ...
}

// Improved implementation
async function loadModel(modelPath: string, options: ModelLoadOptions = {}) {
	// ...
}
```

### 2. Standardize Error Handling

- Preserve original error objects and stack traces when sending errors from the worker
- Use a consistent error format across all error handling code
- Ensure errors are properly serialized for worker communication

**Example:**

```typescript
// Current implementation
sendResponse({
	type: "error",
	payload: new Error(error.message), // Loses original stack trace
	id,
});

// Improved implementation
sendResponse({
	type: "error",
	payload: {
		message: error.message,
		name: error.name,
		stack: error.stack,
		code: error.code,
	},
	id,
});
```

### 3. Centralize Stream Processing Logic

- Move the think block handling logic from `handleStreamText` to the transformers layer
- Use a common streaming implementation between worker and main thread
- Ensure consistent handling of streaming events

### 4. Use Consistent Configuration Preparation

- Use `prepareGenerationConfig` in the worker message handler to ensure consistent defaults
- Apply the same validation in the worker as in the API layer

**Example:**

```typescript
// Current implementation
const result = await handleGenerateText(payload.messages, {
	max_new_tokens: payload.max_new_tokens,
	do_sample: payload.do_sample,
	temperature: payload.temperature,
	top_p: payload.top_p,
	repetition_penalty: payload.repetition_penalty,
});

// Improved implementation
const messages = prepareMessages({ messages: payload.messages });
validateMessages(messages);
const config = prepareGenerationConfig(payload);
validateGenerationConfig(config);
const result = await handleGenerateText(messages, config);
```

### 5. Improve Abort Handling

- Implement consistent abort handling throughout the worker implementation
- Check the abort signal at key points during generation
- Ensure proper cleanup when generation is aborted

### 6. Consistent Capability Checking

- Apply the same capability checks consistently across all worker message types
- Validate model capabilities before attempting operations

**Example:**

```typescript
// Add to generate case
if (!model.capabilities?.textGeneration) {
	throw new Error("Model does not support text generation");
}
```

### 7. Refactor Worker Message Handling

- Consider using a more declarative approach to message handling with a map of handlers
- This would make it easier to add new message types in the future

**Example:**

```typescript
const messageHandlers = {
	load: async (payload, id) => {
		// Handle load message
	},
	generate: async (payload, id) => {
		// Handle generate message
	},
	stream: async (payload, id) => {
		// Handle stream message
	},
	terminate: async (payload, id) => {
		// Handle terminate message
	},
};

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const { type, payload, id } = e.data;
	try {
		const handler = messageHandlers[type];
		if (!handler) {
			throw new Error(`Unknown message type: ${type}`);
		}
		await handler(payload, id);
	} catch (error) {
		// Handle error
	}
};
```

## Acceptance Criteria

1. All `any` types in the worker implementation are replaced with specific types
2. Error handling preserves original error information including stack traces
3. Stream processing logic is centralized in the transformers layer
4. Configuration preparation and validation is consistent between worker and API layer
5. Abort handling is implemented consistently throughout the worker
6. Capability checks are applied consistently across all message types
7. Worker message handling is refactored to be more declarative and maintainable
8. All changes maintain backward compatibility with existing API
9. Unit tests are updated or added to verify the improvements

## Technical Notes

- These changes should be implemented incrementally to minimize risk
- Focus on maintaining backward compatibility with existing API
- Consider adding more comprehensive logging for debugging worker issues
- Ensure all changes align with the codebase conventions

## Related Documents

- [Wandler Codebase Conventions](../../docs/conventions.md)
