// External dependencies
import type { BaseModel, Message as BaseMessage } from "wandler";

import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { streamText } from "wandler";

/**
 * Message part types
 */
export type MessagePartType = "text" | "reasoning" | "tool_call" | "source";

/**
 * Base message part interface
 */
export interface MessagePart {
	type: MessagePartType;
}

/**
 * Text message part
 */
export interface TextMessagePart extends MessagePart {
	type: "text";
	text: string;
}

/**
 * Reasoning message part
 */
export interface ReasoningMessagePart extends MessagePart {
	type: "reasoning";
	reasoning: string;
}

/**
 * Tool call message part
 */
export interface ToolCallMessagePart extends MessagePart {
	type: "tool_call";
	tool: string;
	args: Record<string, unknown>;
}

/**
 * Source message part
 */
export interface SourceMessagePart extends MessagePart {
	type: "source";
	source: {
		url?: string;
		title?: string;
		[key: string]: unknown;
	};
}

/**
 * Union type of all message parts
 */
export type MessagePartUnion =
	| TextMessagePart
	| ReasoningMessagePart
	| ToolCallMessagePart
	| SourceMessagePart;

/**
 * Enhanced message type with additional properties
 * Aligned with Vercel AI SDK's message structure
 */
export interface Message {
	/** Unique ID for the message */
	id: string;
	/** Role of the message sender: user, assistant, or system */
	role: "user" | "assistant" | "system";
	/** The main content of the message */
	content: string;
	/** Whether the message generation is complete */
	isComplete?: boolean;
	/** Timestamp when the message was created (in milliseconds) */
	createdAt: number;
	/** Optional array of structured message parts */
	parts?: MessagePartUnion[];
	/** Optional data associated with the message */
	data?: Record<string, unknown>;
	/** Optional annotations for the message */
	annotations?: Array<{
		type: string;
		[key: string]: unknown;
	}>;
	/** Optional tool invocations */
	toolInvocations?: Array<{
		id: string;
		type: string;
		input: Record<string, unknown>;
		state: "created" | "running" | "done" | "error";
		output?: unknown;
		error?: string;
	}>;
}

/**
 * Stream chunk type
 */
export interface StreamChunk {
	type: string;
	text?: string;
}

/**
 * Generation config type
 */
export interface GenerationConfig {
	temperature?: number;
	maxTokens?: number;
	topP?: number;
	frequencyPenalty?: number;
	presencePenalty?: number;
	stopSequences?: string[];
	[key: string]: unknown;
}

/**
 * Options for the useChat hook
 */
export interface UseChatOptions {
	/** The model to use for generation */
	model: BaseModel;
	/** Initial messages to populate the chat */
	initialMessages?: BaseMessage[];
	/** Initial value for the input field */
	initialInput?: string;
	/** Callback when an error occurs */
	onError?: (error: Error) => void;
	/** Callback when generation finishes */
	onFinish?: (messages: Message[]) => void;
	/** Whether to abort the request when the component unmounts */
	abortOnUnmount?: boolean;
	/** Additional options for generation */
	generationOptions?: Partial<GenerationConfig>;
}

/**
 * Helper functions for the useChat hook
 */
export interface UseChatHelpers {
	/** Current messages in the chat */
	messages: Message[];
	/** The error object of the API request */
	error: Error | null;
	/** Whether the API request is in progress */
	isLoading: boolean;
	/** The current input value */
	input: string;
	/** Function to handle form submission */
	handleSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
	/** Function to handle input change */
	handleInputChange: (
		e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>
	) => void;
	/** Function to set input value */
	setInput: React.Dispatch<React.SetStateAction<string>>;
	/** Function to clear messages */
	clearMessages: () => void;
	/** Function to stop the AI response */
	stop: () => void;
	/**
	 * Status of the chat:
	 * - idle: No request is in progress
	 * - loading: Request submitted, waiting for first chunk
	 * - streaming: Receiving chunks from the API
	 * - error: An error occurred
	 */
	status: "idle" | "loading" | "streaming" | "error";
	/** The current model being used */
	model: BaseModel;
	/** Function to add a message to the chat */
	addMessage: (message: BaseMessage) => void;
	/** Function to add a part to the last assistant message */
	addMessagePart: (part: MessagePartUnion) => void;
	/** The ID of the chat */
	id: string;
}

