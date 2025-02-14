/*
  This module implements the generateText function which provides non-streaming text generation.
  It uses the core transformers.js layer for actual generation, while handling the user-facing
  API, options processing, and routing between worker and main thread implementations.

  @packageDocumentation
*/

import type { BaseModel } from "@wandler/types/model";
import type { Message } from "@wandler/types/message";
import type { WorkerMessage } from "@wandler/worker/types";
import type { NonStreamingGenerationOptions } from "@wandler/types/generation";
import { generateWithTransformers, type GenerateConfig } from "./transformers";
import { prepareMessages, validateMessages } from "./message-utils";
import { prepareGenerationConfig, validateGenerationConfig } from "./generation-utils";

// --- Public Types ---

/**
 * Generates text from a language model in a single call.
 * This is the non-streaming version of text generation, suitable for cases where
 * you want to wait for the complete response.
 *
 * @example
 * ```typescript
 * const response = await generateText({
 *   model,
 *   messages: [{ role: "user", content: "What is the capital of France?" }],
 *   temperature: 0.7
 * });
 * console.log(response); // "The capital of France is Paris."
 * ```
 *
 * @param options - Configuration options for text generation
 * @returns The generated text response
 *
 * @throws {Error} If the model doesn't support text generation
 * @throws {Error} If no messages are provided
 * @throws {Error} If generation parameters are invalid
 *
 * @see {@link streamText} for streaming generation
 * @see {@link NonStreamingGenerationOptions} for detailed options documentation
 */

// Keep track of past key values for models that support KV cache
let past_key_values_cache: any = null;

// --- Public API ---

/**
 * Generates text from a language model in a single call.
 * This is the non-streaming version of text generation, suitable for cases where
 * you want to wait for the complete response.
 *
 * @example
 * ```typescript
 * const response = await generateText({
 *   model,
 *   messages: [{ role: "user", content: "What is the capital of France?" }],
 *   temperature: 0.7
 * });
 * console.log(response); // "The capital of France is Paris."
 * ```
 *
 * @param options - Configuration options for text generation
 * @returns The generated text response
 *
 * @throws {Error} If the model doesn't support text generation
 * @throws {Error} If no messages are provided
 * @throws {Error} If generation parameters are invalid
 *
 * @see {@link streamText} for streaming generation
 * @see {@link NonStreamingGenerationOptions} for detailed options documentation
 */
export async function generateText(options: NonStreamingGenerationOptions): Promise<string> {
	const model = options.model;
	if (!model.capabilities.textGeneration) {
		throw new Error(`Model ${model.id} doesn't support text generation`);
	}

	// Handle abort signal
	if (options.abortSignal?.aborted) {
		throw new Error("Request aborted by user");
	}

	// Prepare messages and config
	const messages = prepareMessages(options);
	validateMessages(messages);
	const config = prepareGenerationConfig(options);
	validateGenerationConfig(config);

	// Choose implementation based on model provider
	if (model.provider === "worker" && model.worker?.bridge) {
		return generateWithWorker(model, messages, config, options);
	}

	return generateInMainThread(model, messages, config, options);
}

// --- Internal Implementation ---

/**
 * Worker-based generation implementation.
 * @internal
 */
async function generateWithWorker(
	model: BaseModel,
	messages: Message[],
	config: GenerateConfig,
	options: NonStreamingGenerationOptions
): Promise<string> {
	const message: WorkerMessage = {
		type: "generate",
		payload: {
			messages,
			...config,
		},
		id: `generate-${Date.now()}`,
	};

	// Start generation with retry logic
	let retries = 0;
	const maxRetries = options.maxRetries ?? 2;

	const tryGenerate = async (): Promise<string> => {
		try {
			const response = await model.worker!.bridge.sendMessage(message);
			if (response.type === "error") throw response.payload;
			return response.payload;
		} catch (error) {
			if (retries < maxRetries && !options.abortSignal?.aborted) {
				retries++;
				return tryGenerate();
			}
			throw error;
		}
	};

	return tryGenerate();
}

/**
 * Main thread generation implementation using transformers.js directly.
 * @internal
 */
async function generateInMainThread(
	model: BaseModel,
	messages: Message[],
	config: GenerateConfig,
	options: NonStreamingGenerationOptions
): Promise<string> {
	// Start generation with retry logic
	let retries = 0;
	const maxRetries = options.maxRetries ?? 2;

	const tryGenerate = async (): Promise<string> => {
		try {
			const { result } = await generateWithTransformers(model, {
				messages,
				...config,
			});
			return result;
		} catch (error) {
			if (retries < maxRetries && !options.abortSignal?.aborted) {
				retries++;
				return tryGenerate();
			}
			throw error;
		}
	};

	return tryGenerate();
}
