# Wandler Codebase Conventions

## Core Architecture

1. **Three-Layer Architecture**

   - User-Facing API Layer (`generate-text.ts`, `stream-text.ts`)
   - Worker Communication Layer (`worker.ts`)
   - Core Transformer.js Layer (`transformers.ts`)

2. **Module Organization**
   ```
   packages/core/
   ├── types/         # Core type definitions
   ├── utils/         # Shared utilities and core functions
   ├── worker/        # Worker-related code
   └── providers/     # Model provider implementations
   ```

## Code Style & Patterns

1. **TypeScript Best Practices**

   - Use explicit types, avoid `any` where possible
   - Prefer interfaces over types for object definitions
   - Use type guards for runtime type checking
   - Export types from dedicated type files

2. **Function Organization**

   ```typescript
   // Public API
   export async function mainFunction() {}

   // Internal helpers (prefixed with _)
   async function _internalHelper() {}
   ```

3. **Error Handling**
   - Always propagate errors with proper context
   - Use typed error objects
   - Include error handling in worker communication
   ```typescript
   try {
   	// operation
   } catch (error: any) {
   	throw new Error(`Context: ${error.message}`);
   }
   ```

## Core Concepts

1. **Text Generation**

   - Two main methods: `generateText` (single response) and `streamText` (streaming)
   - Both support worker and main thread execution
   - Configuration through `GenerationConfig` interface

2. **Worker Communication**

   - Workers handle heavy computation
   - Use `sendResponse` for worker messages
   - Always include message type and ID

   ```typescript
   sendResponse({
   	type: "stream",
   	payload: data,
   	id: messageId,
   });
   ```

3. **Model Management**
   - Models are loaded through providers
   - Check model capabilities before operations
   - Handle model loading progress

## Generation Options

1. **Common Parameters**

   ```typescript
   interface GenerationOptions {
   	max_new_tokens?: number; // Default: 1024
   	temperature?: number; // Default: 1.0
   	top_p?: number; // Default: 1.0
   	do_sample?: boolean; // Based on temp/top_p
   	repetition_penalty?: number; // Default: 1.1
   }
   ```

2. **Message Format**
   ```typescript
   interface Message {
   	role: "system" | "user" | "assistant";
   	content: string | MessageContent[];
   }
   ```

## Best Practices

1. **Generation**

   - Always validate model capabilities
   - Use proper message preparation
   - Handle streaming completion correctly

   ```typescript
   if (!model.capabilities?.textGeneration) {
   	throw new Error("Model doesn't support text generation");
   }
   ```

2. **Worker Usage**

   - Send completion messages for streams
   - Handle worker lifecycle properly
   - Include proper error handling

3. **Performance**
   - Use KV cache when available
   - Respect model performance settings
   - Handle resource cleanup

## Common Patterns

1. **Message Preparation**

   ```typescript
   const messages = prepareMessages(options);
   validateMessages(messages);
   const config = prepareGenerationConfig(options);
   ```

2. **Stream Handling**

   ```typescript
   streamCallback: (token: string) => {
   	sendResponse({
   		type: "stream",
   		payload: token,
   		id: "stream",
   	});
   };
   ```

3. **Error Propagation**
   ```typescript
   catch (error: any) {
     sendResponse({
       type: "error",
       payload: {
         message: error.message,
         stack: error.stack
       },
       id: messageId
     });
     throw error;
   }
   ```

## Documentation

1. **Code Comments**

   - Document public APIs with JSDoc
   - Include examples in documentation
   - Explain complex logic

2. **Type Documentation**

   - Document interfaces and types
   - Include parameter descriptions
   - Note default values

3. **Error Messages**
   - Be specific about what went wrong
   - Include context in error messages
   - Log errors appropriately

## Examples

### Basic Text Generation

```typescript
const result = await generateText({
	model,
	messages: [{ role: "user", content: "Hello" }],
});
```

### Streaming with Worker

```typescript
const { stream } = await streamText({
	model,
	messages: [{ role: "user", content: "Tell me a story" }],
	temperature: 0.7,
});

for await (const chunk of stream) {
	console.log(chunk);
}
```

### Model Loading with Progress

```typescript
const model = await loadModel("model-path", {
	onProgress: info => {
		if (info.status === "progress") {
			console.log(`Loading: ${info.loaded}/${info.total} bytes`);
		}
	},
});
```

## Key Learnings from Refactoring

1. **Stream Completion Handling**

   - Always send a completion message after streaming ends
   - Don't send multiple completion signals (can cause "stream already closed" errors)

   ```typescript
   // In worker.ts - stream case
   await handleStreamText(messages, options);
   sendResponse({ type: "generated", payload: null, id }); // Single completion signal
   ```

2. **Centralized Generation Logic**

   - Keep all transformers.js interaction in `generateWithTransformers`
   - Don't duplicate streaming setup between worker and non-worker code
   - Pass callbacks instead of creating streamers in multiple places

   ```typescript
   // Good: Pass callback to core function
   await generateWithTransformers(model, {
     messages,
     streamCallback: (token) => sendResponse({...})
   });

   // Bad: Create streamer outside core function
   const streamer = new TextStreamer(...);
   await generateWithTransformers(model, { messages, streamer });
   ```

