# useChat Hook: User Story

## Problem Statement

Developers building chat interfaces with Wandler face several challenges:

1. Managing stateful conversations with multiple messages
2. Handling streaming responses, including reasoning/thinking states
3. Properly displaying incomplete vs. complete messages
4. Managing the lifecycle of chat sessions
5. Handling edge cases like aborted responses

Currently, developers must manually implement all of these concerns, leading to duplicated effort,
inconsistent implementations, and potential bugs.

## User Needs

As a developer using Wandler, I want to:

- Focus on building my UI rather than managing chat state
- Have messages update in real-time as they stream
- Support special message types like reasoning/thinking
- Handle errors gracefully
- Easily control generation parameters
- Stop generation when needed
- Create a responsive chat UX with minimal effort

## Proposed Solution

Create a `useChat` React hook in `wandler/packages/react` that:

1. Manages the full lifecycle of chat messages
2. Automatically updates the messages array as responses stream in
3. Supports special message types (reasoning)
4. Provides a simple, predictable API for React applications

## API Design

```typescript
function useChat({
  model: BaseModel,
  initialMessages?: Message[],
  initialInput?: string,
  onError?: (error: Error) => void,
  onFinish?: (messages: Message[]) => void,
  abortOnUnmount?: boolean,
  generationOptions?: Partial<GenerationConfig>
}: UseChatOptions): UseChatHelpers
```

### Return Type (UseChatHelpers)

```typescript
interface UseChatHelpers {
	// State
	messages: ExtendedMessage[];
	isGenerating: boolean;
	input: string;
	error: Error | null;
	status: "submitted" | "streaming" | "ready" | "error";

	// Actions
	append: (message?: string | Message, options?: Partial<GenerationConfig>) => Promise<void>;
	clearChat: () => void;
	stop: () => void;
	setInput: (input: string) => void;
	setMessages: (
		messages: ExtendedMessage[] | ((current: ExtendedMessage[]) => ExtendedMessage[])
	) => void;

	// Convenience
	handleInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	handleSubmit: (e: React.FormEvent) => void;
}
```

### Message Structure

```typescript
interface ExtendedMessage extends Message {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	isComplete?: boolean; // Whether the message is complete or still streaming
	timestamp: number;
	metadata?: {
		reasoning?: string; // Reasoning content if available
		[key: string]: any; // Additional metadata
	};
}
```

## User Stories

### Basic Usage

```jsx
function ChatComponent({ model }) {
	const {
		messages,
		isGenerating,
		input,
		status,
		append,
		handleInputChange,
		handleSubmit,
	} = useChat({
		model,
		generationOptions: {
			temperature: 0.7,
		},
	});

	return (
		<div className="chat">
			<div className="messages">
				{messages.map(message => (
					<MessageBubble 
						key={message.id} 
						message={message} 
						isStreaming={status === "streaming" && message.role === "assistant" && !message.isComplete}
					/>
				))}
			</div>

			{status === "error" && <div className="error">An error occurred. Please try again.</div>}

			<div className="status-indicator">
				{status === "submitted" && <span>Submitting message...</span>}
				{status === "streaming" && <span>AI is responding...</span>}
				{status === "ready" && <span>Ready for your message</span>}
			</div>

			<form onSubmit={handleSubmit}>
				<input value={input} onChange={handleInputChange} disabled={isGenerating} />
				<button type="submit" disabled={isGenerating}>
					Send
				</button>
			</form>
		</div>
	);
}
```

### With Reasoning

```jsx
function AdvancedChatComponent({ model }) {
	const { messages, isGenerating, status, input, append } = useChat({ model });

	// Find the last assistant message that might be streaming
	const lastAssistantMessage = [...messages].reverse().find(m => m.role === "assistant");
	const isLastMessageStreaming = status === "streaming" && lastAssistantMessage && !lastAssistantMessage.isComplete;

	return (
		<div className="chat">
			<div className={`chat-status ${status}`}>
				{status === "submitted" && <LoadingDots text="Preparing response" />}
				{status === "streaming" && <ThinkingIndicator active={true} />}
				{status === "error" && <ErrorMessage retry={() => append(input)} />}
			</div>

			{messages.map(message => {
				if (message.metadata?.reasoning) {
					return (
						<ReasoningBubble 
							key={message.id} 
							text={message.metadata.reasoning} 
							isStreaming={status === "streaming" && message === lastAssistantMessage}
						/>
					);
				}
				return (
					<MessageBubble 
						key={message.id} 
						message={message} 
						isStreaming={status === "streaming" && message === lastAssistantMessage}
					/>
				);
			})}

			{/* Form and other UI elements */}
		</div>
	);
}
```

## Implementation Notes

1. The hook will use Wandler's streaming capabilities to generate responses
2. The messages array will automatically update as responses stream in
3. The last assistant message in the array will be updated in real-time during streaming
4. Reasoning/thinking will be stored in message metadata
5. Error handling should present user-friendly messages
6. The hook should clean up properly to avoid memory leaks
7. The `status` field follows a predictable lifecycle:
   - `"ready"` - Initial state, ready to accept new messages
   - `"submitted"` - Message has been submitted, waiting for the first response chunk
   - `"streaming"` - Receiving and processing response chunks
   - `"ready"` - Response completed successfully, ready for next message
   - `"error"` - An error occurred during processing

## Next Steps

1. Implement the `useChat` hook in `wandler/packages/react`
2. Create a demo component showcasing the hook under `tests/demo/useChat.tsx`
3. Create e2e tests to verify behavior under `wandler/tests/e2e`
4. Update documentation with examples under `site/app/docs/page.mdx`
