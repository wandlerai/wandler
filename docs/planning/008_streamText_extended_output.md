# User Story: Extended streamText Output for Vercel AI SDK Compatibility

## Overview

Our current implementation of `streamText` streams generated text as plain text chunks. To align
with the extended output provided by the Vercel AI SDK and our enhanced `generateText`
functionality, we need to enrich `streamText` with additional metadata. This involves introducing a
new `fullStream` property that provides a detailed event stream. Developers will receive not only
text deltas but also reasoning updates, source events, and other structured data during the
generation process.

By offering a richer streaming interface, developers can integrate advanced debugging, logging, and
UI features, enabling a deeper understanding of the generation process.

## User Story

**As a developer**, I want the `streamText` function to return both the traditional `textStream` and
a new `fullStream` that streams structured events (including text deltas, reasoning updates, and
sources) so that I can leverage full insights into the model's output and better integrate with
tools expecting extended streaming data.

## Acceptance Criteria

- The `streamText` function must return an object with at least two properties:
  - `textStream`: a ReadableStream<string> — as currently implemented, streaming plain text chunks.
  - `fullStream`: an object that is both an AsyncIterable<TextStreamPart> and a
    ReadableStream<TextStreamPart> — streaming structured events.
- The structured events emitted by `fullStream` (TextStreamPart objects) must support the following
  types:
  - **Text Delta**
    - `type`: `"text-delta"`
    - `textDelta`: string
  - **Reasoning**
    - `type`: `"reasoning"`
    - `textDelta`: string
  - **Source**
    - `type`: `"source"`
    - `source`: Source (as defined in our types)
- If applicable, the `fullStream` should also include other event types (e.g., tool calls or
  results) following similar structure.
- Both worker-based and main thread generation flows must support the extended stream output.
- Errors should be propagated such that only critical issues (like network failures) abort the
  stream, while partial updates (e.g., incremental reasoning) are emitted as regular events.
- When the underlying model does not provide extra metadata for a specific event type, those fields
  should be omitted or set to `null`.

## Implementation Plan

1. **Extend Data Types**
   - Update the `TransformersGenerateResult` and related interfaces in
     `packages/wandler/types/generation.ts` to include:
     - A new `TextStreamPart` interface with a union type for the `type` property (i.e.,
       `"text-delta" | "reasoning" | "source" | ...`).
     - The corresponding properties for each event type:
       - For `"text-delta"`: a `textDelta` property of type string.
       - For `"reasoning"`: a `textDelta` property of type string.
       - For `"source"`: a `source` property typed as Source.
2. **Update Core Transformer Layer**
   - Modify `generateWithTransformers` in `packages/wandler/utils/transformers.ts` so that it
     extracts and maps any additional metadata from the model output into structured
     `TextStreamPart` objects.
   - Ensure the core generation logic can emit detailed events via a callback.
3. **Modify Public API**
   - Update the implementation in `packages/wandler/utils/stream-text.ts`:
     - Extend the return type of `streamText` to include a `fullStream` along with the existing
       `textStream`.
     - Instantiate `fullStream` such that it implements both AsyncIterable and ReadableStream
       interfaces.
     - Ensure both streams are correctly instantiated in both worker and main-thread paths.
4. **Adapt Worker Communication**
   - Update the worker handling in `packages/wandler/worker/worker.ts` so that when processing
     stream requests, it forwards the detailed events (text deltas, reasoning, sources, etc.) to the
     client.
   - Ensure that the worker sends a clear completion message only once and correctly routes error
     messages.
5. **Documentation & Testing**
   - Update the API documentation to include examples for using `fullStream`.
   - Update and add e2e tests (similar to our existing generateText tests) to verify that:
     - `fullStream` emits the correct sequence of `TextStreamPart` events.
     - Both interfaces (AsyncIterable and ReadableStream) work as expected.
     - Extended metadata is correctly set or omitted based on model output.
   - Ensure that any changes align with our conventions as defined in `conventions.md`.

## Notes

- The introduction of `fullStream` is intended to provide enhanced visibility into the generation
  process while preserving backward compatibility for consumers of `textStream`.
- Extended stream events should facilitate incremental processing and advanced UI integrations.
- Maintain robust error handling to ensure that only irrecoverable errors halt the stream.
- Follow the established coding conventions and DRY principles as detailed in our documentation.
