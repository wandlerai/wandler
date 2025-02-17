import type {
	BaseModel,
	ModelCapabilities,
	ModelConfig,
	ModelOptions,
	ModelPerformance,
	ProgressInfo,
} from "@wandler/types/model";

export abstract class BaseProvider {
	protected progress: Record<string, { loaded: number; total: number }> = {};

	// Base configuration that all providers should override
	protected abstract baseConfig: ModelConfig;

	// Model-specific configurations that override the base config
	protected abstract modelConfigs: Record<string, Partial<ModelConfig>>;

	abstract loadModel(modelPath: string, options?: ModelOptions): Promise<BaseModel>;

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
		return this.getConfigForModel(modelPath).performance;
	}

	protected handleProgress(
		component: string,
		info: any,
		callback?: (info: ProgressInfo) => void
	): void {
		if (callback && info.status === "progress") {
			callback({
				status: "progress",
				component,
				file: info.file,
				loaded: info.loaded,
				total: info.total,
			});
		}
	}

	protected async detectCapabilities(modelPath: string): Promise<{
		capabilities: ModelCapabilities;
		performance: ModelPerformance;
		config: Record<string, any>;
	}> {
		return {
			capabilities: {
				textGeneration: true,
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

	public async loadTokenizer(modelPath: string, options: ModelOptions = {}): Promise<any> {
		throw new Error("loadTokenizer not implemented");
	}

	public async loadInstance(modelPath: string, options: ModelOptions = {}): Promise<any> {
		throw new Error("loadInstance not implemented");
	}

	public async loadModel(modelPath: string, options: ModelOptions = {}): Promise<BaseModel> {
		const tokenizer = await this.loadTokenizer(modelPath, options);
		const instance = await this.loadInstance(modelPath, options);
		const { capabilities, performance, config } = await this.detectCapabilities(modelPath);

		return {
			id: modelPath,
			provider: this.constructor.name.toLowerCase().replace("provider", ""),
			tokenizer,
			instance,
			capabilities,
			performance,
			config,
			generationConfig: this.getConfigForModel(modelPath).generationConfig,
		};
	}
}
