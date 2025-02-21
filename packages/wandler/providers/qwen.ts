import type { Message } from "@wandler/types/message";
import type { ModelConfig } from "@wandler/types/model";
import type { ReverseTemplateResult } from "@wandler/types/provider";

import { BaseProvider } from "@wandler/providers/base";

export class QwenProvider extends BaseProvider {
	// Base configuration for all Qwen models
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
		"onnx-community/Qwen2.5-Coder-0.5B-Instruct": {
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
	 * Qwen uses a simple chat format with role markers like:
	 * system
	 * You are a helpful AI assistant.
	 * user
	 * Hello!
	 * assistant
	 * Hi there! How can I help you today?
	 */
	public override reverseTemplate(formattedOutput: string): ReverseTemplateResult {
		const messages: Message[] = [];
		const lines = formattedOutput.split("\n");

		let currentRole: Message["role"] | null = null;
		let currentContent: string[] = [];

		// Basic role detection patterns
		const rolePatterns = {
			system: /^(system|<\|system\|>)/i,
			user: /^(user|<\|user\|>|human)/i,
			assistant: /^(assistant|<\|assistant\|>|bot)/i,
		};

		for (const line of lines) {
			const trimmedLine = line.trim();
			if (!trimmedLine) continue;

			// Check for role markers
			let foundRole = false;
			for (const [role, pattern] of Object.entries(rolePatterns)) {
				if (pattern.test(trimmedLine)) {
					// Save previous message if exists
					if (currentRole && currentContent.length > 0) {
						messages.push({
							role: currentRole,
							content: currentContent.join("\n").trim(),
						});
					}
					currentRole = role as Message["role"];
					currentContent = [];
					foundRole = true;
					break;
				}
			}

			// If no role found, add to current content
			if (!foundRole && currentRole) {
				currentContent.push(trimmedLine);
			}
		}

		// Add final message
		if (currentRole && currentContent.length > 0) {
			messages.push({
				role: currentRole,
				content: currentContent.join("\n").trim(),
			});
		}

		return {
			messages,
			reasoning: null,
			sources: null,
		};
	}
}
