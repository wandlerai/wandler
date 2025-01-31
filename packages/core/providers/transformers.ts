import { AutoTokenizer, AutoModelForCausalLM } from "@huggingface/transformers";
import { BaseProvider } from "@wandler/providers/base";
import type { BaseModel, ModelConfig, ModelOptions, ModelPerformance } from "@wandler/types/model";

export class TransformersProvider extends BaseProvider {
	private modelConfig: ModelConfig = {
		dtype: "auto",
		device: "webgpu",
		generationConfig: {
			max_new_tokens: 1024,
			do_sample: false,
			temperature: 1.0,
			top_p: 1.0,
		},
	};

	async loadModel(modelPath: string, options: ModelOptions = {}): Promise<BaseModel> {
		const { capabilities, performance, config } = await this.detectCapabilities(modelPath);

		// Load tokenizer and model
		const [tokenizer, instance] = await Promise.all([
			AutoTokenizer.from_pretrained(modelPath, {
				progress_callback: info => this.handleProgress("tokenizer", info, options.onProgress),
			}),
			AutoModelForCausalLM.from_pretrained(modelPath, {
				...options,
				dtype: options.dtype || this.modelConfig.dtype,
				device: options.device || this.modelConfig.device,
				progress_callback: info => this.handleProgress("model", info, options.onProgress),
			}),
		]);

		return {
			id: modelPath,
			provider: "transformers",
			capabilities,
			performance,
			config,
			tokenizer,
			instance,
			generationConfig: this.modelConfig.generationConfig,
		};
	}

	getGenerationConfig(modelPath: string) {
		return this.modelConfig.generationConfig;
	}

	getModelPerformance(modelPath: string): ModelPerformance {
		return {
			supportsKVCache: true,
			groupedQueryAttention: false,
			recommendedDtype: this.modelConfig.dtype,
		};
	}
}
