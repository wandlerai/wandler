import type { Message } from "@wandler/types/message";

type MessageRole = Message["role"];

/**
 * Extracts individual messages from a tokenized chat output.
 * This is used to parse the raw model output back into structured messages.
 */
export function extractMessagesFromText(text: string): Message[] {
	const messages: Message[] = [];
	const lines = text.split("\n");

	let currentRole: MessageRole | null = null;
	let currentContent: string[] = [];

	for (const line of lines) {
		if (line === "system" || line === "user" || line === "assistant") {
			// Save previous message if exists
			if (currentRole && currentContent.length > 0) {
				messages.push({
					role: currentRole,
					content: currentContent.join("\n").trim(),
				});
				currentContent = [];
			}
			currentRole = line as MessageRole;
		} else if (currentRole) {
			currentContent.push(line);
		}
	}

	// Add final message
	if (currentRole && currentContent.length > 0) {
		messages.push({
			role: currentRole,
			content: currentContent.join("\n").trim(),
		});
	}

	return messages;
}

/**
 * Extracts just the assistant's response from a tokenized chat output.
 * This is used to get the generated response without the input context.
 */
export function extractAssistantMessageFromText(text: string): string {
	const messages = extractMessagesFromText(text);
	const lastMessage = messages[messages.length - 1];

	// The last message should be from the assistant
	if (lastMessage?.role === "assistant") {
		return lastMessage.content;
	}

	// Fallback: return everything after the last "assistant" marker
	const assistantIndex = text.lastIndexOf("\nassistant\n");
	if (assistantIndex !== -1) {
		return text.slice(assistantIndex + "\nassistant\n".length).trim();
	}

	// If all else fails, return the original text
	return text.trim();
}
