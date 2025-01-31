import { TextStreamer } from "@huggingface/transformers";
import type { BaseModel } from "@wandler/types/model";
import type { Message } from "@wandler/types/message";
import type { StreamResult } from "@wandler/types/stream";
import type { WorkerMessage, WorkerResponse } from "@wandler/worker/types";

export async function generateText({
	model,
	messages,
}: {
	model: BaseModel;
	messages: Message[];
}): Promise<string> {
	if (!model.capabilities.textGeneration) {
		throw new Error(`Model ${model.id} doesn't support text generation`);
	}

	// Check if model is worker-based
	if (model.provider === "worker") {
		if (!model.worker?.bridge) {
			throw new Error("Worker bridge not found");
		}

		const message: WorkerMessage = {
			type: "generate",
			payload: { messages },
			id: `generate-${Date.now()}`,
		};

		const response = await model.worker.bridge.sendMessage(message);
		if (response.type === "error") {
			throw response.payload;
		}
		return response.payload;
	}

	// Main thread generation
	const inputs = model.tokenizer.apply_chat_template(messages, {
		add_generation_prompt: true,
		return_dict: true,
	});

	const { sequences } = await model.instance.generate({
		...inputs,
		...model.generationConfig,
	});

	return model.tokenizer.batch_decode(sequences, {
		skip_special_tokens: true,
	})[0];
}

export async function streamText({
	model,
	messages,
	options = {},
}: {
	model: BaseModel;
	messages: Message[];
	options?: {
		max_new_tokens?: number;
		do_sample?: boolean;
		temperature?: number;
		top_p?: number;
		repetition_penalty?: number;
	};
}): Promise<StreamResult<string>> {
	if (!model.capabilities.textGeneration) {
		throw new Error(`Model ${model.id} doesn't support text generation`);
	}

	// Check if model is worker-based
	if (model.provider === "worker") {
		if (!model.worker?.bridge) {
			throw new Error("Worker bridge not found");
		}

		let controller: ReadableStreamDefaultController<string>;
		const textStream = new ReadableStream<string>({
			start(c) {
				controller = c;
			},
		});

		const message: WorkerMessage = {
			type: "stream",
			payload: { messages, ...options },
			id: `stream-${Date.now()}`,
		};

		// Set up message handler for streaming
		model.worker.bridge.setMessageHandler((e: MessageEvent) => {
			if (e.data.type === "stream") {
				controller.enqueue(e.data.payload);
			} else if (e.data.type === "generated") {
				controller.close();
			} else if (e.data.type === "error") {
				controller.error(e.data.payload);
			}
		});

		// Start streaming
		const responsePromise = model.worker.bridge
			.sendMessage(message)
			.then((response: WorkerResponse) => {
				if (response.type === "error") {
					throw response.payload;
				}
				return response.payload;
			});

		return {
			textStream,
			[Symbol.asyncIterator]() {
				const reader = textStream.getReader();
				return {
					async next() {
						try {
							const { done, value } = await reader.read();
							if (done) return { done: true, value: undefined };
							return { done: false, value };
						} catch (e) {
							reader.releaseLock();
							throw e;
						}
					},
					async return() {
						reader.releaseLock();
						return { done: true, value: undefined };
					},
				};
			},
			response: responsePromise,
		};
	}

	// Main thread streaming
	let controller: ReadableStreamDefaultController<string>;
	const textStream = new ReadableStream<string>({
		start(c) {
			controller = c;
		},
	});

	const streamer = new TextStreamer(model.tokenizer, {
		skip_prompt: true,
		skip_special_tokens: true,
		callback_function: (token: string) => {
			controller.enqueue(token);
		},
	});

	const inputs = model.tokenizer.apply_chat_template(messages, {
		add_generation_prompt: true,
		return_dict: true,
	});

	const generationConfig = {
		...model.generationConfig,
		...options,
		return_dict_in_generate: true,
		output_scores: false,
		streamer,
	};

	// Start generation in the background
	const generatePromise = model.instance
		.generate({
			...inputs,
			...generationConfig,
		})
		.then((output: any) => {
			controller.close();
			// Handle both array and object responses
			const sequences = Array.isArray(output) ? output : output.sequences;
			if (!sequences) {
				throw new Error("No sequences in model output");
			}
			return model.tokenizer.batch_decode(sequences, {
				skip_special_tokens: true,
			})[0];
		});

	return {
		textStream,
		[Symbol.asyncIterator]() {
			const reader = textStream.getReader();
			return {
				async next() {
					try {
						const { done, value } = await reader.read();
						if (done) return { done: true, value: undefined };
						return { done: false, value };
					} catch (e) {
						reader.releaseLock();
						throw e;
					}
				},
				async return() {
					reader.releaseLock();
					return { done: true, value: undefined };
				},
			};
		},
		response: generatePromise,
	};
}
