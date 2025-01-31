import { AutoTokenizer, AutoModelForCausalLM } from "@huggingface/transformers";
import { BaseProvider } from "@wandler/providers/base";
import type { BaseModel, ModelConfig, ModelOptions } from "@wandler/types/model";

export class DeepseekProvider extends BaseProvider {
	// Base configuration for all DeepSeek models
	protected baseConfig: ModelConfig = {
		dtype: "auto",
		device: "webgpu",
		generationConfig: {
			max_new_tokens: 1024,
			do_sample: false,
			temperature: 1.0,
			top_p: 1.0,
			repetition_penalty: 1.1,
		},
		performance: {
			supportsKVCache: true,
			groupedQueryAttention: false,
			recommendedDtype: "auto",
		},
	};

	// Model-specific configurations that override the base config
	protected modelConfigs: Record<string, Partial<ModelConfig>> = {
		"onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX": {
			dtype: "q4f16",
			generationConfig: {
				max_new_tokens: 2048,
				temperature: 0.7,
				top_p: 0.95,
			},
			performance: {
				supportsKVCache: false,
				recommendedDtype: "q4f16",
			},
		},
	};

	async loadModel(modelPath: string, options: ModelOptions = {}): Promise<BaseModel> {
		const { capabilities, performance, config } = await this.detectCapabilities(modelPath);
		const modelConfig = this.getConfigForModel(modelPath);

		// Load tokenizer and model with model-specific settings
		const [tokenizer, instance] = await Promise.all([
			AutoTokenizer.from_pretrained(modelPath, {
				progress_callback: info => this.handleProgress("tokenizer", info, options.onProgress),
			}),
			AutoModelForCausalLM.from_pretrained(modelPath, {
				...options,
				dtype: options.dtype || modelConfig.dtype,
				device: options.device || modelConfig.device,
				progress_callback: info => this.handleProgress("model", info, options.onProgress),
			}),
		]);

		return {
			id: modelPath,
			provider: "deepseek",
			capabilities,
			performance: {
				...performance,
				...modelConfig.performance,
			},
			config,
			tokenizer,
			instance,
			generationConfig: modelConfig.generationConfig,
		};
	}
}
