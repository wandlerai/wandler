/*
  This module centralizes all interactions with transformers.js.
  It provides a unified interface for text generation, handling tokenization,
  generation, and decoding in one place. This ensures consistent behavior
  between worker and main thread implementations.
*/

import { TextStreamer } from "@huggingface/transformers";

import type { Message } from "@wandler/types/message";
import type { BaseModel } from "@wandler/types/model";

// Keep track of past key values for models that support KV cache
let past_key_values_cache: any = null;

export interface GenerateConfig {
	// Input options (one must be provided)
	inputs?: any; // If already tokenized
	messages?: Message[]; // If needs tokenization

	// Generation options
	max_new_tokens?: number;
	temperature?: number;
	top_p?: number;
	do_sample?: boolean;
	repetition_penalty?: number;
	stop?: string[];
	seed?: number;

	// Tool options
	tools?: Record<string, any>;
	tool_choice?: "auto" | "none" | "required" | { type: "tool"; toolName: string };
	max_steps?: number;

	// Streaming options
	streamer?: any;
	streamCallback?: (token: string) => void;

	// Internal options
	return_dict_in_generate?: boolean;
	output_scores?: boolean;
}

export interface GenerateResult {
	result: string;
	past_key_values?: any;
	tokenCount?: number;
}

/**
 * Creates a TextStreamer instance for streaming tokens
 */
export function createStreamer(model: BaseModel, callback: (token: string) => void) {
	return new TextStreamer(model.tokenizer, {
		skip_prompt: true,
		skip_special_tokens: true,
		callback_function: callback,
	});
}

/**
 * Core function for interacting with transformers.js text generation.
 * Handles tokenization, generation, and decoding in one place.
 */
export async function generateWithTransformers(
	model: BaseModel,
	config: GenerateConfig
): Promise<GenerateResult> {
	try {
		// 1. Input Validation
		if (!config.inputs && !config.messages) {
			throw new Error("Either inputs or messages must be provided");
		}

		// 2. Tokenization (if needed)
		const inputs =
			config.inputs ??
			model.tokenizer.apply_chat_template(config.messages!, {
				add_generation_prompt: true,
				return_dict: true,
			});

		// Log tokenization details if streaming
		if (config.streamCallback) {
			console.log("[Transformers] Applied chat template:", inputs);
			console.log("[Transformers] Input token ids:", inputs.input_ids.tolist());
			console.log(
				"[Transformers] Input decoded:",
				model.tokenizer.batch_decode(inputs.input_ids.tolist(), { skip_special_tokens: false })
			);
		}

		// 3. Setup streamer if callback provided
		const streamer = config.streamCallback
			? new TextStreamer(model.tokenizer, {
					skip_prompt: true,
					skip_special_tokens: true,
					callback_function: config.streamCallback,
				})
			: config.streamer;

		// 4. Prepare generation config
		const generationConfig = {
			...config,
			return_dict_in_generate: true,
			output_scores: false,
			// Add streamer if available
			...(streamer && { streamer }),
			// Only add KV cache if supported
			...(model.performance.supportsKVCache ? { past_key_values: past_key_values_cache } : {}),
		};

		// Log generation details if streaming
		if (config.streamCallback) {
			console.log("[Transformers] Generation config:", generationConfig);
			console.log("[Transformers] Model instance config:", model.instance.config);
			console.log("[Transformers] KV Cache enabled:", model.performance.supportsKVCache);
		}

		// 5. Generate
		const output = await model.instance.generate({
			...inputs,
			...generationConfig,
		});

		// 6. Handle KV Cache
		if (model.performance.supportsKVCache) {
			past_key_values_cache = output.past_key_values;
		}

		// 7. Decode output
		const sequences = Array.isArray(output) ? output : output.sequences;
		if (!sequences) {
			throw new Error("No sequences in model output");
		}

		const result = model.tokenizer.batch_decode(sequences, {
			skip_special_tokens: true,
		})[0];

		// 8. Calculate token count for streaming
		const tokenCount = config.streamCallback
			? sequences.tolist()[0].length - inputs.input_ids.tolist()[0].length
			: undefined;

		// Log completion details if streaming
		if (config.streamCallback) {
			console.log("[Transformers] Generation complete, raw output:", output);
			console.log("[Transformers] Total tokens generated:", tokenCount);
			console.log("[Transformers] Sequences shape:", sequences.shape);
			console.log("[Transformers] Final sequence tokens:", sequences.tolist());
		}

		return {
			result,
			past_key_values: model.performance.supportsKVCache ? output.past_key_values : undefined,
			tokenCount,
		};
	} catch (error) {
		// Reset KV cache on error if it was being used
		if (model.performance.supportsKVCache) {
			past_key_values_cache = null;
		}
		throw error;
	}
}

/**
 * Reset the KV cache. This should be called when switching conversations
 * or when you want to start fresh.
 */
export function resetKVCache(): void {
	past_key_values_cache = null;
}

/**
 * Check if KV cache is currently active
 */
export function hasActiveKVCache(): boolean {
	return past_key_values_cache !== null;
}
