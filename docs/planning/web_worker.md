# Web Worker Support Planning

This document outlines the implementation plan for adding web worker support to Wandler.

## Overview

The goal is to move model loading and interaction into a web worker by default, while maintaining
the current simple API. Users can opt-out of worker usage if needed.

## 1. Core Concepts & Architecture

### Worker Strategy

- Default: Worker-based execution
- Opt-out flag: `useWorker: false` in ModelOptions
- Seamless API regardless of worker usage
- Same interface for both worker and non-worker modes
- Each `loadModel` call creates a new dedicated worker
- Benefits:
  - Clean isolation between model instances
  - No state sharing complications
  - Simpler error handling
  - Independent lifecycle management

### Communication Protocol

```typescript
// Worker Messages
type WorkerMessage = {
	type: "load" | "generate" | "stream" | "terminate";
	payload: {
		modelPath?: string;
		options?: ModelOptions;
		messages?: Message[];
		// ... other params
	};
	id: string; // For matching requests/responses
};

// Worker Responses
type WorkerResponse = {
	type: "loaded" | "generated" | "stream" | "error" | "progress";
	payload: any;
	id: string;
};

// Stream Result Interface
interface StreamResult<T> {
	textStream: ReadableStream<T>;
	response: Promise<string>;
	abort(): void; // Method to stop generation
}
```

## 2. File Structure

```
packages/core/
├── worker/
│   ├── worker.ts             # Main worker implementation
│   ├── bridge.ts             # Communication layer
│   └── types.ts              # Worker-specific types
├── utils/
│   ├── load.ts              # Update to handle worker creation
│   ├── generate.ts          # Update to proxy through worker
│   └── worker-manager.ts    # Worker lifecycle management
└── types/
    └── model.ts             # Add worker-related options
```

## 3. Implementation Details

### Worker Options

```typescript
// types/model.ts
interface ModelOptions {
	// ... existing options ...
	useWorker?: boolean; // Enable/disable worker (default: true)
	fallback?: boolean; // Allow main thread fallback
	workerOptions?: {
		terminateOnIdle?: boolean; // Cleanup worker when not in use
		timeout?: number; // Worker operation timeout
	};
}
```

### Worker Implementation

```typescript
// worker/worker.ts
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const { type, payload, id } = e.data;

	switch (type) {
		case "load":
			// Load model in worker context
			break;
		case "generate":
			// Handle text generation
			break;
		case "stream":
			// Handle streaming with TransferableStreams
			break;
		case "terminate":
			// Clean up resources
			break;
	}
};
```

### Worker Lifecycle Management

```typescript
// One worker per model instance
const worker = new Worker(new URL("./worker.ts", import.meta.url));
const model = await loadModel("model-path", { worker });

// Automatic cleanup
model.dispose(); // Terminates worker and frees resources

// Error handling
try {
	const model = await loadModel("model-path", {
		useWorker: true,
		fallback: true, // Allow main thread fallback
	});
} catch (e) {
	if (e.code === "WORKER_NOT_SUPPORTED") {
		// Handle gracefully
	}
}
```

### Stream Control

```typescript
const result = await streamText({
	model,
	messages: [...],
});

// Abort mechanism
const abortController = new AbortController();
result.abort = () => {
	abortController.abort();
	// Signal worker to stop generation
};
```

## 4. Technical Considerations

### Performance

- Use `TransferableStreams` for streaming responses
- Leverage browser's HTTP cache for model weights
- Benefits:
  - Subsequent model loads are fast (cached HTTP requests)
  - No memory duplication of weights
  - Standard browser caching behavior
- Performance metrics to track:
  - Model load time (worker vs main thread)
  - Memory usage per worker
  - Token generation speed
  - Worker communication overhead
  - Cache hit rates

### Error Handling

- Worker initialization failures
- Operation timeouts
- Model loading errors
- Worker termination handling
- Graceful fallback to non-worker mode

### Browser Support

```typescript
const canUseWorker = () => {
	return (
		typeof Worker !== "undefined" &&
		typeof ReadableStream !== "undefined" &&
		typeof MessageChannel !== "undefined"
	);
};
```

- Feature detection for Workers
- Module worker support check
- Graceful fallback to main thread execution
- Clear documentation of browser requirements
- Runtime warnings for missing features

## 5. API Design

### Loading a Model

```typescript
// Current API (remains unchanged)
const model = await loadModel("model-path", {
	useWorker: true, // default
	workerOptions: {
		shared: true,
		terminateOnIdle: true,
	},
});
```

### Streaming with Workers

```typescript
const result = await streamText({
  model,
  messages: [...],
  // Worker handled transparently
});

for await (const token of result) {
  console.log(token);
}
```

## 6. Implementation Phases

1. **Phase 1: Basic Worker Support**

   - Worker setup/teardown
   - Basic message passing
   - Model loading in worker
   - Simple text generation

2. **Phase 2: Streaming Support**

   - Implement TransferableStreams
   - Progress reporting
   - Error handling

3. **Phase 3: Advanced Features**

   - SharedArrayBuffer support
   - Worker pooling
   - Performance optimizations

4. **Phase 4: Testing & Documentation**
   - Worker-specific tests
   - Browser compatibility tests
   - Documentation updates
   - Example updates

## 7. Testing Strategy

### Unit Tests

- Worker message handling
- Error scenarios
- Option validation
- Worker lifecycle

### Integration Tests

- End-to-end worker flow
- Streaming with workers
- Performance benchmarks
- Memory usage tests

### Browser Tests

- Cross-browser compatibility
- Feature detection
- Fallback behavior

## 8. Migration & Backward Compatibility

- No breaking changes to existing API
- Automatic feature detection
- Graceful fallbacks
- Clear documentation for opting out
