// Import this to avoid circular dependency
import type { PretrainedConfig } from "@huggingface/transformers";

import type { GenerationConfig } from "./generation";

export type ModelDtype =
	| "q4f16"
	| "auto"
	| "fp32"
	| "fp16"
	| "q8"
	| "int8"
	| "uint8"
	| "q4"
	| "bnb4";

export type ModelDevice =
	| "auto"
	| "best"
	| "webgpu"
	| "gpu"
	| "cpu"
	| "wasm"
	| "cuda"
	| "dml"
	| "webnn"
	| "webnn-npu"
	| "webnn-gpu"
	| "webnn-cpu";

// Device-specific types for transformers.js integration
export type TransformersDeviceType = Exclude<ModelDevice, "best">;

export interface DeviceInfo {
	type: ModelDevice;
	actual: TransformersDeviceType;
	capabilities: {
		webgpu?: boolean;
		wasm?: boolean;
	};
}

// Extended config type for transformers.js models
export interface ExtendedModelConfig extends PretrainedConfig {
	architectures?: string[];
	text_config?: {
		architectures?: string[];
	};
	vision_config?: Record<string, any>;
	image_size?: number;
	use_cache?: boolean;
	num_key_value_heads?: number;
	num_attention_heads?: number;
	torch_dtype?: string;
}

export interface ModelCapabilities {
	textGeneration: boolean;
	textClassification: boolean;
	imageGeneration: boolean;
	audioProcessing: boolean;
	vision: boolean;
}

export interface ModelPerformance {
	supportsKVCache: boolean;
	groupedQueryAttention: boolean;
	recommendedDtype: ModelDtype;
	kvCacheDtype?: Record<string, string>;
}

export interface ModelConfig {
	dtype?: ModelDtype;
	device?: ModelDevice;
	generationConfig: Record<string, any>;
	performance?: {
		supportsKVCache?: boolean;
		groupedQueryAttention?: boolean;
		recommendedDtype?: ModelDtype;
	};
	deviceConfigs?: {
		[key in Exclude<ModelDevice, "auto" | "best">]?: {
			dtype?: ModelDtype;
			device?: ModelDevice;
			performance?: {
				supportsKVCache?: boolean;
				groupedQueryAttention?: boolean;
				recommendedDtype?: ModelDtype;
			};
		};
	};
}

export interface BaseModel {
	id: string;
	provider: string;
	capabilities: ModelCapabilities;
	performance: ModelPerformance;
	config: Record<string, any>;
	tokenizer?: any;
	processor?: any;
	instance?: any;
	options: ModelOptions;
	generationConfig?: GenerationConfig;
	dispose?: () => void;
	worker?: {
		bridge: any;
	};
}

export interface ProgressInfo {
	status: "progress" | "ready" | "initiate" | "download" | "done";
	file?: string;
	loaded?: number;
	total?: number;
}

export interface ModelOptions {
	useKV?: boolean;
	dtype?: ModelDtype;
	device?: ModelDevice;
	onProgress?: (info: ProgressInfo) => void;
	useWorker?: boolean;
	fallback?: boolean;
	workerOptions?: {
		terminateOnIdle?: boolean;
		timeout?: number;
	};
	performance?: Partial<ModelPerformance>;
}
