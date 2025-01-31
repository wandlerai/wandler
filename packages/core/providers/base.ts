import { AutoConfig } from "@huggingface/transformers";
import type {
	BaseModel,
	ModelCapabilities,
	ModelPerformance,
	ModelOptions,
	ProgressInfo,
	ModelDtype,
} from "@wandler/types/model";

export abstract class BaseProvider {
	protected progress: Record<string, { loaded: number; total: number }> = {};

	abstract loadModel(modelPath: string, options?: ModelOptions): Promise<BaseModel>;

	abstract getGenerationConfig(modelPath: string): Record<string, any>;

	abstract getModelPerformance(modelPath: string): ModelPerformance;

	protected handleProgress(
		type: string,
		progressInfo: ProgressInfo,
		callback?: (info: ProgressInfo) => void
	) {
		// Initialize progress tracking for this type if not exists
		if (!this.progress[type]) {
			this.progress[type] = {
				loaded: 0,
				total: 0,
			};
		}

		// Only update if we have more progress
		if (
			progressInfo.status === "progress" &&
			progressInfo.loaded !== undefined &&
			progressInfo.loaded > this.progress[type].loaded
		) {
			this.progress[type].loaded = progressInfo.loaded;

			// Only calculate percentages if we have both loaded and total
			if (progressInfo.loaded !== undefined && progressInfo.total !== undefined) {
				const mb = (progressInfo.loaded / (1024 * 1024)).toFixed(1);
				const total = (progressInfo.total / (1024 * 1024)).toFixed(1);
				const percent = ((progressInfo.loaded / progressInfo.total) * 100).toFixed(1);
				console.log(`${type}: ${mb}MB / ${total}MB (${percent}%)`);
			}
		}

		// Call the progress callback if provided
		if (callback) {
			callback(progressInfo);
		}
	}

	protected async detectCapabilities(modelPath: string): Promise<{
		capabilities: ModelCapabilities;
		performance: ModelPerformance;
		config: Record<string, any>;
	}> {
		const config = await AutoConfig.from_pretrained(modelPath);
		const configData = config as any;

		// Extract relevant config data
		const data = {
			architectures: configData.architectures,
			model_type: configData.model_type,
			transformers_js: configData.transformers_js_config,
			dtype: configData.torch_dtype,
			use_cache: configData.use_cache,
			num_attention_heads: configData.num_attention_heads,
			num_key_value_heads: configData.num_key_value_heads,
			hidden_size: configData.hidden_size,
			vision_config: configData.vision_config,
			text_config: configData.text_config,
		};

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

		const capabilities = {
			textGeneration:
				data.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("forcausallm") || // Text generation
						a.toLowerCase().includes("forconditionalgeneration") ||
						a.toLowerCase().includes("qwen") // Qwen models are for text generation
				) ||
				data.text_config?.architectures?.some(
					(a: string) => a.toLowerCase().includes("llm") || a.toLowerCase().includes("causallm")
				) ||
				// Many VL models can generate text
				VL_MODEL_TYPES.some(type => data.model_type?.toLowerCase().includes(type)),
			textClassification: false,
			imageGeneration: false,
			audioProcessing: false,
			vision: VL_MODEL_TYPES.some(type => data.model_type?.toLowerCase().includes(type)),
		};

		const performance = {
			supportsKVCache: true,
			groupedQueryAttention: false,
			recommendedDtype: "auto" as ModelDtype,
		};

		return {
			capabilities,
			performance,
			config: data,
		};
	}
}
