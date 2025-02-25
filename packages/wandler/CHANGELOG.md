# wandler

## 1.0.0-alpha.8

### Major Changes

- fix(worker): maybe this time?

## 1.0.0-alpha.7

### Major Changes

- fix(worker): find a way to load the worker

## 1.0.0-alpha.6

### Major Changes

- fix(worker): proper path to load the worker

## 1.0.0-alpha.5

### Major Changes

- - fix(worker): don't use relative path
  - feat: expose "selectBestDevice"

## 1.0.0-alpha.4

### Major Changes

- - fixed stream-text test reliability by ensuring only one concurrent worker runs on cpu
  - fixed broken documentation links
  - removed unused ingest functionality

## 1.0.0-alpha.4

### Major Changes

- - fixed stream-text test reliability by ensuring only one concurrent worker runs on cpu
  - fixed broken documentation links
  - removed unused ingest functionalit

## 1.0.0-alpha.3

### Major Changes

- docs: use url for all images

## 1.0.0-alpha.2

### Major Changes

- features

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

## 1.0.0-alpha.1

### Patch Changes

- - actually added the code into the release

## 1.0.0-alpha.0

### Major Changes

- - added `loadModel` to load a model
  - added provider `deepseek` to support "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX"
  - added `generateTexT` and `streamText` to interact with the model
