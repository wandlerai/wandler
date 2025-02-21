# User Story: Extended generateText Output for Vercel AI SDK Compatibility

## Overview

Our current implementation of `generateText` returns a simple string containing only the generated
text. In contrast, the Vercel AI SDK returns a richer object that includes additional metadata such
as reasoning, sources, a finish reason, and usage details. This enhancement will provide developers
with more context around the generation process and make our API more compatible with integrations
expecting these extended properties.

## User Story

**As a developer**, I want the `generateText` function to return a structured result object that
includes not only the generated text, but also supplementary fields—including reasoning, sources,
finish reason, and usage metrics—so that I can leverage this additional context for debugging,
logging, and improved integration with other tools.

## Acceptance Criteria

- The `generateText` function must return an object with the following properties:
  - `text`: string (the generated text)
  - `reasoning`: string (optional, the internal reasoning provided by some models)
  - `sources`: Array (optional, sources that contributed to the generation)
  - `finishReason`: string (optional, explanation of why generation stopped)
  - `usage`: object (optional, metadata such as token counts or other usage metrics)
- Extended response fields must be supported in both worker and main thread generation flows.
- When an underlying model does not provide the additional metadata, the respective fields should be
  set to `null`.
- All relevant TypeScript interfaces and types are updated to include the new fields.
- Documentation and tests are updated to demonstrate and verify the extended functionality.

## Implementation Plan

1. **Extend Data Types**

   - Update the `TransformersGenerateResult` interface in `packages/wandler/types/generation.ts` to
     include the new fields: `reasoning`, `sources`, `finishReason`, and `usage`.

2. **Update Core Transformer Layer**

   - Modify `generateWithTransformers` in `packages/wandler/utils/transformers.ts` to extract the
     additional metadata from the model output.
   - Map the retrieved metadata to the new fields when constructing the result object.

3. **Modify Public API**

   - Change the implementation of `generateText` in `packages/wandler/utils/generate-text.ts` so
     that it returns a structured result object instead of just a string.
   - Ensure that the routing logic (worker-based and main thread-based paths) preserves and
     correctly propagates the extended fields.

4. **Update Worker Communication**

   - Adapt the worker message handling in `packages/wandler/worker/worker.ts` to include the
     extended fields in the response payload when sending the "generated" message.

5. **Documentation & Testing**
   - Update API documentation and examples to showcase the extended output object.
   - Update the e2e test "generate-text.test.ts" to validate that the additional fields are present
     and accurately reflect the generation output.

## Notes

- The extended output should not break existing consumers: if a model lacks extra metadata, those
  fields should be `null`
- We don't care about backward compatibility.
