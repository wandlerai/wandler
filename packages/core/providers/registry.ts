import { BaseProvider } from "@wandler/providers/base";
import { DeepseekProvider } from "@wandler/providers/deepseek";
import { TransformersProvider } from "@wandler/providers/transformers";

export interface ProviderEntry {
	pattern: RegExp;
	provider: BaseProvider;
}

export const PROVIDER_REGISTRY: ProviderEntry[] = [
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

/**
 * Get the appropriate provider for a given model path
 */
export function getProvider(modelPath: string): BaseProvider {
	const entry = PROVIDER_REGISTRY.find(({ pattern }) => pattern.test(modelPath));
	return entry?.provider || new TransformersProvider();
}
