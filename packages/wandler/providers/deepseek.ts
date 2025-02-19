import { BaseProvider } from "@wandler/providers/base";
import type { ModelConfig } from "@wandler/types/model";

export class DeepseekProvider extends BaseProvider {
	// Base configuration for all DeepSeek models
	protected baseConfig: ModelConfig = {
		dtype: "q4f16",
		device: "best",
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
}
