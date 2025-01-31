import { AutoTokenizer, AutoModelForCausalLM, TextStreamer } from "@huggingface/transformers";
import type { WorkerMessage, WorkerResponse } from "./types";
import type { BaseModel } from "@wandler/types/model";
import type { ModelPerformance, ModelDevice } from "@wandler/types/model";

let model: BaseModel | null = null;

// Keep track of past key values
let past_key_values_cache: any = null;

type WorkerOptions = {
	generationConfig?: Record<string, any>;
	performance?: ModelPerformance;
	device?: ModelDevice;
	[key: string]: any;
};

function sendResponse(response: WorkerResponse) {
	self.postMessage(response);
}

function createSerializableModel(model: BaseModel) {
	// Create a copy without functions and non-serializable parts
	return {
		id: model.id,
		provider: "worker",
		capabilities: model.capabilities,
		performance: model.performance,
		config: model.config,
		// Don't send tokenizer and instance - they stay in the worker
	};
}

async function loadModel(modelPath: string, options: WorkerOptions = {}) {
	try {
		// Load tokenizer and model
		const [tokenizer, instance] = await Promise.all([
			AutoTokenizer.from_pretrained(modelPath, {
				progress_callback: info => {
					sendResponse({
						type: "progress",
						payload: { ...info, type: "tokenizer" },
						id: "progress",
					});
				},
			}),
			AutoModelForCausalLM.from_pretrained(modelPath, {
				dtype: options.performance?.recommendedDtype || "auto",
				device: options.device || "webgpu",
				progress_callback: info => {
					sendResponse({
						type: "progress",
						payload: { ...info, type: "model" },
						id: "progress",
					});
				},
			}),
		]);

		// Create the model instance with provider's settings
		model = {
			id: modelPath,
			tokenizer,
			instance,
			capabilities: {
				textGeneration: true,
				textClassification: false,
				imageGeneration: false,
				audioProcessing: false,
				vision: false,
			},
			performance: options.performance || {
				supportsKVCache: true,
				groupedQueryAttention: false,
				recommendedDtype: "auto",
			},
			provider: "worker",
			config: {},
			generationConfig: options.generationConfig || {},
		};

		console.log("[Worker] Model performance settings:", model.performance);
		console.log("[Worker] Using dtype:", options.performance?.recommendedDtype || "auto");
		console.log("[Worker] Using device:", options.device || "webgpu");

		console.log("[Worker] Warming up model...");
		// Warm up the model with a dummy input
		const warmupInput = tokenizer("Hello");
		await instance.generate({ ...warmupInput, max_new_tokens: 1 });
		console.log("[Worker] Model warmed up");

		// Return a serializable version of the model
		return createSerializableModel(model);
	} catch (error: any) {
		console.error("Error loading model:", error);
		throw new Error(`Failed to load model: ${error.message}`);
	}
}

async function generateText(messages: any[], options = {}) {
	if (!model?.tokenizer || !model.instance) {
		throw new Error("Model not loaded");
	}

	console.log("[Worker] Generating text with messages:", messages);

	const inputs = model.tokenizer.apply_chat_template(messages, {
		add_generation_prompt: true,
		return_dict: true,
	});
	console.log("[Worker] Applied chat template:", inputs);

	const { sequences } = await model.instance.generate({
		...inputs,
		...options,
	});
	console.log("[Worker] Generated sequences:", sequences);

	const result = model.tokenizer.batch_decode(sequences, {
		skip_special_tokens: true,
	})[0];
	console.log("[Worker] Final decoded result:", result);

	return result;
}

async function streamText(
	messages: any[],
	options: {
		max_new_tokens?: number;
		do_sample?: boolean;
		temperature?: number;
		top_p?: number;
		repetition_penalty?: number;
	} = {}
) {
	if (!model?.tokenizer || !model.instance) {
		throw new Error("Model not loaded");
	}

	console.log("[Worker] Starting text streaming with messages:", messages);

	try {
		const inputs = model.tokenizer.apply_chat_template(messages, {
			add_generation_prompt: true,
			return_dict: true,
		});
		console.log("[Worker] Applied chat template for streaming:", inputs);
		console.log("[Worker] Input token ids:", inputs.input_ids.tolist());
		console.log(
			"[Worker] Input decoded:",
			model.tokenizer.batch_decode(inputs.input_ids.tolist(), { skip_special_tokens: false })
		);

		let tokenCount = 0;
		const streamer = new TextStreamer(model.tokenizer, {
			skip_prompt: true,
			skip_special_tokens: true,
			callback_function: (token: string) => {
				tokenCount++;
				console.log(`[Worker] Streaming token #${tokenCount}:`, token);
				console.log("[Worker] Sending stream response for token");
				sendResponse({
					type: "stream",
					payload: token,
					id: "stream",
				});
			},
		});

		// Get the base generation config from the model
		const baseConfig = {
			...model.generationConfig,
			...options,
			return_dict_in_generate: true,
			output_scores: false,
			streamer,
		};

		// Only add KV cache if the model supports it (check performance.supportsKVCache)
		const generationConfig = model.performance.supportsKVCache
			? {
					...baseConfig,
					past_key_values: past_key_values_cache,
				}
			: baseConfig;

		console.log("[Worker] Generation config:", generationConfig);
		console.log("[Worker] Model instance config:", model.instance.config);
		console.log("[Worker] KV Cache enabled:", model.performance.supportsKVCache);

		console.log("[Worker] Starting generation with streamer");
		const output = await model.instance
			.generate({
				...inputs,
				...generationConfig,
			})
			.catch((error: any) => {
				console.error("[Worker] Generation error details:", {
					error,
					inputs,
					generationConfig,
					modelConfig: model.instance.config,
					kvCacheEnabled: model.performance.supportsKVCache,
				});
				throw error;
			});

		// Only store past key values if the model supports KV cache
		if (model.performance.supportsKVCache) {
			past_key_values_cache = output.past_key_values;
		}

		console.log("[Worker] Generation complete, raw output:", output);
		console.log("[Worker] Total tokens streamed:", tokenCount);
		console.log("[Worker] Sequences shape:", output.sequences?.shape);
		console.log("[Worker] Output type:", typeof output);
		console.log("[Worker] Output keys:", Object.keys(output));

		const sequences = Array.isArray(output) ? output : output.sequences;
		if (!sequences) {
			throw new Error("No sequences in model output");
		}

		const result = model.tokenizer.batch_decode(sequences, {
			skip_special_tokens: true,
		})[0];
		console.log("[Worker] Final streamed result:", result);
		console.log("[Worker] Final sequence tokens:", sequences.tolist());
		console.log(
			"[Worker] Difference in length:",
			sequences.tolist()[0].length - inputs.input_ids.tolist()[0].length
		);

		return result;
	} catch (error) {
		console.error("[Worker] Generation error:", error);
		// Only reset KV cache on error if it was being used
		if (model?.performance.supportsKVCache) {
			past_key_values_cache = null;
		}
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
				const result = await generateText(payload.messages, {
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
				const result = await streamText(payload.messages, {
					...model.generationConfig, // Use model's generation config as base
					...payload, // Override with any provided options
				});
				// Send final response after all tokens have been streamed
				sendResponse({ type: "generated", payload: result, id });
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
