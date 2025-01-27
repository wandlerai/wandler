import { AutoConfig } from "@huggingface/transformers";
import type { BaseModel, ModelCapabilities, ModelPerformance, ModelOptions, ProgressInfo, ModelDtype } from "@wandler/types/model";

export abstract class BaseProvider {
	protected progress = {
		model: { text: "Model: waiting...", loaded: 0 },
		tokenizer: { text: "Tokenizer: waiting...", loaded: 0 },
	};

	abstract loadModel(modelPath: string, options?: ModelOptions): Promise<BaseModel>;

	protected handleProgress(type: "model" | "tokenizer", progressInfo: ProgressInfo, onProgress?: (info: ProgressInfo) => void) {
		if (progressInfo.status === "progress" && progressInfo.loaded > this.progress[type].loaded) {
			this.progress[type].loaded = progressInfo.loaded;
			const mb = (progressInfo.loaded / (1024 * 1024)).toFixed(1);
			const total = (progressInfo.total / (1024 * 1024)).toFixed(1);
			const percent = ((progressInfo.loaded / progressInfo.total) * 100).toFixed(1);
			this.progress[type].text = `${type === "model" ? "Model" : "Tokenizer"}: ${mb}MB / ${total}MB (${percent}%)`;
			
			onProgress?.({
				...progressInfo,
				file: type,
			});
		}
	}

	protected async detectCapabilities(
		modelPath: string
	): Promise<{
		capabilities: ModelCapabilities;
		performance: ModelPerformance;
		config: Record<string, any>;
	}> {
		const config = await AutoConfig.from_pretrained(modelPath);
		const configData = {
			model_type: config.model_type,
			architectures: config.architectures,
			text_config: config.text_config,
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
				configData.architectures?.some(
					(a: string) =>
						a.toLowerCase().includes("forcausallm") || // Text generation
						a.toLowerCase().includes("forconditionalgeneration") ||
						a.toLowerCase().includes("qwen") // Qwen models are for text generation
				) ||
				configData.text_config?.architectures?.some(
					(a: string) => a.toLowerCase().includes("llm") || a.toLowerCase().includes("causallm")
				) ||
				// Many VL models can generate text
				VL_MODEL_TYPES.some(type => configData.model_type?.toLowerCase().includes(type)),
			textClassification: false,
			imageGeneration: false,
			audioProcessing: false,
			vision: VL_MODEL_TYPES.some(type => configData.model_type?.toLowerCase().includes(type)),
		};

		const performance = {
			supportsKVCache: true,
			groupedQueryAttention: false,
			recommendedDtype: "auto" as ModelDtype,
		};

		return {
			capabilities,
			performance,
			config: configData,
		};
	}
} 