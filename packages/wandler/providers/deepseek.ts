import type { ModelConfig } from "@wandler/types/model";
import type { ReverseTemplateResult } from "@wandler/types/provider";

import { BaseProvider } from "@wandler/providers/base";

export class DeepseekProvider extends BaseProvider {
	// Base configuration for all DeepSeek models
	protected baseConfig: ModelConfig = {
		dtype: "q4f16",
		device: "best",
		generationConfig: {
			max_new_tokens: 1024,
			do_sample: false,
			temperature: 1.0,
			top_p: 1.0,
			repetition_penalty: 1.1,
		},
		performance: {
			supportsKVCache: false,
			groupedQueryAttention: false,
			recommendedDtype: "auto",
		},
	};

	// Model-specific configurations that override the base config
	protected modelConfigs: Record<string, Partial<ModelConfig>> = {
		"onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX": {
			dtype: "q4f16",
			generationConfig: {
				max_new_tokens: 2048,
				temperature: 0.7,
				top_p: 0.95,
			},
			performance: {
				supportsKVCache: false,
				recommendedDtype: "q4f16",
			},
		},
	};

	/**
	 * DeepSeek uses a specific chat template format:
	 * <｜tool▁outputs▁begin｜>{user message}<｜tool▁outputs▁end｜>{assistant message}
	 * It may also include <think> tags for reasoning
	 */
	public override reverseTemplate(formattedOutput: string): ReverseTemplateResult {
		const messages = [];
		let reasoning: string | null = null;

		// Split by role markers
		const parts = formattedOutput.split(/<｜(User|Assistant)｜>/);

		// Remove empty first element if exists
		if (parts[0] === "") {
			parts.shift();
		}

		// Process pairs of role and content
		for (let i = 0; i < parts.length; i += 2) {
			const role = parts[i].toLowerCase();
			let content = parts[i + 1] || "";

			// Extract think content if present
			const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
			if (thinkMatch && role === "assistant") {
				reasoning = thinkMatch[1].trim();
				// Remove the think block from content
				content = content.replace(/<think>[\s\S]*?<\/think>/, "");
			}

			// Clean up content
			content = content
				.replace(/<｜(User|Assistant)｜>/g, "") // Remove any nested markers
				.replace(/\*\*/g, "") // Remove bold markers
				.trim();

			if (content) {
				messages.push({
					role: role as "user" | "assistant",
					content,
				});
			}
		}

		return {
			messages,
			reasoning,
			sources: null, // DeepSeek doesn't have source citations
		};
	}
}
