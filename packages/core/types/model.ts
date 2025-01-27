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
	dtype: ModelDtype;
	device: ModelDevice;
	generationConfig: GenerationConfig;
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
	generationConfig?: GenerationConfig;
}

export interface ProgressInfo {
	status: "progress" | "ready" | "initiate";
	loaded?: number;
	total?: number;
	file?: string;
}

export interface ModelOptions {
	useKV?: boolean;
	dtype?: ModelDtype;
	device?: ModelDevice;
	onProgress?: (info: ProgressInfo) => void;
}

// Import this to avoid circular dependency
import type { GenerationConfig } from "./generation"; 