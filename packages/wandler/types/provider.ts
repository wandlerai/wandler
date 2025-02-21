import type { Message } from "@wandler/types/message";
import type { ModelCapabilities, ModelOptions, ModelPerformance } from "@wandler/types/model";

/**
 * Resolved configuration after merging all settings following the priority chain:
 * 1. User Options
 * 2. Model-Specific Config
 * 3. Device-Specific Config
 * 4. Provider Base Config
 * 5. System Recommendations
 */
export interface ResolvedConfig {
	options: ModelOptions;
	generation: Record<string, any>;
	performance: ModelPerformance;
	capabilities: ModelCapabilities;
	modelConfig: Record<string, any>;
}

export interface ReverseTemplateResult {
	messages: Message[];
	reasoning?: string | null;
	sources?: string[] | null;
}
