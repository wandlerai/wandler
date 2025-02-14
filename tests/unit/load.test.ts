import type { ModelOptions } from "../../packages/core/types/model";
import { loadModel } from "../../packages/core/utils/load";

// Mock transformers
jest.mock("@huggingface/transformers", () => ({
	AutoConfig: {
		from_pretrained: jest.fn().mockResolvedValue({
			model_type: "llama",
			architectures: ["LlamaForCausalLM"],
		}),
	},
	AutoTokenizer: {
		from_pretrained: jest.fn(),
	},
	AutoModelForCausalLM: {
		from_pretrained: jest.fn(),
	},
}));

// Mock internal modules
jest.mock("../../packages/core/utils/worker-manager", () => {
	const mockBridge = {
		setMessageHandler: jest.fn(),
		postMessage: jest.fn(),
		sendMessage: jest.fn().mockResolvedValue({ type: "success", payload: { id: "test-model" } }),
	};

	return {
		WorkerManager: {
			getInstance: jest.fn().mockReturnValue({
				canUseWorker: jest.fn().mockReturnValue(true),
				createWorker: jest.fn().mockResolvedValue({
					bridge: mockBridge,
				}),
			}),
		},
	};
});

jest.mock("../../packages/core/providers/registry", () => ({
	getProvider: jest.fn().mockReturnValue({
		getGenerationConfig: jest.fn().mockReturnValue({
			max_new_tokens: 1024,
			temperature: 0.7,
		}),
		getModelPerformance: jest.fn().mockReturnValue({
			supportsKVCache: true,
			groupedQueryAttention: false,
			recommendedDtype: "auto",
		}),
		loadModel: jest.fn().mockResolvedValue({
			id: "test-model",
		}),
	}),
}));

describe("loadModel", () => {
	it("should load a model with default options", async () => {
		const model = await loadModel("test/model");
		expect(model).toBeDefined();
		expect(model.id).toBe("test-model");
	});

	it("should load a model with custom options", async () => {
		const options: ModelOptions = {
			dtype: "q4f16",
			device: "webgpu",
		};
		const model = await loadModel("test/model", options);
		expect(model).toBeDefined();
		expect(model.id).toBe("test-model");
	});
});
