/*
  This module implements the streamText function which is API-compatible with the Vercel AI SDK.
  It supports parameters such as model, system, prompt, messages, tools, and others. It returns a ReadableStream that streams text chunks.
  The function also respects an abortSignal to cancel the stream if needed.
  
  Note: This function prefers using Web Workers for all models for better main thread performance.
  It only falls back to main thread execution if Web Workers are not supported in the environment.

  @packageDocumentation
*/

import type { BaseModel } from "@wandler/types/model";
import type { Message } from "@wandler/types/message";
import type { StreamResult } from "@wandler/types/stream";
import type { WorkerMessage, WorkerResponse } from "@wandler/worker/types";
import type { StreamingGenerationOptions } from "@wandler/types/generation";
import { generateWithTransformers, type GenerateConfig } from "./transformers";
import { prepareGenerationConfig, validateGenerationConfig } from "./generation-utils";
import { prepareMessages, validateMessages } from "./message-utils";

// --- Public Types ---

/**
 * Streams text generation from a model, returning chunks of text as they are generated.
 * @example
 * ```ts
 * const model = await loadModel("gpt2");
 * const { stream, cancel } = await streamText({
 *   model,
 *   messages: [{ role: "user", content: "Hello!" }]
 * });
 *
 * for await (const chunk of stream) {
 *   console.log(chunk); // Prints each generated word/token
 * }
 * ```
 * @param options - Configuration options for text generation
 * @returns A StreamResult containing the text stream and cancel function
 */
export async function streamText(
	options: StreamingGenerationOptions
): Promise<StreamResult<string>> {
	const model = options.model;
	if (!model.capabilities?.textGeneration) {
		throw new Error(`Model ${model.id} doesn't support text generation`);
	}

	const messages = prepareMessages(options);
	validateMessages(messages);
	const config = prepareGenerationConfig(options);
	validateGenerationConfig(config);

	return model.worker
		? streamWithWorker(model, messages, config, options)
		: streamInMainThread(model, messages, config, options);
}

// --- Internal Implementation ---

/**
 * Worker-based streaming implementation.
 * @internal
 */
async function streamWithWorker(
	model: BaseModel,
	messages: Message[],
	config: GenerateConfig,
	options: StreamingGenerationOptions
): Promise<StreamResult<string>> {
	let controller!: ReadableStreamDefaultController<string>;
	const textStream = new ReadableStream<string>({
		start(c) {
			controller = c;
		},
		cancel() {
			// Signal cancellation through AbortController if provided
			if (options.abortSignal instanceof AbortSignal) {
				const controller = new AbortController();
				controller.abort();
			}
		},
	}) as StreamResult<string>["textStream"];

	const message: WorkerMessage = {
		type: "stream",
		payload: {
			messages,
			...config,
		},
		id: `stream-${Date.now()}`,
	};

	// Set up message handler for streaming
	const bridge = model.worker!.bridge;
	bridge.setMessageHandler((e: MessageEvent) => {
		if (options.abortSignal?.aborted) {
			controller.error(new Error("Request aborted by user"));
			return;
		}

		if (e.data.type === "stream") {
			controller.enqueue(e.data.payload);
		} else if (e.data.type === "generated") {
			controller.close();
		} else if (e.data.type === "error") {
			controller.error(e.data.payload);
		}
	});

	// Start streaming with retry logic
	let retries = 0;
	const maxRetries = options.maxRetries ?? 2;

	const responsePromise = (async function tryStream(): Promise<string> {
		try {
			const response = await bridge.sendMessage(message);
			if (response.type === "error") throw response.payload;
			return response.payload;
		} catch (error) {
			if (retries < maxRetries && !options.abortSignal?.aborted) {
				retries++;
				return tryStream();
			}
			throw error;
		}
	})();

	return {
		textStream,
		[Symbol.asyncIterator]() {
			const reader = textStream.getReader();
			return {
				async next() {
					try {
						const { done, value } = await reader.read();
						if (done) return { done: true, value: undefined };
						return { done: false, value };
					} catch (e) {
						reader.releaseLock();
						throw e;
					}
				},
				async return() {
					reader.releaseLock();
					return { done: true, value: undefined };
				},
			};
		},
		response: responsePromise,
	};
}

/**
 * Main thread streaming implementation using transformers.js directly.
 * @internal
 */
async function streamInMainThread(
	model: BaseModel,
	messages: Message[],
	config: GenerateConfig,
	options: StreamingGenerationOptions
): Promise<StreamResult<string>> {
	let controller!: ReadableStreamDefaultController<string>;
	const textStream = new ReadableStream<string>({
		start(c) {
			controller = c;
		},
		cancel() {
			// Signal cancellation through AbortController if provided
			if (options.abortSignal instanceof AbortSignal) {
				const controller = new AbortController();
				controller.abort();
			}
		},
	}) as StreamResult<string>["textStream"];

	// Start generation with retry logic
	let retries = 0;
	const maxRetries = options.maxRetries ?? 2;

	const generatePromise = (async function tryGenerate(): Promise<string> {
		try {
			const { result } = await generateWithTransformers(model, {
				messages,
				...config,
				streamCallback: (token: string) => {
					controller.enqueue(token);
				},
			});

			controller.close();
			return result;
		} catch (error) {
			if (retries < maxRetries && !options.abortSignal?.aborted) {
				retries++;
				return tryGenerate();
			}
			throw error;
		}
	})();

	return {
		textStream,
		[Symbol.asyncIterator]() {
			const reader = textStream.getReader();
			return {
				async next() {
					try {
						const { done, value } = await reader.read();
						if (done) return { done: true, value: undefined };
						return { done: false, value };
					} catch (e) {
						reader.releaseLock();
						throw e;
					}
				},
				async return() {
					reader.releaseLock();
					return { done: true, value: undefined };
				},
			};
		},
		response: generatePromise,
	};
}
