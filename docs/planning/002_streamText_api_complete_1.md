## User Story

As a developer, I want to extend my `streamText` function to be API-compatible with the `streamText`
function from the Vercel AI SDK, so that I can seamlessly integrate with and leverage the features
and functionalities offered by the Vercel AI SDK.

## Acceptance Criteria

- [ ] The `streamText` function should accept the following parameters:

  - [ ] `model`: `LanguageModel` (required) - The language model to use. Example:
        `openai('gpt-4-turbo')`
  - [ ] `system`: `string` (optional) - The system prompt to use that specifies the behavior of the
        model.
  - [ ] `prompt`: `string` (optional) - The input prompt to generate the text from.
  - [ ] `messages`:
        `Array<CoreSystemMessage | CoreUserMessage | CoreAssistantMessage | CoreToolMessage> | Array<UIMessage>`
        (optional) - A list of messages that represent a conversation. Automatically converts UI
        messages from the useChat hook.
    - [ ] `CoreSystemMessage`:
      - [ ] `role`: `'system'`
      - [ ] `content`: `string`
    - [ ] `CoreUserMessage`:
      - [ ] `role`: `'user'`
      - [ ] `content`: `string | Array<TextPart | ImagePart | FilePart>`
        - [ ] `TextPart`:
          - [ ] `type`: `'text'`
          - [ ] `text`: `string`
        - [ ] `ImagePart`:
          - [ ] `type`: `'image'`
          - [ ] `image`: `string | Uint8Array | Buffer | ArrayBuffer | URL`
          - [ ] `mimeType`: `string` (optional)
        - [ ] `FilePart`:
          - [ ] `type`: `'file'`
          - [ ] `data`: `string | Uint8Array | Buffer | ArrayBuffer | URL`
          - [ ] `mimeType`: `string`
    - [ ] `CoreAssistantMessage`:
      - [ ] `role`: `'assistant'`
      - [ ] `content`: `string | Array<TextPart | ToolCallPart>`
        - [ ] `TextPart`:
          - [ ] `type`: `'text'`
          - [ ] `text`: `string`
        - [ ] `ToolCallPart`:
          - [ ] `type`: `'tool-call'`
          - [ ] `toolCallId`: `string`
          - [ ] `toolName`: `string`
          - [ ] `args`: `object based on zod schema`
    - [ ] `CoreToolMessage`:
      - [ ] `role`: `'tool'`
      - [ ] `content`: `Array<ToolResultPart>`
        - [ ] `ToolResultPart`:
          - [ ] `type`: `'tool-result'`
          - [ ] `toolCallId`: `string`
          - [ ] `toolName`: `string`
          - [ ] `result`: `unknown`
          - [ ] `isError`: `boolean` (optional)
  - [ ] `tools`: `ToolSet` (optional) - Tools that are accessible to and can be called by the model.
        The model needs to support calling tools.
    - [ ] `Tool`:
      - [ ] `description`: `string` (optional) - Information about the purpose of the tool including
            details on how and when it can be used by the model.
      - [ ] `parameters`: `Zod Schema | JSON Schema` - The schema of the input that the tool
            expects.
      - [ ] `execute`: `async (parameters: T, options: ToolExecutionOptions) => RESULT` (optional) -
            An async function that is called with the arguments from the tool call and produces a
            result.
        - [ ] `ToolExecutionOptions`:
          - [ ] `toolCallId`: `string` - The ID of the tool call.
          - [ ] `messages`: `CoreMessage[]` - Messages that were sent to the language model to
                initiate the response that contained the tool call.
          - [ ] `abortSignal`: `AbortSignal` - An optional abort signal.
  - [ ] `toolChoice`: `"auto" | "none" | "required" | { "type": "tool", "toolName": string }`
        (optional) - The tool choice setting.
  - [ ] `maxTokens`: `number` (optional) - Maximum number of tokens to generate.
  - [ ] `temperature`: `number` (optional) - Temperature setting.
  - [ ] `topP`: `number` (optional) - Nucleus sampling.
  - [ ] `topK`: `number` (optional) - Only sample from the top K options for each subsequent token.
  - [ ] `presencePenalty`: `number` (optional) - Presence penalty setting.
  - [ ] `frequencyPenalty`: `number` (optional) - Frequency penalty setting.
  - [ ] `stopSequences`: `string[]` (optional) - Sequences that will stop the generation of the
        text.
  - [ ] `seed`: `number` (optional) - The seed (integer) to use for random sampling.
  - [ ] `maxRetries`: `number` (optional) - Maximum number of retries. Default: 2.
  - [ ] `abortSignal`: `AbortSignal` (optional) - An optional abort signal.
  - [ ] `headers`: `Record<string, string>` (optional) - Additional HTTP headers.
  - [ ] `maxSteps`: `number` (optional) - Maximum number of sequential LLM calls (steps).
        Default: 1.

- [ ] The `streamText` function should return a `ReadableStream`.
- [ ] The `streamText` function should respect the `abortSignal` and cancel the stream when the
      signal is aborted.
