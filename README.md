# Wandler

<p align="center">
  <img src="assets/logo/wandler_logo_v4.svg" alt="Wandler Logo" width="900">
</p>

**Wandler empowers web developers to integrate powerful language AI into browsers with simplicity
and performance.**  
We provide a minimalist, privacy-focused abstraction layer over cutting-edge technologies
(Transformers.js + WebGPU) to enable:

## Key Features

1. **Zero-Config Intelligence**  
   Run state-of-the-art language models with one line of code

   ```typescript
   const ai = new Wandler();
   ai.text("Hello world");
   ```

2. **Browser-Native Performance**  
   Automatic WebGPU acceleration and KV caching for near-native speed

3. **Privacy by Default**  
   Client-side execution ensures data never leaves the user's device

## Installation

```bash
npm install wandler
```

## Quick Start

```typescript
import { Wandler } from "wandler";

// Initialize with default settings
const ai = new Wandler("meta-llama/Llama-2-7b-chat-hf");

// Basic text generation
const response = await ai.text([{ role: "user", content: "Hello, how are you?" }]);

// Streaming with progress updates
const streamingResponse = await ai.text([{ role: "user", content: "Tell me a story" }], {
	stream: true,
	onToken: token => console.log(token),
});
```

## Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Contributing

Contributions are welcome! Please read our [contributing guidelines](.github/CONTRIBUTING.md) for
details.

## License

This project is licensed under [MIT](LICENSE).
