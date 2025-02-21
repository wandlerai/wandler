import type { BaseModel, ModelConfig, ModelOptions, ModelPerformance } from "@wandler/types/model";
import type { ResolvedConfig, ReverseTemplateResult } from "@wandler/types/provider";

import { selectBestDevice } from "@wandler/utils/device-utils";
import { detectCapabilities, loadModelInstance, loadTokenizer } from "@wandler/utils/transformers";

export abstract class BaseProvider {
	// Base configuration that all providers should override
	protected abstract baseConfig: ModelConfig;

	// Model-specific configurations that override the base config
	protected abstract modelConfigs: Record<string, Partial<ModelConfig>>;

	/**
	 * Reverses the chat template, extracting structured messages from formatted output.
	 * Each provider must override this to handle their specific format.
	 */
	public reverseTemplate(formattedOutput: string): ReverseTemplateResult {
		throw new Error(
			`${this.constructor.name} does not implement reverseTemplate(). Each provider must implement its own message parsing logic.`
		);
	}

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
			supportsKVCache: config.performance?.supportsKVCache ?? false,
			groupedQueryAttention: config.performance?.groupedQueryAttention ?? false,
			recommendedDtype: config.performance?.recommendedDtype ?? "q4f16",
		};
	}

	/**
	 * Resolves all configuration settings following the priority chain:
	 * 1. User Options
	 * 2. Model-Specific Config
	 * 3. Device-Specific Config
	 * 4. Provider Base Config
	 * 5. System Recommendations
	 */
	protected async resolveConfiguration(
		modelPath: string,
		userOptions: ModelOptions = {}
	): Promise<ResolvedConfig> {
		// Get base model config with any model-specific overrides
		const modelConfig = this.getConfigForModel(modelPath);

		// Get system device recommendations
		const { device: recommendedDevice, recommendedDtype } = await selectBestDevice(
			userOptions.device || "auto"
		);

		// Determine target device for device-specific configs
		const targetDevice = userOptions.device || recommendedDevice;
		const deviceSpecificConfig =
			modelConfig.deviceConfigs?.[targetDevice as keyof typeof modelConfig.deviceConfigs] || {};

		// Merge options following priority chain
		const resolvedOptions: ModelOptions = {
			...userOptions,
			device: userOptions.device || deviceSpecificConfig.device || recommendedDevice,
			dtype: userOptions.dtype || deviceSpecificConfig.dtype || recommendedDtype,
		};

		// Get model capabilities and performance settings
		const {
			capabilities,
			performance,
			config: detectedConfig,
		} = await detectCapabilities(modelPath);

		// Merge performance settings with proper overrides
		const resolvedPerformance: ModelPerformance = {
			...performance,
			...modelConfig.performance,
			...deviceSpecificConfig.performance,
			// User options can override performance settings
			...(userOptions.performance || {}),
		};

		// Log resolution process for debugging
		console.log("[Provider] Configuration resolution:", {
			userOptions,
			modelConfig: {
				base: this.baseConfig,
				modelSpecific: this.modelConfigs[modelPath],
				deviceSpecific: deviceSpecificConfig,
			},
			systemRecommendations: {
				device: recommendedDevice,
				dtype: recommendedDtype,
			},
			resolved: {
				options: resolvedOptions,
				performance: resolvedPerformance,
			},
		});

		return {
			options: resolvedOptions,
			generation: modelConfig.generationConfig,
			performance: resolvedPerformance,
			capabilities,
			modelConfig: detectedConfig,
		};
	}

	public async loadModel(modelPath: string, options: ModelOptions = {}): Promise<BaseModel> {
		// Get fully resolved configuration
		const config = await this.resolveConfiguration(modelPath, options);

		// Load tokenizer and model in parallel with resolved options
		const [tokenizer, instance] = await Promise.all([
			loadTokenizer(modelPath, config.options),
			loadModelInstance(modelPath, config.options),
		]);

		return {
			id: modelPath,
			provider: this.constructor.name.toLowerCase().replace("provider", ""),
			providerInstance: this,
			tokenizer,
			instance,
			capabilities: config.capabilities,
			performance: config.performance,
			config: config.modelConfig,
			generationConfig: config.generation,
			options: config.options,
		};
	}
}
