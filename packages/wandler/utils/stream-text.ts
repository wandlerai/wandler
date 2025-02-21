/*
  This module implements the streamText function which is API-compatible with the Vercel AI SDK.
  It supports parameters such as model, system, prompt, messages, tools, and others. It returns a ReadableStream that streams text chunks.
  The function also respects an abortSignal to cancel the stream if needed.
  
  Note: This function prefers using Web Workers for all models for better main thread performance.
  It only falls back to main thread execution if Web Workers are not supported in the environment.

  @packageDocumentation
*/

import type {
	GenerationResult,
	StreamingGenerationOptions,
	StreamTextResult,
	TextStreamPart,
	TransformersGenerateConfig,
} from "@wandler/types/generation";
import type { Message } from "@wandler/types/message";
import type { BaseModel } from "@wandler/types/model";
import type { WorkerMessage } from "@wandler/types/worker";

import { prepareGenerationConfig, validateGenerationConfig } from "@wandler/utils/generation-utils";
import { prepareMessages, validateMessages } from "@wandler/utils/message-utils";
import { generateWithTransformers } from "@wandler/utils/transformers";

function createAsyncIterableStream<T>(
	stream: ReadableStream<T>
): ReadableStream<T> & AsyncIterable<T> {
	return {
		...stream,
		[Symbol.asyncIterator]() {
			const reader = stream.getReader();
			return {
				async next(): Promise<IteratorResult<T>> {
					try {
						const { done, value } = await reader.read();
						return { done, value } as IteratorResult<T>;
					} catch (e) {
						reader.releaseLock();
						throw e;
					}
				},
				async return(): Promise<IteratorResult<T>> {
					reader.releaseLock();
					return { done: true, value: undefined };
				},
			};
		},
	} as ReadableStream<T> & AsyncIterable<T>;
}

/**
 * Streams text generation from a model, returning both text chunks and structured events.
 * @example
 * ```ts
 * const model = await loadModel("gpt2");
 * const { textStream, fullStream } = await streamText({
 *   model,
 *   messages: [{ role: "user", content: "Hello!" }]
 * });
 *
 * // Use text stream for simple text chunks
 * for await (const chunk of textStream) {
 *   console.log("Text:", chunk);
 * }
 *
 * // Use full stream for structured events
 * for await (const event of fullStream) {
 *   if (event.type === "text-delta") {
 *     console.log("Text:", event.textDelta);
 *   } else if (event.type === "reasoning") {
 *     console.log("Reasoning:", event.textDelta);
 *   } else if (event.type === "source") {
 *     console.log("Source:", event.source);
 *   }
 * }
 * ```
 */
