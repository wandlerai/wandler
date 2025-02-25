import type { TextStreamPart } from "@wandler/types/generation";
import type { Message } from "@wandler/types/message";
import type { ModelOptions, ModelPerformance } from "@wandler/types/model";

export type WorkerMessageType = "load" | "generate" | "stream" | "terminate" | "reset";
export type WorkerResponseType = "loaded" | "generated" | "stream" | "error" | "progress" | "reset";

export interface WorkerMessage {
	type: WorkerMessageType;
	payload: {
		modelPath?: string;
		options?: ModelOptions & {
			generationConfig?: Record<string, any>;
			performance?: ModelPerformance;
		};
		messages?: Message[];
		max_new_tokens?: number;
		do_sample?: boolean;
		temperature?: number;
		top_p?: number;
		repetition_penalty?: number;
		stop?: string[];
		seed?: number;
		aborted?: boolean;
	};
	id: string;
}

export interface WorkerResponse {
	type: WorkerResponseType;
	payload: WorkerResponsePayload;
	id: string;
}

export type WorkerResponsePayload =
	| TextStreamPart // For stream events
	| null // For completion events
	| {
			// For generation results
			text: string;
			reasoning: string | null;
			sources: string[] | null;
			finishReason: string | null;
			usage: {
				promptTokens?: number;
				completionTokens?: number;
				totalTokens?: number;
			} | null;
			messages: Message[] | null;
	  }
	| {
			// For load results
			id: string;
			provider: string;
			capabilities: {
				textGeneration: boolean;
				textClassification: boolean;
				imageGeneration: boolean;
				audioProcessing: boolean;
				vision: boolean;
			};
			performance: ModelPerformance;
			config: Record<string, any>;
	  }
	| {
			// For progress updates
			status: string;
			loaded?: number;
			total?: number;
			file?: string;
	  }
	| Error; // For error events

export interface WorkerInstance {
	bridge: WorkerBridge;
	worker: Worker;
	terminate(): void;
	sendMessage(message: WorkerMessage): Promise<WorkerResponse>;
}

export interface WorkerBridge {
	sendMessage(message: WorkerMessage): Promise<WorkerResponse>;
	setMessageHandler(handler: (event: MessageEvent) => void): void;
	terminate(): void;
}