/**
 * A React hook for creating a chat interface
 */
export function useChat({
	model,
	initialMessages = [],
	initialInput = "",
	onError,
	onFinish,
	abortOnUnmount = true,
	generationOptions = {},
}: UseChatOptions): UseChatHelpers {
	// Generate a unique ID for this chat instance
	const [id] = useState(() => uuidv4());

	const [messages, setMessages] = useState<Message[]>(() => {
		// Map initial messages to Message format
		const mappedMessages = initialMessages.map(msg => ({
			...msg,
			id: uuidv4(),
			isComplete: true,
			createdAt: Date.now(),
		}));
		return mappedMessages;
	});
	const [input, setInput] = useState(initialInput);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const [status, setStatus] = useState<"idle" | "loading" | "streaming" | "error">("idle");
	const abortControllerRef = useRef<AbortController | null>(null);

	// Clean up the abort controller on unmount
	useEffect(() => {
		return () => {
			if (abortOnUnmount) {
				abortControllerRef.current?.abort();
			}
		};
	}, [abortOnUnmount]);

	/**
	 * Add a message to the chat
	 */
	const addMessage = useCallback((message: BaseMessage) => {
		setMessages(prevMessages => [
			...prevMessages,
			{
				...message,
				id: uuidv4(),
				isComplete: true,
				createdAt: Date.now(),
			},
		]);
	}, []);

	/**
	 * Add a part to the last assistant message
	 */
	const addMessagePart = useCallback((part: MessagePartUnion) => {
		setMessages(prevMessages => {
			const updatedMessages = [...prevMessages];
			const lastAssistantIndex = updatedMessages
				.map((msg, index) => ({ msg, index }))
				.filter(({ msg }) => msg.role === "assistant")
				.pop()?.index;

			if (lastAssistantIndex !== undefined) {
				const prevParts = updatedMessages[lastAssistantIndex].parts || [];
				updatedMessages[lastAssistantIndex] = {
					...updatedMessages[lastAssistantIndex],
					parts: [...prevParts, part],
				};
			}
			return updatedMessages;
		});
	}, []);

	/**
	 * Clear all messages
	 */
	const clearMessages = useCallback(() => {
		setMessages([]);
	}, []);

	/**
	 * Stop the AI response
	 */
	const stop = useCallback(() => {
		if (abortControllerRef.current) {
			abortControllerRef.current.abort();
			abortControllerRef.current = null;
		}

		// Update the last assistant message to mark it as complete
		setMessages(prevMessages => {
			const updatedMessages = [...prevMessages];
			const lastAssistantIndex = updatedMessages
				.map((msg, index) => ({ msg, index }))
				.filter(({ msg }) => msg.role === "assistant")
				.pop()?.index;

			if (lastAssistantIndex !== undefined) {
				updatedMessages[lastAssistantIndex] = {
					...updatedMessages[lastAssistantIndex],
					isComplete: true,
				};
			}
			return updatedMessages;
		});

		setStatus("idle");
		setIsLoading(false);
	}, []);

	/**
	 * Handle form submission
	 */
	const handleSubmit = useCallback(
		async (e: React.FormEvent<HTMLFormElement>) => {
			e.preventDefault();

			// Don't do anything if input is empty or loading
			if (!input.trim() || isLoading) {
				return;
			}

			// Create a new abort controller for this request
			if (abortControllerRef.current) {
				abortControllerRef.current.abort();
			}
			abortControllerRef.current = new AbortController();

			// Create the user message
			const content = input.trim();
			const userMessage: Message = {
				role: "user",
				content,
				id: uuidv4(),
				isComplete: true,
				createdAt: Date.now(),
			};

			// Add user message to chat
			setMessages(prevMessages => [...prevMessages, userMessage]);
			setInput("");
			setIsLoading(true);
			setStatus("loading");
			setError(null);

			try {
				// Create the assistant message (empty initially)
				const assistantMessage: Message = {
					role: "assistant",
					content: "",
					id: uuidv4(),
					isComplete: false,
					createdAt: Date.now(),
				};

				// Get all current messages from state before adding the assistant message
				const currentMessages = [...messages, userMessage];

				// Add the assistant message to the chat
				setMessages(prevMessages => [...prevMessages, assistantMessage]);
				setStatus("streaming");

				// Convert Messages to BaseMessages for the model
				const messagesToSend: BaseMessage[] = currentMessages.map(msg => ({
					role: msg.role,
					content: msg.content,
				}));

				// Stream the response from the model
				const { result } = await streamText({
					model,
					messages: messagesToSend,
					abortSignal: abortControllerRef.current.signal,
					...generationOptions,
					onChunk: (chunk: StreamChunk) => {
						if (chunk.type === "text" || chunk.type === "text-delta") {
							// Update the assistant message with the new content
							setMessages(prevMessages => {
								const updatedMessages = [...prevMessages];
								const assistantMessageIndex = updatedMessages.findIndex(
									msg => msg.id === assistantMessage.id
								);

								if (assistantMessageIndex !== -1) {
									const prevContent = updatedMessages[assistantMessageIndex].content;
									updatedMessages[assistantMessageIndex] = {
										...updatedMessages[assistantMessageIndex],
										content: prevContent + (chunk.text || ""),
									};
								}

								return updatedMessages;
							});
						} else if (chunk.type === "reasoning") {
							// Update reasoning in parts
							setMessages(prevMessages => {
								const updatedMessages = [...prevMessages];
								const assistantMessageIndex = updatedMessages.findIndex(
									msg => msg.id === assistantMessage.id
								);

								if (assistantMessageIndex !== -1) {
									// Check if there's already a reasoning part
									const prevParts = updatedMessages[assistantMessageIndex].parts || [];
									const reasoningPartIndex = prevParts.findIndex(part => part.type === "reasoning");

									if (reasoningPartIndex !== -1) {
										// Update existing reasoning part
										const updatedParts = [...prevParts];
										const reasoningPart = updatedParts[reasoningPartIndex] as ReasoningMessagePart;
										updatedParts[reasoningPartIndex] = {
											...reasoningPart,
											reasoning: reasoningPart.reasoning + (chunk.text || ""),
										};

										updatedMessages[assistantMessageIndex] = {
											...updatedMessages[assistantMessageIndex],
											parts: updatedParts,
										};
									} else {
										// Add new reasoning part
										const newPart: ReasoningMessagePart = {
											type: "reasoning",
											reasoning: chunk.text || "",
										};

										updatedMessages[assistantMessageIndex] = {
											...updatedMessages[assistantMessageIndex],
											parts: [...prevParts, newPart],
										};
									}
								}

								return updatedMessages;
							});
						}
					},
				});

				// Wait for the result Promise to resolve, which indicates streaming is complete
				await result.then(generationResult => {
					// Mark the assistant message as complete
					setMessages(prevMessages => {
						const updatedMessages = [...prevMessages];
						const assistantMessageIndex = updatedMessages.findIndex(
							msg => msg.id === assistantMessage.id
						);

						if (assistantMessageIndex !== -1) {
							updatedMessages[assistantMessageIndex] = {
								...updatedMessages[assistantMessageIndex],
								isComplete: true,
							};
						}

						return updatedMessages;
					});

					// Reset state
					setIsLoading(false);
					setStatus("idle");
					abortControllerRef.current = null;

					// Call onFinish callback if provided
					if (onFinish) {
						const allMessages = [
							...messages,
							userMessage,
							{
								...assistantMessage,
								isComplete: true,
							},
						];
						onFinish(allMessages);
					}
				});
			} catch (err: unknown) {
				setError(err instanceof Error ? err : new Error(String(err)));
				setStatus("error");
				setIsLoading(false);
				abortControllerRef.current = null;

				// Call onError callback if provided
				if (onError && err instanceof Error) {
					onError(err);
				}
			}
		},
		[input, isLoading, messages, model, onError, onFinish, generationOptions]
	);

	/**
	 * Handle input change
	 */
	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement> | React.ChangeEvent<HTMLTextAreaElement>) => {
			setInput(e.target.value);
		},
		[]
	);

	return {
		messages,
		input,
		handleInputChange,
		handleSubmit,
		isLoading,
		error,
		setInput,
		stop,
		clearMessages,
		status,
		model,
		addMessage,
		addMessagePart,
		id,
	};
}
