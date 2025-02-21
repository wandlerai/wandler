import type { TextStreamPart } from "@wandler/types/generation";
import type { Message } from "@wandler/types/message";
import type { BaseModel } from "@wandler/types/model";
import type { WorkerMessage, WorkerResponse } from "@wandler/types/worker";

import { getProvider } from "@wandler/providers/registry";
import { generateWithTransformers } from "@wandler/utils/transformers";

let model: BaseModel | null = null;

function sendResponse(response: WorkerResponse) {
	self.postMessage(response);
}

function createSerializableModel(model: BaseModel) {
	// Ensure capabilities exist with proper defaults
	const capabilities = {
		textGeneration: model.capabilities?.textGeneration ?? false,
		textClassification: model.capabilities?.textClassification ?? false,
		imageGeneration: model.capabilities?.imageGeneration ?? false,
		audioProcessing: model.capabilities?.audioProcessing ?? false,
		vision: model.capabilities?.vision ?? false,
	};

	// Create a copy without functions and non-serializable parts
	return {
		id: model.id,
		provider: "worker",
		capabilities,
		performance: model.performance,
		config: model.config,
		// Don't send tokenizer and instance - they stay in the worker
	};
}

async function loadModel(modelPath: string, options: any = {}) {
	try {
		// Get the appropriate provider
		const provider = getProvider(modelPath);

		// Wrap the progress callback to send through worker
		const wrappedOptions = {
			...options,
			onProgress: (info: any) => {
				sendResponse({
					type: "progress",
					payload: info,
					id: "progress",
				});
			},
		};

		// Use the provider to load the model
		console.log("[Worker] Loading model with provider:", provider.constructor.name);
		try {
			model = await provider.loadModel(modelPath, wrappedOptions);
		} catch (error: any) {
			console.error("[Worker] Model loading failed:", error);

			// Check if error message indicates unauthorized access or failed fetch
			const errorMessage = error?.message || String(error);
			if (
				errorMessage.includes("Unauthorized access to file") ||
				errorMessage.includes("Failed to fetch")
			) {
				throw new Error(`The model "${modelPath}" does not exist on Hugging Face`);
			}

			// Check if the error is a number (invalid model response)
			if (typeof error === "number") {
				throw new Error(
					`There was an error in transformers.js, but we don't know exactly what it means: ${error}`
				);
			}

			// For any other errors, pass through the message
			throw new Error(`${errorMessage}`);
		}

		console.log("[Worker] Model loaded with provider:", provider.constructor.name);
		console.log("[Worker] Using dtype:", model.options.dtype);
		console.log("[Worker] Using device:", model.options.device);

		console.log("[Worker] Warming up model...");
		// Warm up the model with a dummy input
		const warmupInput = model.tokenizer("Hello");
		await model.instance.generate({ ...warmupInput, max_new_tokens: 1 });
		console.log("[Worker] Model warmed up");

		// Return a serializable version of the model
		return createSerializableModel(model);
	} catch (error: any) {
		console.error("[Worker] Error in model loading pipeline:", error);
		throw error; // Re-throw to maintain the error chain
	}
}

async function handleGenerateText(
	messages: any[],
	options: { aborted?: boolean } & Record<string, any> = {}
) {
	if (!model?.tokenizer || !model.instance) {
		throw new Error("Model not loaded");
	}

	// Create an AbortController for this generation
	const controller = new AbortController();

	// Check if already aborted
	if (options.aborted) {
		controller.abort();
		const error = new Error("Request aborted by user");
		error.name = "AbortError";
		throw error;
	}

	console.log("[Worker] Generating text with messages:", messages);
	console.log("[Worker] Generation options:", options);

	try {
		// Use the core transformer layer
		const result = await generateWithTransformers(model, {
			messages,
			...options,
			abortSignal: controller.signal,
		});

		console.log("[Worker] Generation complete, result:", result);
		return result;
	} catch (error: any) {
		console.error("[Worker] Generation error:", error);

		// If this is an abort error, make sure to throw it
		if (error.name === "AbortError" || error.message?.toLowerCase().includes("abort")) {
			const abortError = new Error("Request aborted by user");
			abortError.name = "AbortError";
			throw abortError;
		}

		throw error;
	}
}

