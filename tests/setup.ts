// Mock transformers.js
jest.mock("@huggingface/transformers", () => ({
	AutoConfig: {
		from_pretrained: jest.fn(),
	},
	AutoTokenizer: {
		from_pretrained: jest.fn(),
	},
	AutoModelForCausalLM: {
		from_pretrained: jest.fn(),
	},
	TextStreamer: jest.fn(),
}));

// Add custom matchers if needed
expect.extend({
	// Add custom matchers here
});
