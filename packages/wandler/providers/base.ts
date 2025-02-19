import type { BaseModel, ModelConfig, ModelOptions, ModelPerformance } from "@wandler/types/model";
import { detectCapabilities, loadModelInstance, loadTokenizer } from "@wandler/utils/transformers";

export abstract class BaseProvider {
	// Base configuration that all providers should override
	protected abstract baseConfig: ModelConfig;

	// Model-specific configurations that override the base config
	protected abstract modelConfigs: Record<string, Partial<ModelConfig>>;

	protected getConfigForModel(modelPath: string): ModelConfig {
		const modelConfig = this.modelConfigs[modelPath] || {};
		return {
			...this.baseConfig,
			...modelConfig,
			// Deep merge for nested objects
			generationConfig: {
				...this.baseConfig.generationConfig,
				...modelConfig.generationConfig,
			},
			performance: {
				...this.baseConfig.performance,
				...(modelConfig.performance || {}),
			},
		};
	}

	getGenerationConfig(modelPath: string): Record<string, any> {
		return this.getConfigForModel(modelPath).generationConfig;
	}

	getModelPerformance(modelPath: string): ModelPerformance {
		const config = this.getConfigForModel(modelPath);
		return {
			supportsKVCache: config.performance?.supportsKVCache ?? true,
			groupedQueryAttention: config.performance?.groupedQueryAttention ?? false,
			recommendedDtype: config.performance?.recommendedDtype ?? "q4f16",
		};
	}

	public async loadModel(modelPath: string, options: ModelOptions = {}): Promise<BaseModel> {
		// Get model config and merge with options
		const modelConfig = this.getConfigForModel(modelPath);
		const mergedOptions = {
			...options,
			dtype: options.dtype || modelConfig.dtype,
			device: options.device || modelConfig.device,
		};

		// Load tokenizer and model in parallel
		const [tokenizer, instance] = await Promise.all([
			loadTokenizer(modelPath, mergedOptions),
			loadModelInstance(modelPath, mergedOptions),
		]);

		// Detect capabilities and get performance settings
		const { capabilities, performance, config } = await detectCapabilities(modelPath);

		return {
			id: modelPath,
			provider: this.constructor.name.toLowerCase().replace("provider", ""),
			tokenizer,
			instance,
			capabilities,
			performance: {
				...performance,
				...modelConfig.performance,
			},
			config,
			generationConfig: modelConfig.generationConfig,
		};
	}
}