async function handleStreamText(
	model: BaseModel,
	messages: Message[],
	config: any,
	messageId: string
) {
	try {
		let text = ""; // The main text content (without think blocks)
		let fullText = ""; // Complete text including think blocks (for final result)
		let inThinkBlock = false;
		let currentReasoning = "";
		let lastReasoningSent = "";
		let lastTextSent = "";

		const result = await generateWithTransformers(model, {
			messages,
			...config,
			streamCallback: (token: string) => {
				// Check if we're entering a think block
				if (token.includes("<think>")) {
					inThinkBlock = true;
					fullText += token;
					return;
				}

				// Check if we're exiting a think block
				if (token.includes("</think>")) {
					inThinkBlock = false;
					fullText += token;
					return;
				}

				// Always accumulate the full text
				fullText += token;

				if (inThinkBlock) {
					// Accumulate reasoning
					currentReasoning += token;
					// Only send the new part of reasoning
					const newReasoning = currentReasoning.slice(lastReasoningSent.length);
					if (newReasoning) {
						const reasoningPart: TextStreamPart = {
							type: "reasoning",
							textDelta: newReasoning,
						};
						sendResponse({
							type: "stream",
							payload: reasoningPart,
							id: messageId,
						});
						lastReasoningSent = currentReasoning;
					}
				} else {
					// Accumulate main text
					text += token;
					// Only send text-delta for new content
					const newText = text.slice(lastTextSent.length);
					if (newText) {
						const part: TextStreamPart = {
							type: "text-delta",
							textDelta: newText,
						};
						sendResponse({
							type: "stream",
							payload: part,
							id: messageId,
						});
						lastTextSent = text;
					}
				}
			},
		});

		// Send completion message with the final result
		sendResponse({
			type: "generated",
			payload: {
				text: fullText.replace(/<think>[\s\S]*?<\/think>/g, "").trim(),
				reasoning: result.reasoning ?? currentReasoning.trim() ?? null,
				sources: result.sources ?? null,
				finishReason: result.finishReason ?? null,
				usage: result.usage ?? null,
				messages: messages?.length ? [...messages, { role: "assistant", content: fullText }] : null,
			} as {
				text: string;
				reasoning: string | null;
				sources: string[] | null;
				finishReason: string | null;
				usage: { promptTokens?: number; completionTokens?: number; totalTokens?: number } | null;
				messages: Message[] | null;
			},
			id: messageId,
		});
	} catch (error: any) {
		sendResponse({
			type: "error",
			payload: error instanceof Error ? error : new Error(error.message),
			id: messageId,
		});
		throw error;
	}
}

self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
	const { type, payload, id } = e.data;
	console.log("[Worker] Received message:", { type, payload, id });

	try {
		switch (type) {
			case "load": {
				console.log("[Worker] Loading model:", payload.modelPath);
				if (!payload.modelPath) {
					throw new Error("Model path is required");
				}
				console.log("[Worker] Loading with options:", payload.options);
				const result = await loadModel(payload.modelPath, payload.options);
				console.log("[Worker] Model loaded successfully");
				sendResponse({ type: "loaded", payload: result, id });
				break;
			}

			case "generate": {
				if (!payload.messages) {
					throw new Error("Messages are required");
				}
				const result = await handleGenerateText(payload.messages, {
					max_new_tokens: payload.max_new_tokens,
					do_sample: payload.do_sample,
					temperature: payload.temperature,
					top_p: payload.top_p,
					repetition_penalty: payload.repetition_penalty,
				});
				sendResponse({
					type: "generated",
					payload: {
						text: result.text,
						reasoning: result.reasoning ?? null,
						sources: result.sources ?? null,
						finishReason: result.finishReason ?? null,
						usage: result.usage ?? null,
						messages: payload.messages,
					},
					id,
				});
				break;
			}

			case "stream": {
				if (!payload.messages) {
					throw new Error("Messages are required");
				}
				if (!model) {
					throw new Error("Model not loaded");
				}
				if (!model.capabilities?.textGeneration) {
					throw new Error("Model does not support text generation");
				}
				await handleStreamText(model, payload.messages, payload, id);
				break;
			}

			case "terminate": {
				model = null;
				self.close();
				break;
			}

			default:
				throw new Error(`Unknown message type: ${type}`);
		}
	} catch (error: any) {
		console.error("Worker error:", error);
		sendResponse({
			type: "error",
			payload: new Error(error.message),
			id,
		});
	}
};