3. **Worker Message Flow**

   - Worker messages should follow a clear lifecycle:
     1. Initial request with unique ID
     2. Stream messages (if streaming)
     3. Single completion message
     4. Error message (if failed)
   - Never mix message types or send redundant messages

4. **KV Cache Management**

   - KV cache is managed at the transformers layer
   - Don't try to handle it in worker or API layers
   - Reset cache on errors or when switching conversations

   ```typescript
   if (model.performance.supportsKVCache) {
   	past_key_values_cache = output.past_key_values;
   }
   ```

5. **Generation Config Preparation**

   - Always use `prepareGenerationConfig` to ensure consistent defaults
   - Don't pass raw options directly to transformers.js
   - Be aware that some options are streaming-specific

   ```typescript
   // Streaming-specific options
   tools?: ToolSet;
   toolChoice?: "auto" | "none" | "required";
   maxSteps?: number;
   ```

6. **Error Handling Gotchas**

   - Worker errors must be serializable
   - Include both message and stack trace for debugging
   - Reset any stateful data (like KV cache) on errors

   ```typescript
   catch (error: any) {
     if (model.performance.supportsKVCache) {
       past_key_values_cache = null;
     }
     throw error;
   }
   ```

7. **Frontend Integration**

   - Frontend should handle both streaming and non-streaming cases
   - Always disable input during generation
   - Re-enable input only after completion message
   - Handle errors gracefully with user feedback

   ```typescript
   try {
   	input.disabled = true;
   	for await (const chunk of stream) {
   		// Handle chunk
   	}
   } finally {
   	input.disabled = false;
   }
   ```

8. **Model Capabilities**
   - Always check model capabilities before operations
   - Different models may support different features
   - Some capabilities affect available options
   ```typescript
   if (!model.capabilities?.textGeneration) {
   	throw new Error("Model doesn't support text generation");
   }
   ```

These learnings come from actual issues encountered during refactoring and should help avoid common
pitfalls when working with the codebase.

## DRY Principles & Code Organization

1. **Single Source of Truth**

   - Core generation logic lives in `transformers.ts` only
   - Types are defined in `types/` and imported everywhere
   - Generation defaults are in `generation-defaults.ts`

   ```typescript
   // Good: Import from types
   import type { GenerationConfig } from "@wandler/types/generation";

   // Bad: Redefining types locally
   interface LocalGenerationConfig { ... }
   ```

2. **Utility Functions**

   - Common operations have dedicated utility functions:
     - `prepareMessages` in `message-utils.ts`
     - `prepareGenerationConfig` in `generation-utils.ts`
     - `validateGenerationConfig` in `generation-utils.ts`
   - Never copy-paste utility functions between files

3. **Configuration Management**

   ```typescript
   // Good: Use shared defaults
   import { getGenerationDefaults } from "@wandler/utils/generation-defaults";
   const config = getGenerationDefaults(options, model);

   // Bad: Hardcoding defaults in multiple places
   const config = {
   	max_new_tokens: options.max_new_tokens ?? 1024,
   	temperature: options.temperature ?? 1.0,
   	// ...
   };
   ```

4. **Shared Interfaces**

   - Worker messages share types with main thread
   - Generation options are consistent between streaming/non-streaming
   - Model capabilities are defined once and reused

   ```typescript
   // In types/generation.ts
   interface BaseGenerationOptions {
   	// Shared options
   }

   interface StreamingGenerationOptions extends BaseGenerationOptions {
   	// Streaming-specific options
   }

   interface NonStreamingGenerationOptions extends BaseGenerationOptions {
   	// Non-streaming specific options
   }
   ```

5. **Provider Architecture**

   - Model providers inherit from `BaseProvider`
   - Common provider logic is in the base class
   - Only provider-specific logic in derived classes

   ```typescript
   // Good: Extend base provider
   export class DeepseekProvider extends BaseProvider {
     protected baseConfig = {...};

     async loadModel(modelPath: string) {
       // Provider-specific implementation
     }
   }
   ```

6. **Worker Communication**

   - Message types are defined once in `worker/types.ts`
   - Response handling is consistent across all worker operations
   - Worker bridge pattern is reused for all worker communication

   ```typescript
   // In worker/types.ts
   export type WorkerMessageType = "load" | "generate" | "stream";
   export type WorkerResponseType = "loaded" | "generated" | "stream" | "error";
   ```

7. **Frontend Components**

   - Reuse UI components across demos
   - Share styles through common CSS
   - Consistent error handling and progress indicators

   ```typescript
   // Good: Reusable progress handling
   function handleProgress(info: ProgressInfo) {
   	if (info.status === "progress") {
   		const percent = ((info.loaded / info.total) * 100).toFixed(1);
   		updateProgress(percent);
   	}
   }
   ```

8. **Testing Patterns**
   - Test utilities are shared across test files
   - Mock data is centralized
   - Common test setup/teardown is reused
   ```typescript
   // In test-utils.ts
   export function createTestModel(options = {}) {
   	return {
   		capabilities: { textGeneration: true },
   		...options,
   	};
   }
   ```

These DRY principles help maintain consistency and reduce bugs by ensuring each piece of
functionality exists in exactly one place. When making changes:

1. Look for existing utilities before creating new ones
2. Consider extracting repeated code into shared functions
3. Use type inheritance to share common interfaces
4. Keep configuration centralized
5. Follow existing patterns for new features
