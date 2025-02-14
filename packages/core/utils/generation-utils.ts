/*
  This module provides shared utilities for handling generation configuration across different
  generation functions. It ensures consistent defaults and option handling between streaming
  and non-streaming generation.
*/

import type { BaseModel } from "@wandler/types/model";
import type { GenerateConfig } from "./transformers";
import type {
	StreamingGenerationOptions,
	NonStreamingGenerationOptions,
} from "@wandler/types/generation";

type GenerationOptions = StreamingGenerationOptions | NonStreamingGenerationOptions;

/**
 * Prepares a unified generation config from various input options, using model defaults when available
 */
export function prepareGenerationConfig(options: GenerationOptions): GenerateConfig {
	const model = options.model;

	return {
		// Core generation options
		max_new_tokens: options.maxTokens ?? model.generationConfig?.max_new_tokens ?? 1024,
		temperature: options.temperature ?? model.generationConfig?.temperature ?? 1.0,
		top_p: options.topP ?? model.generationConfig?.top_p ?? 1.0,
		do_sample: options.temperature !== undefined || options.topP !== undefined,
		repetition_penalty:
			options.frequencyPenalty ?? model.generationConfig?.repetition_penalty ?? 1.1,
		stop: options.stopSequences,
		seed: options.seed,

		// Tool-related options (only available in StreamingGenerationOptions)
		...(isStreamTextOptions(options) && {
			tools: options.tools,
			tool_choice: options.toolChoice,
			max_steps: options.maxSteps ?? 1,
		}),
	};
}

/**
 * Type guard to check if options are StreamingGenerationOptions
 */
function isStreamTextOptions(options: GenerationOptions): options is StreamingGenerationOptions {
	return "tools" in options || "toolChoice" in options || "maxSteps" in options;
}

/**
 * Validates generation config values are within acceptable ranges
 */
export function validateGenerationConfig(config: GenerateConfig): void {
	if (config.max_new_tokens !== undefined && config.max_new_tokens <= 0) {
		throw new Error("max_new_tokens must be greater than 0");
	}
	if (config.temperature !== undefined && (config.temperature < 0 || config.temperature > 2)) {
		throw new Error("temperature must be between 0 and 2");
	}
	if (config.top_p !== undefined && (config.top_p < 0 || config.top_p > 1)) {
		throw new Error("top_p must be between 0 and 1");
	}
	if (config.repetition_penalty !== undefined && config.repetition_penalty < 1) {
		throw new Error("repetition_penalty must be greater than or equal to 1");
	}
	if (config.max_steps !== undefined && config.max_steps < 1) {
		throw new Error("max_steps must be greater than 0");
	}
}
