import { BaseProvider } from "@wandler/providers/base";
import type { ModelConfig } from "@wandler/types/model";

export class TransformersProvider extends BaseProvider {
	protected baseConfig: ModelConfig = {
		dtype: "q4f16",
		device: "best",
		generationConfig: {
			max_new_tokens: 1024,
			do_sample: false,
			temperature: 1.0,
			top_p: 1.0,
		},
		performance: {
			supportsKVCache: true,
			groupedQueryAttention: false,
			recommendedDtype: "q4f16",
		},
	};

	// No model-specific overrides by default
	protected modelConfigs: Record<string, Partial<ModelConfig>> = {};
}
