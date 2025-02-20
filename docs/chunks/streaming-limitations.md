# Streaming Limitations

Text streaming with WASM **requires** Web Workers. The main thread will block during WASM execution,
preventing UI updates needed for streaming.

### Technical Details

This limitation exists because:

1. WASM execution blocks the main thread
2. Streaming requires both:
   - Continuous text generation processing
   - UI updates to show the streamed chunks
3. When running in the main thread with WASM, the thread is blocked during generation, preventing UI
   updates

### Recommendations

- Always use Web Workers for streaming text generation
- If you must use the main thread (e.g., in environments without Worker support):
  - Use `generateText` instead of `streamText`
  - Consider using WebGPU if available instead of WASM
  - Show a loading indicator during generation

### Code Example

```typescript
// ❌ Won't work - WASM blocks main thread
streamText({ model, useWorker: false, device: "wasm" });

// ✅ Use workers (default) or generateText() instead
streamText({ model }); // Uses worker
generateText({ model, useWorker: false }); // Blocks but works
```
