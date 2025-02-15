# Generate Text Implementation Plan

## Overview

We need to reorganize our text generation functionality to be more modular, consistent, and
complete. The key focus is on centralizing all transformers.js interactions into a single layer
while maintaining clean separation between user-facing API, worker communication, and core model
interactions.

## Architecture Layers

1. **User-Facing API Layer** (`generate-text.ts`)

   - Public API and types
   - Options validation and defaults
   - Routing between worker and main thread
   - Message preparation

2. **Worker Communication Layer** (`worker.ts`)

   - Worker-specific message handling
   - Bridge between main thread and worker
   - Worker lifecycle management

3. **Core Transformer.js Layer** (`transformers.ts`)
   - All direct transformers.js interactions
   - Tokenization, generation, and decoding
   - KV cache management
   - Core error handling

## Implementation Details

### 1. Core Transformer.js Layer

```typescript
// packages/wandler/utils/transformers.ts

interface GenerateConfig {
	inputs?: any; // If already tokenized
	messages?: Message[]; // If needs tokenization
	max_new_tokens?: number;
	temperature?: number;
	top_p?: number;
	do_sample?: boolean;
	repetition_penalty?: number;
	stop?: string[];
	seed?: number;
	return_dict_in_generate?: boolean;
	output_scores?: boolean;
	past_key_values?: any;
	streamer?: any;
}

export async function generateWithTransformers(
	model: BaseModel,
	config: GenerateConfig
): Promise<{
	result: string;
	past_key_values?: any;
}> {
	// 1. Tokenization (if needed)
	const inputs =
		config.inputs ??
		model.tokenizer.apply_chat_template(config.messages!, {
			add_generation_prompt: true,
			return_dict: true,
		});

	// 2. Generation
	const output = await model.instance.generate({
		...inputs,
		...config,
	});

	// 3. Handle KV Cache
	const past_key_values = model.performance.supportsKVCache ? output.past_key_values : undefined;

	// 4. Decode and return
	const sequences = Array.isArray(output) ? output : output.sequences;
	const result = model.tokenizer.batch_decode(sequences, {
		skip_special_tokens: true,
	})[0];

	return { result, past_key_values };
}
```

### 2. User-Facing API Layer

```typescript
// packages/wandler/utils/generate-text.ts

export async function generateText(options: GenerateTextOptions): Promise<string> {
	// 1. Validation and setup
	validateOptions(options);
	const messages = prepareMessages(options);
	const config = prepareGenerationConfig(options);

	// 2. Route to appropriate implementation
	if (shouldUseWorker(options.model)) {
		return generateWithWorker(options.model, messages, config);
	}

	// 3. Main thread implementation
	return generateInMainThread(options.model, messages, config);
}
```

### 3. Worker Communication Layer

```typescript
// packages/wandler/worker/worker.ts

async function handleGenerate(payload: GeneratePayload): Promise<string> {
	// 1. Prepare config from payload
	const config = prepareWorkerConfig(payload);

	// 2. Use shared transformer layer
	const { result } = await generateWithTransformers(model!, config);

	// 3. Return result through worker bridge
	return result;
}
```

## Implementation Steps

1. **Phase 1: Core Transformer Layer**

   - Create `transformers.ts`
   - Implement core generation logic
   - Add proper error handling and KV cache management
   - Add comprehensive logging

2. **Phase 2: Update Main Thread**

   - Update `generate-text.ts` to use core layer
   - Implement proper routing logic
   - Handle retries and aborts at this level

3. **Phase 3: Update Worker**

   - Update worker to use core layer
   - Implement proper message handling
   - Ensure consistent error propagation

4. **Phase 4: Testing & Integration**
   - Test each layer independently
   - Test integration between layers
   - Add comprehensive logging
   - Update documentation

## Testing Strategy

1. **Core Layer Tests**

   - Test transformers.js interactions
   - Test KV cache handling
   - Test error conditions

2. **API Layer Tests**

   - Test option validation
   - Test routing logic
   - Test retry behavior

3. **Worker Layer Tests**
   - Test message handling
   - Test error propagation
   - Test worker lifecycle

## Benefits

1. **Centralized Model Interaction**

   - Single place for transformers.js code
   - Consistent handling of KV cache
   - Unified error handling

2. **Clear Separation of Concerns**

   - Each layer has a specific responsibility
   - Easier to maintain and test
   - Better error tracking

3. **Consistent Behavior**
   - Same core logic for worker and main thread
   - Predictable error handling
   - Unified logging

## API Examples

```typescript
// Basic usage (routing handled internally)
const result = await generateText({
	model,
	messages: [{ role: "user", content: "Hello" }],
});

// Advanced usage
const result = await generateText({
	model,
	system: "You are a helpful assistant",
	messages: messages,
	temperature: 0.7,
	maxTokens: 2048,
	abortSignal: controller.signal,
});
```
