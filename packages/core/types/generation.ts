import type { BaseModel } from "./model";
import type { Message } from "./message";
import type { ToolSet } from "./stream";

/**
 * Core generation configuration shared by all generation methods.
 * These parameters control the actual text generation behavior.
 *
 * @public
 */
export interface GenerationConfig {
	/** Maximum number of tokens to generate (default: 1024) */
	max_new_tokens?: number;
	/** Whether to use sampling instead of greedy decoding */
	do_sample?: boolean;
	/** Sampling temperature (0-2, default: 1.0) */
	temperature?: number;
	/** Nucleus sampling parameter (0-1, default: 1.0) */
	top_p?: number;
	/** Repetition penalty (≥1, default: 1.1) */
	repetition_penalty?: number;
	/** Array of sequences to stop generation */
	stop?: string[];
	/** Random seed for reproducible generation */
	seed?: number;
}

/**
 * Common options shared between streaming and non-streaming generation.
 *
 * @public
 */
export interface BaseGenerationOptions {
	/** The language model to use for generation */
	model: BaseModel;
	/** Array of messages representing the conversation history */
	messages?: Message[];
	/** Optional system message to set model behavior */
	system?: string;
	/** Optional single prompt (alternative to messages) */
	prompt?: string;
	/** Maximum number of tokens to generate */
	maxTokens?: number;
	/** Sampling temperature (0-2) */
	temperature?: number;
	/** Nucleus sampling parameter (0-1) */
	topP?: number;
	/** Repetition penalty (≥1) */
	frequencyPenalty?: number;
	/** Array of sequences to stop generation */
	stopSequences?: string[];
	/** Random seed for reproducible generation */
	seed?: number;
	/** Number of retries on failure */
	maxRetries?: number;
	/** Signal to cancel generation */
	abortSignal?: AbortSignal;
}

/**
 * Tool-related options for generation.
 *
 * @public
 */
export interface ToolOptions {
	/** Optional tools the model can use */
	tools?: ToolSet;
	/** How the model should use tools */
	toolChoice?: "auto" | "none" | "required" | { type: "tool"; toolName: string };
	/** Maximum number of tool use steps */
	maxSteps?: number;
}

/**
 * Options specific to streaming text generation.
 * Extends base options with streaming-specific features like tools.
 *
 * @public
 */
export interface StreamingGenerationOptions extends BaseGenerationOptions, ToolOptions {}

/**
 * Options for non-streaming text generation.
 * Currently identical to base options, but may include
 * non-streaming specific options in the future.
 *
 * @public
 */
export interface NonStreamingGenerationOptions extends BaseGenerationOptions {}
