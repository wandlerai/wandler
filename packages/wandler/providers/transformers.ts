import { AutoModel, AutoTokenizer } from "@huggingface/transformers";

import { BaseProvider } from "@wandler/providers/base";
import type { BaseModel, ModelConfig, ModelOptions } from "@wandler/types/model";

export class TransformersProvider extends BaseProvider {
	protected baseConfig: ModelConfig = {
		dtype: "auto",
		device: "auto",
		generationConfig: {
			max_new_tokens: 1024,
			do_sample: false,
			temperature: 1.0,
			top_p: 1.0,
		},
		performance: {
			supportsKVCache: true,
			groupedQueryAttention: false,
			recommendedDtype: "auto",
		},
	};

	// No model-specific overrides by default
	protected modelConfigs: Record<string, Partial<ModelConfig>> = {};

	public async loadTokenizer(modelPath: string, options: ModelOptions = {}): Promise<any> {
		return AutoTokenizer.from_pretrained(modelPath, {
			progress_callback: info => this.handleProgress("tokenizer", info, options.onProgress),
		});
	}

	public async loadInstance(modelPath: string, options: ModelOptions = {}): Promise<any> {
		const modelConfig = this.getConfigForModel(modelPath);
		return AutoModel.from_pretrained(modelPath, {
			...options,
			dtype: options.dtype || modelConfig.dtype,
			device: options.device || modelConfig.device,
			progress_callback: info => this.handleProgress("model", info, options.onProgress),
		});
	}

	async loadModel(modelPath: string, options: ModelOptions = {}): Promise<BaseModel> {
		try {
			console.log("loading model:", JSON.stringify(options, null, 2));

			const [tokenizer, instance] = await Promise.all([
				this.loadTokenizer(modelPath, { ...options, dtype: "q4f16" }),
				this.loadInstance(modelPath, { ...options, dtype: "q4f16" }),
			]);

			console.log("detecting capabilities");

			const { capabilities, performance, config } = await this.detectCapabilities(modelPath);

			return {
				id: modelPath,
				provider: "transformers",
				capabilities,
				performance: {
					...performance,
					...this.getConfigForModel(modelPath).performance,
				},
				config,
				tokenizer,
				instance,
				generationConfig: this.getConfigForModel(modelPath).generationConfig,
			};
		} catch (error) {
			console.log("error:", error);
			throw error;
		}
	}
}
