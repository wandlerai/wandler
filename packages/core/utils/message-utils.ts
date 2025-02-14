/*
  This module provides shared utilities for handling messages across different generation functions.
  It includes functions for preparing messages from various input formats and handling complex
  message content types like images, files, and tool calls.
*/

import type { Message } from "@wandler/types/message";
import type {
	StreamingGenerationOptions,
	NonStreamingGenerationOptions,
} from "@wandler/types/generation";

type MessageOptions = StreamingGenerationOptions | NonStreamingGenerationOptions;

/**
 * Converts complex message content (images, files, tool calls) to text representation
 */
function convertComplexContent(content: any[]): string {
	return content
		.map(part => {
			switch (part.type) {
				case "text":
					return part.text;
				case "image":
					return `[Image: ${typeof part.image === "string" ? part.image : "binary data"}]`;
				case "file":
					return `[File: ${part.mimeType}]`;
				case "tool-call":
					return `[Tool Call: ${part.toolName}(${JSON.stringify(part.args)})]`;
				case "tool-result":
					return `[Tool Result: ${part.toolName} -> ${JSON.stringify(part.result)}]`;
				default:
					return JSON.stringify(part);
			}
		})
		.join("\n");
}

/**
 * Prepares a unified message array from various input options (system, prompt, messages)
 */
export function prepareMessages(options: MessageOptions): Message[] {
	const messages: Message[] = [];

	// Add system message if provided
	if (options.system) {
		messages.push({ role: "system", content: options.system } as Message);
	}

	// Add prompt as user message if provided
	if (options.prompt) {
		messages.push({ role: "user", content: options.prompt } as Message);
	}

	// Add provided messages with complex content handling
	if (options.messages) {
		messages.push(
			...options.messages.map(msg => ({
				role: msg.role as Message["role"],
				content: Array.isArray(msg.content) ? convertComplexContent(msg.content) : msg.content,
			}))
		);
	}

	return messages;
}

/**
 * Validates that the messages array is not empty and contains valid content
 */
export function validateMessages(messages: Message[]): void {
	if (messages.length === 0) {
		throw new Error(
			"No messages provided. Please provide either 'messages', 'system', or 'prompt'."
		);
	}

	// Validate each message has required fields
	messages.forEach((msg, index) => {
		if (!msg.role) {
			throw new Error(`Message at index ${index} is missing 'role'`);
		}
		if (msg.content === undefined || msg.content === null) {
			throw new Error(`Message at index ${index} is missing 'content'`);
		}
	});
}
