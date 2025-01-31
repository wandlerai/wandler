import { AutoTokenizer, AutoModelForCausalLM } from "@huggingface/transformers";
import { BaseProvider } from "@wandler/providers/base";
import type { BaseModel, ModelConfig, ModelOptions, ModelPerformance } from "@wandler/types/model";

export class DeepseekProvider extends BaseProvider {
	private modelConfigs: Record<string, ModelConfig> = {
		// DeepSeek R1 Distill Qwen 1.5B ONNX
		"onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX": {
			dtype: "q4f16",
			device: "webgpu",
			generationConfig: {
				max_new_tokens: 2048,
				do_sample: false,
				temperature: 0.7,
				top_p: 0.95,
				repetition_penalty: 1.1,
			},
			performance: {
				supportsKVCache: false, // Explicitly disable KV cache for this model
				groupedQueryAttention: false,
				recommendedDtype: "q4f16",
			},
		},
		// Add more DeepSeek models here with their specific configurations
	};

	getGenerationConfig(modelPath: string) {
		const modelConfig = this.modelConfigs[modelPath] || {
			dtype: "auto",
			device: "webgpu",
			generationConfig: {
				max_new_tokens: 1024,
				do_sample: false,
				temperature: 1.0,
				top_p: 1.0,
			},
		};
		return modelConfig.generationConfig;
	}

	getModelPerformance(modelPath: string): ModelPerformance {
		const modelConfig = this.modelConfigs[modelPath] || {
			dtype: "auto",
			device: "webgpu",
			performance: {
				supportsKVCache: true,
				groupedQueryAttention: false,
				recommendedDtype: "auto",
			},
		};
		return {
			supportsKVCache: modelConfig.performance?.supportsKVCache ?? true,
			groupedQueryAttention: modelConfig.performance?.groupedQueryAttention ?? false,
			recommendedDtype: modelConfig.performance?.recommendedDtype ?? "auto",
		};
	}

	async loadModel(modelPath: string, options: ModelOptions = {}): Promise<BaseModel> {
		const { capabilities, performance, config } = await this.detectCapabilities(modelPath);

		// Get model-specific configuration or use defaults
		const modelConfig = this.modelConfigs[modelPath] || {
			dtype: "auto",
			device: "webgpu",
			generationConfig: {
				max_new_tokens: 1024,
				do_sample: false,
				temperature: 1.0,
				top_p: 1.0,
			},
			performance: {
				supportsKVCache: true, // Default to true for unknown models
				groupedQueryAttention: false,
				recommendedDtype: "auto",
			},
		};

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
				...modelConfig.performance, // Use model-specific performance settings
			},
			config,
			tokenizer,
			instance,
			generationConfig: modelConfig.generationConfig,
		};
	}
}
