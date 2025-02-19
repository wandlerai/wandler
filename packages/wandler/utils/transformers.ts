/*
  This module centralizes all interactions with transformers.js.
  It provides a unified interface for text generation, handling tokenization,
  generation, and decoding in one place. This ensures consistent behavior
  between worker and main thread implementations.
*/

import type { PretrainedConfig, PreTrainedModel } from "@huggingface/transformers";
import {
	AutoConfig,
	AutoModelForCausalLM,
	AutoTokenizer,
	TextStreamer,
} from "@huggingface/transformers";

import type { Message } from "@wandler/types/message";
import type {
	BaseModel,
	ModelCapabilities,
	ModelDevice,
	ModelDtype,
	ModelOptions,
	ModelPerformance,
} from "@wandler/types/model";

// Types for device selection
export type DeviceType = ModelDevice;
export type TransformersDeviceType = Exclude<ModelDevice, "best">;

export interface DeviceInfo {
	type: DeviceType;
	actual: TransformersDeviceType;
	capabilities: {
		webgpu?: boolean;
		wasm?: boolean;
	};
}

// Keep track of past key values for models that support KV cache
let past_key_values_cache: any = null;

// Model Loading Functions
export async function selectBestDevice(
	requested: DeviceType = "auto"
): Promise<TransformersDeviceType> {
	if (requested === "best") {
		try {
			// Check for WebGPU support
			if (typeof navigator !== "undefined" && "gpu" in navigator) {
				console.log("[Transformers] WebGPU is available, using it");
				return "webgpu";
			}
		} catch (error) {
			console.log("[Transformers] WebGPU not available:", error);
		}
		console.log("[Transformers] Falling back to auto device selection");
		return "auto";
	}
	return requested as TransformersDeviceType;
}

export async function loadTokenizer(modelPath: string, options: ModelOptions = {}) {
	console.log("[Transformers] Loading tokenizer for", modelPath);
	return AutoTokenizer.from_pretrained(modelPath, {
		progress_callback: options.onProgress,
	});
}

export async function loadModelInstance(
	modelPath: string,
	options: ModelOptions = {}
): Promise<PreTrainedModel> {
	const requestedDevice = options.device as DeviceType;
	const device =
		requestedDevice === "best"
			? await selectBestDevice(requestedDevice)
			: (requestedDevice as TransformersDeviceType);

	console.log(`[Transformers] Loading model with device: ${device}`);

	return AutoModelForCausalLM.from_pretrained(modelPath, {
		...options,
		device,
		progress_callback: options.onProgress,
	});
}

// Known vision-language model types
const VL_MODEL_TYPES = [
	"idefics", // HuggingFace's IDEFICS
	"git", // Microsoft's Generative Image-to-Text
	"blip", // Salesforce's BLIP
	"vlm", // Generic Vision-Language Models
	"flava", // Facebook's FLAVA
	"instructblip", // Salesforce's InstructBLIP
	"kosmos", // Microsoft's Kosmos
];

// Extended config type to include fields not in PretrainedConfig
interface ExtendedConfig extends PretrainedConfig {
	architectures?: string[];
	text_config?: {
		architectures?: string[];
	};
	vision_config?: Record<string, any>;
	image_size?: number;
	use_cache?: boolean;
	num_key_value_heads?: number;
	num_attention_heads?: number;
	torch_dtype?: string;
}

export async function detectCapabilities(modelPath: string): Promise<{
	capabilities: ModelCapabilities;
	performance: ModelPerformance;
	config: Record<string, any>;
}> {
	try {
		// Load model config from root using AutoConfig
		const config = (await AutoConfig.from_pretrained(modelPath)) as ExtendedConfig;
		console.log("[Transformers] Raw config:", config);

		// Detect capabilities based on architectures and config
		const capabilities: ModelCapabilities = {
			textGeneration:
				config.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("forcausallm") || // Text generation
						a.toLowerCase().includes("forconditionalgeneration") ||
						a.toLowerCase().includes("qwen") // Qwen models are for text generation
				) ||
				config.text_config?.architectures?.some(
					(a: string) => a.toLowerCase().includes("llm") || a.toLowerCase().includes("causallm")
				) ||
				// Many VL models can generate text
				VL_MODEL_TYPES.some(type => config.model_type?.toLowerCase().includes(type)) ||
				false,
			textClassification:
				config.architectures?.some((a: string) =>
					a.toLowerCase().includes("forsequenceclassification")
				) || false,
			imageGeneration:
				config.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("forimagegeneration") ||
						config.model_type === "stable_diffusion"
				) || false,
			vision:
				config.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("forvision") ||
						a.toLowerCase().includes("vit") ||
						config.model_type?.toLowerCase().includes("vision")
				) ||
				Boolean(config.vision_config) || // Has vision config
				Boolean(config.image_size) || // Has image size parameter
				// Check for known vision-language model types
				VL_MODEL_TYPES.some(type => config.model_type?.toLowerCase().includes(type)) ||
				false,
			audioProcessing:
				config.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("foraudioclassification") || config.model_type === "whisper"
				) || false,
		};

		// Add performance hints based on config
		const performance: ModelPerformance = {
			supportsKVCache: config.use_cache === true,
			groupedQueryAttention:
				(config.num_key_value_heads ?? config.num_attention_heads ?? 1) <
				(config.num_attention_heads ?? 1),
			recommendedDtype: (config["transformers.js_config"]?.dtype ||
				config.torch_dtype ||
				"auto") as ModelDtype,
			kvCacheDtype: config["transformers.js_config"]?.kv_cache_dtype as
				| Record<string, string>
				| undefined,
		};

		console.log("[Transformers] Detected capabilities:", capabilities);
		console.log("[Transformers] Performance settings:", performance);

		return {
			capabilities,
			performance,
			config: config as Record<string, any>,
		};
	} catch (error) {
		console.error("[Transformers] Error detecting capabilities:", error);
		// Fallback to safe defaults if detection fails
		return {
			capabilities: {
				textGeneration: true, // Assume text generation as fallback
				textClassification: false,
				imageGeneration: false,
				audioProcessing: false,
				vision: false,
			},
			performance: {
				supportsKVCache: true,
				groupedQueryAttention: false,
				recommendedDtype: "auto",
			},
			config: {},
		};
	}
}

export async function loadTransformersModel(
	modelPath: string,
	options: ModelOptions = {}
): Promise<BaseModel> {
	try {
		console.log("[Transformers] Loading model:", modelPath, "with options:", options);

		const [tokenizer, instance] = await Promise.all([
			loadTokenizer(modelPath, options),
			loadModelInstance(modelPath, options),
		]);

		const { capabilities, performance, config } = await detectCapabilities(modelPath);

		return {
			id: modelPath,
			provider: "transformers",
			tokenizer,
			instance,
			capabilities,
			performance,
			config,
		};
	} catch (error) {
		console.error("[Transformers] Error loading model:", error);
		throw error;
	}
}

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
