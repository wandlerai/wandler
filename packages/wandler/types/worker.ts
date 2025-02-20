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
	};
	id: string;
}

export interface WorkerResponse {
	type: WorkerResponseType;
	payload: any;
	id: string;
}

export interface WorkerInstance {
	bridge: WorkerBridge;
	worker: Worker;
	terminate(): void;
}

export interface WorkerBridge {
	sendMessage(message: WorkerMessage): Promise<WorkerResponse>;
	setMessageHandler(handler: (event: MessageEvent) => void): void;
	terminate(): void;
}
