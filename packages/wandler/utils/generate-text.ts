/*
  This module implements the generateText function which provides non-streaming text generation.
  It uses the core transformers.js layer for actual generation, while handling the user-facing
  API, options processing, and routing between worker and main thread implementations.

  @packageDocumentation
*/

import type {
	GenerationResult,
	NonStreamingGenerationOptions,
	TransformersGenerateConfig,
} from "@wandler/types/generation";
import type { Message } from "@wandler/types/message";
import type { BaseModel } from "@wandler/types/model";
import type { WorkerMessage } from "@wandler/types/worker";

import { prepareGenerationConfig, validateGenerationConfig } from "@wandler/utils/generation-utils";
import { prepareMessages, validateMessages } from "@wandler/utils/message-utils";
import { generateWithTransformers } from "@wandler/utils/transformers";

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
 * console.log(response.text); // "The capital of France is Paris."
 * ```
 *
 * @param options - Configuration options for text generation
 * @returns The generated text and metadata
 *
 * @throws {Error} If the model doesn't support text generation
 * @throws {Error} If no messages are provided
 * @throws {Error} If generation parameters are invalid
 *
 * @see {@link streamText} for streaming generation
 * @see {@link NonStreamingGenerationOptions} for detailed options documentation
 */

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
 * console.log(response.text); // "The capital of France is Paris."
 * ```
 *
 * @param options - Configuration options for text generation
 * @returns The generated text and metadata
 *
 * @throws {Error} If the model doesn't support text generation
 * @throws {Error} If no messages are provided
 * @throws {Error} If generation parameters are invalid
 *
 * @see {@link streamText} for streaming generation
 * @see {@link NonStreamingGenerationOptions} for detailed options documentation
 */
export async function generateText(
	options: NonStreamingGenerationOptions
): Promise<GenerationResult> {
	if (!options.model) {
		throw new Error(`"model" is required, make sure to load a model first using loadModel()`);
	}

	const model = options.model;
	if (!model.capabilities.textGeneration) {
		throw new Error(`Model ${model.id} doesn't support text generation`);
	}

	// Handle abort signal
	if (options.abortSignal?.aborted) {
		const error = new Error("Request aborted by user");
		error.name = "AbortError";
		throw error;
	}

	// Prepare messages and config
	const messages = prepareMessages(options);
	validateMessages(messages);
	const config = prepareGenerationConfig(options);
	validateGenerationConfig(config);

	// Choose implementation based on model provider
	if (model.provider === "worker" && model.worker?.bridge) {
		return generateWithWorker(model, messages, config, options.abortSignal);
	}

	return generateInMainThread(model, messages, {
		...config,
		abortSignal: options.abortSignal,
	});
}

// --- Internal Implementation ---

/**
 * Worker-based generation implementation.
 * @internal
 */
async function generateWithWorker(
	model: BaseModel,
	messages: Message[],
	config: TransformersGenerateConfig,
	abortSignal?: AbortSignal
): Promise<GenerationResult> {
	return new Promise((resolve, reject) => {
		const bridge = model.worker!.bridge;
		const messageId = `generate-${Date.now()}`;

		// Set up abort handler
		const abortHandler = () => {
			const error = new Error("Request aborted by user");
			error.name = "AbortError";
			reject(error);
		};

		// Listen for abort signal
		abortSignal?.addEventListener("abort", abortHandler);

		const message: WorkerMessage = {
			type: "generate",
			payload: {
				messages,
				...config,
			},
			id: messageId,
		};

		bridge
			.sendMessage(message)
			.then((response: { type: string; payload: any }) => {
				if (response.type === "error") reject(response.payload);
				else {
					// Convert worker response to GenerationResult
					resolve({
						text: response.payload.text,
						reasoning: response.payload.reasoning,
						sources: response.payload.sources,
						finishReason: response.payload.finishReason,
						usage: response.payload.usage,
						messages: response.payload.messages,
					});
				}
			})
			.catch(reject)
			.finally(() => {
				// Clean up abort listener
				abortSignal?.removeEventListener("abort", abortHandler);
			});

		// If already aborted, reject immediately
		if (abortSignal?.aborted) {
			abortHandler();
		}
	});
}

/**
 * Main thread generation implementation using transformers.js directly.
 * @internal
 */
async function generateInMainThread(
	model: BaseModel,
	messages: Message[],
	config: TransformersGenerateConfig
): Promise<GenerationResult> {
	const result = await generateWithTransformers(model, {
		messages,
		...config,
	});

	return {
		text: result.text,
		reasoning: result.reasoning ?? null,
		sources: result.sources ?? null,
		finishReason: result.finishReason ?? null,
		usage: result.usage ?? null,
		messages: result.messages ?? null,
	};
}
