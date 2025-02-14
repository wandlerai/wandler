import type { BaseModel } from "@wandler/types/model";

export interface GenerationOptions {
	max_new_tokens?: number;
	temperature?: number;
	top_p?: number;
	do_sample?: boolean;
	repetition_penalty?: number;
	stop?: string[];
	seed?: number;
}

export function getGenerationDefaults(
	options: GenerationOptions,
	model: BaseModel
): Required<Omit<GenerationOptions, "stop" | "seed">> {
	return {
		max_new_tokens: options.max_new_tokens ?? model.generationConfig?.max_new_tokens ?? 100,
		temperature: options.temperature ?? model.generationConfig?.temperature ?? 1.0,
		top_p: options.top_p ?? model.generationConfig?.top_p ?? 1.0,
		do_sample:
			options.do_sample ?? (options.temperature !== undefined || options.top_p !== undefined),
		repetition_penalty:
			options.repetition_penalty ?? model.generationConfig?.repetition_penalty ?? 1.0,
	};
}

export function createGenerationConfig(
	options: GenerationOptions,
	model: BaseModel,
	additionalConfig: Record<string, any> = {}
) {
	return {
		...getGenerationDefaults(options, model),
		stop: options.stop,
		seed: options.seed,
		...additionalConfig,
	};
}
