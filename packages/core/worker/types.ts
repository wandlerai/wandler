import type { ModelOptions } from "@wandler/types/model";
import type { Message } from "@wandler/types/message";
import type { WorkerBridge } from "./bridge";
import type { ModelPerformance } from "@wandler/types/model";

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
		// Generation options
		max_new_tokens?: number;
		do_sample?: boolean;
		temperature?: number;
		top_p?: number;
		repetition_penalty?: number;
	};
	id: string;
}

export interface WorkerResponse {
	type: WorkerResponseType;
	payload: any;
	id: string;
}

export interface WorkerError extends Error {
	code?: string;
}

export interface WorkerInstance {
	worker: Worker;
	bridge: WorkerBridge;
	terminate(): void;
	isTerminated: boolean;
}
