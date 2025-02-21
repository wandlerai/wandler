import type { BaseProvider } from "@wandler/providers/base";

import { DeepseekProvider } from "@wandler/providers/deepseek";
import { QwenProvider } from "@wandler/providers/qwen";
import { TransformersProvider } from "@wandler/providers/transformers";

export interface ProviderEntry {
	pattern: RegExp;
	Provider: new () => BaseProvider;
}

export const PROVIDER_REGISTRY: ProviderEntry[] = [
	{
		pattern: /^onnx-community\/qwen/i,
		Provider: QwenProvider,
	},
	{
		pattern: /^qwen\//i,
		Provider: QwenProvider,
	},
	{
		pattern: /^onnx-community\/deepseek/i,
		Provider: DeepseekProvider,
	},
	{
		pattern: /^deepseek\//,
		Provider: DeepseekProvider,
	},
	{
		pattern: /^stabilityai\//,
		Provider: TransformersProvider,
	},
];

/**
 * Get the appropriate provider for a given model path
 */
export function getProvider(modelPath: string): BaseProvider {
	const entry = PROVIDER_REGISTRY.find(({ pattern }) => pattern.test(modelPath));
	return entry ? new entry.Provider() : new TransformersProvider();
}
