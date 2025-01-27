import { TextStreamer } from "@huggingface/transformers";
import type { BaseModel } from "@wandler/types/model";
import type { Message } from "@wandler/types/message";
import type { StreamResult } from "@wandler/types/stream";
import type { GenerationConfig } from "@wandler/types/generation";

export async function generateText({
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
}): Promise<string> {
	if (!model.capabilities.textGeneration) {
		throw new Error(`Model ${model.id} doesn't support text generation`);
	}

	const inputs = model.tokenizer.apply_chat_template(messages, {
		add_generation_prompt: true,
		return_dict: true,
	});

	const generationConfig = {
		...model.generationConfig,
		...options,
	};

	const { sequences } = await model.instance.generate({
		...inputs,
		...generationConfig,
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