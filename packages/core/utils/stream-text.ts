/*
  This module implements the streamText function which is API-compatible with the Vercel AI SDK.
  It supports parameters such as model, system, prompt, messages, tools, and others. It returns a ReadableStream that streams text chunks.
  The function also respects an abortSignal to cancel the stream if needed.
  
  Note: This function prefers using Web Workers for all models for better main thread performance.
  It only falls back to main thread execution if Web Workers are not supported in the environment.
*/

import { TextStreamer } from "@huggingface/transformers";
import type { BaseModel } from "@wandler/types/model";
import type { Message } from "@wandler/types/message";
import type { StreamResult, StreamTextOptions } from "@wandler/types/stream";
import type { WorkerMessage, WorkerResponse } from "@wandler/worker/types";
import { createGenerationConfig } from "./generation-defaults";

// Keep track of past key values for models that support KV cache
let past_key_values_cache: any = null;

// --- Utilities ---

function createStreamer(model: BaseModel, controller: ReadableStreamDefaultController<string>) {
	return new TextStreamer(model.tokenizer, {
		skip_prompt: true,
		skip_special_tokens: true,
		callback_function: (token: string) => {
			controller.enqueue(token);
		},
	});
}

// Check if workers are available in this environment
function isWorkerAvailable() {
	try {
		return typeof Worker !== "undefined" && typeof SharedArrayBuffer !== "undefined";
	} catch {
		return false;
	}
}

// --- Implementation of streamText ---

export async function streamText(options: StreamTextOptions): Promise<StreamResult<string>> {
	const model = options.model;
	if (!model.capabilities.textGeneration) {
		throw new Error(`Model ${model.id} doesn't support text generation`);
	}

	// Handle abort signal
	if (options.abortSignal?.aborted) {
		throw new Error("Request aborted by user");
	}

	// Convert options to Message format with full content type support
	const messages: Message[] = [];
	if (options.system) {
		messages.push({ role: "system", content: options.system } as Message);
	}
	if (options.prompt) {
		messages.push({ role: "user", content: options.prompt } as Message);
	}
	if (options.messages) {
		messages.push(
			...options.messages.map(msg => {
				// Handle complex message content (images, files, tool calls)
				const content = Array.isArray(msg.content)
					? msg.content
							.map(part => {
								switch (part.type) {
									case "text":
										return part.text;
									case "image":
										return `[Image: ${typeof part.image === "string" ? part.image : "binary data"}]`;
									case "file":
										return `[File: ${part.mimeType}]`;
									case "tool-call":
										return `[Tool Call: ${part.toolName}(${JSON.stringify(part.args)})]`;
									case "tool-result":
										return `[Tool Result: ${part.toolName} -> ${JSON.stringify(part.result)}]`;
									default:
										return JSON.stringify(part);
								}
							})
							.join("\n")
					: msg.content;

				return {
					role: msg.role as Message["role"],
					content: content,
				};
			})
		);
	}

	// Map StreamTextOptions to worker generation options with defaults
	const generationOptions = {
		// First use model's generationConfig (from provider), then user options, then hardcoded defaults
		max_new_tokens: options.maxTokens ?? model.generationConfig?.max_new_tokens ?? 1024,
		temperature: options.temperature ?? model.generationConfig?.temperature ?? 1.0,
		top_p: options.topP ?? model.generationConfig?.top_p ?? 1.0,
		do_sample: options.temperature !== undefined || options.topP !== undefined,
		repetition_penalty:
			options.frequencyPenalty ?? model.generationConfig?.repetition_penalty ?? 1.1,
		stop: options.stopSequences,
		seed: options.seed,
		max_retries: options.maxRetries ?? 2,
		tools: options.tools,
		tool_choice: options.toolChoice,
		max_steps: options.maxSteps ?? 1,
	};

	// If model was loaded with worker, use worker-based streaming
	if (model.provider === "worker" && model.worker?.bridge) {
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
				...generationOptions,
			},
			id: `stream-${Date.now()}`,
		};

		// Set up message handler for streaming
		const bridge = model.worker.bridge;
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

	// Model was loaded in main thread, use direct streaming
	try {
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

		const streamer = createStreamer(model, controller);

		const inputs = model.tokenizer.apply_chat_template(messages, {
			add_generation_prompt: true,
			return_dict: true,
		});

		// Use the same generation options as worker
		const generationConfig = {
			...generationOptions,
			return_dict_in_generate: true,
			output_scores: false,
			streamer,
			// Only add KV cache if supported
			...(model.performance.supportsKVCache ? { past_key_values: past_key_values_cache } : {}),
		};

		// Start generation with retry logic
		let retries = 0;
		const maxRetries = options.maxRetries ?? 2;

		const generatePromise = (async function tryGenerate(): Promise<string> {
			try {
				const output = await model.instance.generate({
					...inputs,
					...generationConfig,
				});

				controller.close();

				// Store past key values if the model supports KV cache
				if (model.performance.supportsKVCache) {
					past_key_values_cache = output.past_key_values;
				}

				// Handle both array and object responses
				const sequences = Array.isArray(output) ? output : output.sequences;
				if (!sequences) {
					throw new Error("No sequences in model output");
				}
				return model.tokenizer.batch_decode(sequences, {
					skip_special_tokens: true,
				})[0];
			} catch (error) {
				// Reset KV cache on error if it was being used
				if (model.performance.supportsKVCache) {
					past_key_values_cache = null;
				}

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
	} catch (error) {
		// Reset KV cache on error if it was being used
		if (model.performance.supportsKVCache) {
			past_key_values_cache = null;
		}
		throw error;
	}
}
