import type { ModelCapabilities, ModelOptions, ModelPerformance } from "./model";

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
