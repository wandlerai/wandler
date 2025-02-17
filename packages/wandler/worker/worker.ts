import { getProvider } from "@wandler/providers/registry";
import type { BaseModel } from "@wandler/types/model";
import type { WorkerMessage, WorkerResponse } from "@wandler/types/worker";
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
			// Check if the error is a number (invalid model response)
			if (typeof error === "number") {
				throw new Error(
					`Failed to load model: there was an error in transformers.js, but we don't know exactly what it means: ${error}`
				);
			}
			throw new Error(`Failed to load model: ${error?.message || String(error)}`);
		}

		console.log("[Worker] Model loaded with provider:", provider.constructor.name);
		console.log("[Worker] Model capabilities:", model.capabilities);
		console.log("[Worker] Model performance settings:", model.performance);
		console.log("[Worker] Using dtype:", options.performance?.recommendedDtype || "auto");
		console.log("[Worker] Using device:", options.device || "webgpu");

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

async function handleGenerateText(messages: any[], options = {}) {
	if (!model?.tokenizer || !model.instance) {
		throw new Error("Model not loaded");
	}

	console.log("[Worker] Generating text with messages:", messages);
	console.log("[Worker] Generation options:", options);

	try {
		// Use the core transformer layer
		const { result, tokenCount } = await generateWithTransformers(model, {
			messages,
			...options,
		});

		console.log("[Worker] Generation complete, result:", result);
		return { result, tokenCount };
	} catch (error) {
		console.error("[Worker] Generation error:", error);
		throw error;
	}
}

async function handleStreamText(messages: any[], options = {}) {
	if (!model?.tokenizer || !model.instance) {
		throw new Error("Model not loaded");
	}

	try {
		await generateWithTransformers(model, {
			messages,
			...options,
			streamCallback: (token: string) => {
				sendResponse({
					type: "stream",
					payload: token,
					id: "stream",
				});
			},
		});
	} catch (error: any) {
		sendResponse({
			type: "error",
			payload: {
				message: error.message,
				stack: error.stack,
			},
			id: "stream",
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
				const { result } = await handleGenerateText(payload.messages, {
					max_new_tokens: payload.max_new_tokens,
					do_sample: payload.do_sample,
					temperature: payload.temperature,
					top_p: payload.top_p,
					repetition_penalty: payload.repetition_penalty,
				});
				sendResponse({ type: "generated", payload: result, id });
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
				await handleStreamText(payload.messages, {
					max_new_tokens: payload.max_new_tokens,
					do_sample: payload.do_sample,
					temperature: payload.temperature,
					top_p: payload.top_p,
					repetition_penalty: payload.repetition_penalty,
					stop: payload.stop,
					seed: payload.seed,
				});
				// Send completion message
				sendResponse({ type: "generated", payload: null, id });
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
			payload: {
				message: error.message,
				name: error.name,
				code: error.code,
			},
			id,
		});
	}
};
