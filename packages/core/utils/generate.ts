import type { BaseModel } from "@wandler/types/model";
import type { Message } from "@wandler/types/message";
import type { WorkerMessage } from "@wandler/worker/types";

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
