import { AutoConfig } from "@huggingface/transformers";
import type { BaseModel, ModelCapabilities, ModelPerformance } from "./types";

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

export abstract class BaseProvider {
	abstract loadModel(modelPath: string, options?: Record<string, any>): Promise<BaseModel>;

	protected async detectCapabilities(modelPath: string): Promise<{
		capabilities: ModelCapabilities;
		performance: ModelPerformance;
		config: Record<string, any>;
	}> {
		const config = await AutoConfig.from_pretrained(modelPath);

		// Extract relevant config data
		const configData = {
			architectures: config.architectures || [],
			model_type: config.model_type,
			transformers_js: config.transformers_js_config || {},
			dtype: config.torch_dtype,
			use_cache: config.use_cache,
			num_attention_heads: config.num_attention_heads,
			num_key_value_heads: config.num_key_value_heads,
			hidden_size: config.hidden_size,
			vision_config: config.vision_config,
			text_config: config.text_config,
		};

		// Detect capabilities
		const capabilities: ModelCapabilities = {
			textGeneration:
				configData.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("forcausallm") || // Text generation
						a.toLowerCase().includes("forconditionalgeneration") ||
						a.toLowerCase().includes("qwen") // Qwen models are for text generation
				) ||
				configData.text_config?.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("llm") || a.toLowerCase().includes("causallm")
				) ||
				// Many VL models can generate text
				VL_MODEL_TYPES.some(type => configData.model_type?.toLowerCase().includes(type)),
			textClassification: configData.architectures?.some((a: string) =>
				a.toLowerCase().includes("forsequenceclassification")
			),
			imageGeneration: configData.architectures?.some(
				(a: string) =>
					a.toLowerCase().includes("forimagegeneration") ||
					configData.model_type === "stable_diffusion"
			),
			vision:
				configData.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("forvision") ||
						a.toLowerCase().includes("vit") ||
						configData.model_type?.toLowerCase().includes("vision")
				) ||
				Boolean(configData.vision_config) || // Has vision config
				Boolean(configData.image_size) || // Has image size parameter
				// Check for known vision-language model types
				VL_MODEL_TYPES.some(type => configData.model_type?.toLowerCase().includes(type)),
			audioProcessing: configData.architectures?.some(
				(a: string) =>
					a.toLowerCase().includes("foraudioclassification") ||
					configData.model_type === "whisper"
			),
		};

		// Add performance hints
		const performance: ModelPerformance = {
			supportsKVCache: configData.use_cache === true,
			groupedQueryAttention: configData.num_key_value_heads < configData.num_attention_heads,
			recommendedDtype: configData.transformers_js?.dtype || configData.dtype,
			kvCacheDtype: configData.transformers_js?.kv_cache_dtype,
		};

		return {
			capabilities,
			performance,
			config: configData,
		};
	}
}
