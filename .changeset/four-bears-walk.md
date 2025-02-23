---
"wandler": major
---

features

- extended `streamText` with enhanced streaming capabilities:
  - `textStream` for basic text streaming
  - `fullStream` for structured events (text, reasoning, sources)
  - `result` promise for complete generation output
- enhanced `generateText` with comprehensive results:
  - text output
  - model reasoning
  - message history
  - source citations
  - finish reason
  - token usage statistics
- added automatic device selection with `device: "best"` option
- improved web worker support for better performance
- aligned api with vercel ai sdk for better compatibility

testing

- added comprehensive e2e tests for core functions
- implemented unit test setup
- optimized test performance:
  - limited to 2 workers max
  - removed unnecessary retries
  - improved error handling

documentation

- updated documentation to reflect experimental status
- added warning about webassembly limitations
- improved api documentation and examples
- new branding: "run ai in your browser"
- new logo and hero image

technical improvements

- renamed core package to "wandler"
- added next.js specific optimizations
- simplified provider architecture
- implemented eslint and fixed code style issues