export async function streamText(options: StreamingGenerationOptions): Promise<StreamTextResult> {
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

/**
 * Worker-based streaming implementation.
 * @internal
 */
async function streamWithWorker(
	model: BaseModel,
	messages: Message[],
	config: TransformersGenerateConfig,
	options: StreamingGenerationOptions
): Promise<StreamTextResult> {
	let textController!: ReadableStreamDefaultController<string>;
	let fullController!: ReadableStreamDefaultController<TextStreamPart>;
	let resultResolve!: (result: GenerationResult) => void;
	let resultReject!: (error: Error) => void;

	// Create result promise
	const resultPromise = new Promise<GenerationResult>((resolve, reject) => {
		resultResolve = resolve;
		resultReject = reject;
	});

	// Create text stream
	const textStream = new ReadableStream<string>({
		start(c) {
			textController = c;
		},
		cancel() {
			if (options.abortSignal instanceof AbortSignal) {
				const controller = new AbortController();
				controller.abort();
				const error = new Error("Request aborted by user");
				error.name = "AbortError";
				throw error;
			}
		},
	});

	// Create full stream
	const fullStreamBase = new ReadableStream<TextStreamPart>({
		start(c) {
			fullController = c;
		},
		cancel() {
			if (options.abortSignal instanceof AbortSignal) {
				const controller = new AbortController();
				controller.abort();
				const error = new Error("Request aborted by user");
				error.name = "AbortError";
				throw error;
			}
		},
	});

	const fullStream = createAsyncIterableStream(fullStreamBase);

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
			const error = new Error("Request aborted by user");
			error.name = "AbortError";
			textController.error(error);
			fullController.error(error);
			resultReject(error);
			return;
		}

		if (e.data.type === "stream") {
			const part = e.data.payload as TextStreamPart;

			// Always send to full stream first
			fullController.enqueue(part);

			// Handle different types of stream parts
			if (part.type === "text-delta" && part.textDelta) {
				// Send to text stream
				textController.enqueue(part.textDelta);
				// Call onChunk if provided
				if (options.onChunk) {
					options.onChunk({
						type: "text-delta",
						text: part.textDelta,
					});
				}
			} else if (part.type === "reasoning" && part.textDelta) {
				// Call onChunk if provided
				if (options.onChunk) {
					options.onChunk({
						type: "reasoning",
						text: part.textDelta,
					});
				}
			}
		} else if (e.data.type === "generated") {
			textController.close();
			fullController.close();
			resultResolve(e.data.payload);
		} else if (e.data.type === "error") {
			const error = e.data.payload instanceof Error ? e.data.payload : new Error(e.data.payload);
			textController.error(error);
			fullController.error(error);
			resultReject(error);
		}
	});

	// Start streaming
	bridge.sendMessage(message).catch(error => {
		textController.error(error);
		fullController.error(error);
		resultReject(error);
	});

	return {
		textStream,
		fullStream,
		result: resultPromise,
	};
}

/**
 * Main thread streaming implementation using transformers.js directly.
 * @internal
 */
async function streamInMainThread(
	model: BaseModel,
	messages: Message[],
	config: TransformersGenerateConfig,
	options: StreamingGenerationOptions
): Promise<StreamTextResult> {
	let textController!: ReadableStreamDefaultController<string>;
	let fullController!: ReadableStreamDefaultController<TextStreamPart>;
	let resultResolve!: (result: GenerationResult) => void;
	let resultReject!: (error: Error) => void;

	// Create result promise
	const resultPromise = new Promise<GenerationResult>((resolve, reject) => {
		resultResolve = resolve;
		resultReject = reject;
	});

	// Create text stream
	const textStream = new ReadableStream<string>({
		start(c) {
			textController = c;
		},
		cancel() {
			if (options.abortSignal instanceof AbortSignal) {
				const controller = new AbortController();
				controller.abort();
				const error = new Error("Request aborted by user");
				error.name = "AbortError";
				throw error;
			}
		},
	});

	// Create full stream
	const fullStreamBase = new ReadableStream<TextStreamPart>({
		start(c) {
			fullController = c;
		},
		cancel() {
			if (options.abortSignal instanceof AbortSignal) {
				const controller = new AbortController();
				controller.abort();
				const error = new Error("Request aborted by user");
				error.name = "AbortError";
				throw error;
			}
		},
	});

	const fullStream = createAsyncIterableStream(fullStreamBase);

	// Start generation
	generateWithTransformers(model, {
		messages,
		...config,
		streamCallback: (token: string) => {
			const part: TextStreamPart = {
				type: "text-delta",
				textDelta: token,
			};
			textController.enqueue(token);
			fullController.enqueue(part);
		},
	})
		.then(result => {
			// Send any additional parts at the end
			if (result.streamParts) {
				for (const part of result.streamParts) {
					if (part.type !== "text-delta") {
						fullController.enqueue(part);
					}
				}
			}
			textController.close();
			fullController.close();
			resultResolve(result);
		})
		.catch(error => {
			textController.error(error);
			fullController.error(error);
			resultReject(error);
		});

	return {
		textStream,
		fullStream,
		result: resultPromise,
	};
}
