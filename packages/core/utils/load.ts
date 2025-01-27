import { TransformersProvider } from "@wandler/providers/transformers";
import { DeepseekProvider } from "@wandler/providers/deepseek";
import type { BaseModel, ModelOptions } from "@wandler/types/model";

interface ProviderEntry {
	pattern: RegExp;
	provider: TransformersProvider | DeepseekProvider;
}

const PROVIDER_REGISTRY: ProviderEntry[] = [
	{
		pattern: /^onnx-community\/deepseek/i,
		provider: new DeepseekProvider(),
	},
	{
		pattern: /^deepseek\//,
		provider: new DeepseekProvider(),
	},
	{
		pattern: /^stabilityai\//,
		provider: new TransformersProvider(),
	},
];

export async function loadModel(
	modelPath: string,
	options?: Record<string, any>
): Promise<BaseModel> {
	// Find matching provider or use default
	const entry = PROVIDER_REGISTRY.find(({ pattern }) => pattern.test(modelPath));
	const provider = entry?.provider || new TransformersProvider();

	return provider.loadModel(modelPath, options);
} 