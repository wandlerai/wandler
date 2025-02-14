import type { BaseModel } from "./model";

export interface LanguageModel extends BaseModel {
	name: string;
}

export interface CoreSystemMessage {
	role: "system";
	content: string;
}

export interface TextPart {
	type: "text";
	text: string;
}

export interface ImagePart {
	type: "image";
	image: string | Uint8Array | Buffer | ArrayBuffer | URL;
	mimeType?: string;
}

export interface FilePart {
	type: "file";
	data: string | Uint8Array | Buffer | ArrayBuffer | URL;
	mimeType: string;
}

export interface CoreUserMessage {
	role: "user";
	content: string | Array<TextPart | ImagePart | FilePart>;
}

export interface ToolCallPart {
	type: "tool-call";
	toolCallId: string;
	toolName: string;
	args: Record<string, any>;
}

export interface CoreAssistantMessage {
	role: "assistant";
	content: string | Array<TextPart | ToolCallPart>;
}

export interface ToolResultPart {
	type: "tool-result";
	toolCallId: string;
	toolName: string;
	result: unknown;
	isError?: boolean;
}

export interface CoreToolMessage {
	role: "tool";
	content: ToolResultPart[];
}

export interface UIMessage {
	id: string;
	role: string;
	content: string;
}

export type CoreMessage =
	| CoreSystemMessage
	| CoreUserMessage
	| CoreAssistantMessage
	| CoreToolMessage;

export interface ToolExecutionOptions {
	toolCallId: string;
	messages: CoreMessage[];
	abortSignal?: AbortSignal;
}

export interface Tool {
	description?: string;
	parameters: Record<string, any>; // Could be a Zod schema or JSON Schema in practice
	execute?: (parameters: any, options: ToolExecutionOptions) => Promise<any>;
}

export interface ToolSet {
	[toolName: string]: Tool;
}

export interface StreamTextOptions {
	model: LanguageModel;
	system?: string;
	prompt?: string;
	messages?: Array<
		CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage | UIMessage
	>;
	tools?: ToolSet;
	toolChoice?: "auto" | "none" | "required" | { type: "tool"; toolName: string };
	maxTokens?: number;
	temperature?: number;
	topP?: number;
	topK?: number;
	presencePenalty?: number;
	frequencyPenalty?: number;
	stopSequences?: string[];
	seed?: number;
	maxRetries?: number;
	abortSignal?: AbortSignal;
	headers?: Record<string, string>;
	maxSteps?: number;
}

export interface StreamResult<T> {
	textStream: ReadableStream<T>;
	[Symbol.asyncIterator](): AsyncIterator<T>;
	response: Promise<string>;
}
