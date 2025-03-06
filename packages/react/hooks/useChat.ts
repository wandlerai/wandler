import { useCallback, useEffect, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
// @ts-ignore - Import wandler directly
import { streamText } from "wandler";

/**
 * Basic message type
 */
export interface Message {
	role: "user" | "assistant" | "system";
	content: string;
}

/**
 * Extended message type with additional properties for chat UI
 */
export interface ExtendedMessage {
	id: string;
	role: "user" | "assistant" | "system";
	content: string;
	isComplete?: boolean;
	timestamp: number;
	metadata?: {
		reasoning?: string;
		[key: string]: any;
	};
}

/**
 * Stream chunk type
 */
export interface StreamChunk {
	type: "text-delta" | "reasoning";
	text: string;
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
	[key: string]: any;
}

/**
 * Base model interface
 */
export interface BaseModel {
	id: string;
	[key: string]: any;
}

/**
 * Options for the useChat hook
 */
export interface UseChatOptions {
	model: BaseModel;
	initialMessages?: Message[];
	initialInput?: string;
	onError?: (error: Error) => void;
	onFinish?: (messages: ExtendedMessage[]) => void;
	abortOnUnmount?: boolean;
	generationOptions?: Partial<GenerationConfig>;
}

/**
 * Return type for the useChat hook
 */
export interface UseChatHelpers {
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

/**
 * Function to stream text using the wandler streamText API
 */
async function streamTextWithWandler(options: {
	model: BaseModel;
	messages: Message[];
	abortSignal?: AbortSignal;
	onChunk: (chunk: StreamChunk) => void;
	[key: string]: any;
}) {
	const { model, messages, onChunk, abortSignal, ...generationOptions } = options;

	try {
		// Call the real streamText function directly
		const result = await streamText({
			model,
			messages,
			abortSignal,
			...generationOptions,
			onChunk: (chunk: any) => {
				// Convert wandler chunk format to our format
				let streamChunk: StreamChunk;

				if (chunk.type === "text-delta") {
					streamChunk = {
						type: "text-delta",
						text: chunk.text || chunk.textDelta || "",
					};
				} else if (chunk.type === "reasoning") {
					streamChunk = {
						type: "reasoning",
						text: chunk.text || chunk.textDelta || "",
					};
				} else {
					// Default to text-delta for unknown types
					streamChunk = {
						type: "text-delta",
						text: chunk.text || chunk.textDelta || "",
					};
				}

				// Call the onChunk callback
				onChunk(streamChunk);
			},
		});

		return result;
	} catch (error) {
		console.error("Error in streamTextWithWandler:", error);
		throw error;
	}
}

/**
 * React hook for managing chat state with Wandler models
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
	// State
	const [messages, setMessages] = useState<ExtendedMessage[]>(() => {
		const mappedMessages = initialMessages.map(msg => ({
			...msg,
			id: uuidv4(),
			isComplete: true,
			timestamp: Date.now(),
		}));
		return mappedMessages;
	});
	const [isGenerating, setIsGenerating] = useState(false);
	const [input, setInput] = useState(initialInput);
	const [error, setError] = useState<Error | null>(null);
	const [status, setStatus] = useState<"submitted" | "streaming" | "ready" | "error">("ready");

	// Refs
	const abortControllerRef = useRef<AbortController | null>(null);
	const streamRef = useRef<ReadableStreamDefaultReader<string> | null>(null);
	const messagesRef = useRef<ExtendedMessage[]>(messages);

	// Update messagesRef when messages change
	useEffect(() => {
		messagesRef.current = messages;
	}, [messages]);

	// Clean up on unmount
	useEffect(() => {
		return () => {
			if (abortOnUnmount) {
				abortControllerRef.current?.abort();
				streamRef.current?.cancel();
			}
		};
	}, [abortOnUnmount]);

	// Send a message and get a response
	const append = useCallback(
		async (messageInput?: string | Message, options?: Partial<GenerationConfig>) => {
			// Process the input message
			let content: string;
			let role: "user" | "assistant" | "system" = "user";
			
			if (typeof messageInput === "string") {
				content = messageInput || input;
			} else if (messageInput && typeof messageInput === "object") {
				content = messageInput.content;
				role = messageInput.role;
			} else {
				content = input;
			}
			
			if (!content.trim()) return;

			try {
				// Reset state
				setError(null);
				setIsGenerating(true);
				setStatus("submitted");

				// Create abort controller
				abortControllerRef.current = new AbortController();
				const abortSignal = abortControllerRef.current.signal;

				// Create user message
				const userMessage: ExtendedMessage = {
					role,
					content,
					id: uuidv4(),
					isComplete: true,
					timestamp: Date.now(),
				};

				// Add user message to chat
				setMessages(prev => {
					const newMessages = [...prev, userMessage];
					return newMessages;
				});

				// Clear input after sending if it was used
				if (content === input) {
					setInput("");
				}

				// Create assistant message that will be updated during streaming
				const assistantMessage: ExtendedMessage = {
					role: "assistant",
					content: "",
					id: uuidv4(),
					isComplete: false,
					timestamp: Date.now(),
				};

				// Get all current messages from state before adding the assistant message
				// We need to do this to ensure we have the complete history
				const currentMessages = [...messagesRef.current, userMessage];

				// Add the initial empty assistant message to the chat
				setMessages(prev => {
					return [...prev, assistantMessage];
				});
				
				// Prepare messages for the model - include all previous messages
				// This ensures the full conversation history is maintained
				const modelMessages: Message[] = currentMessages.map(({ role, content }) => ({ role, content }));

				// Log the messages for debugging
				console.log("Current messages in state:", currentMessages);
				console.log("Messages being sent to model:", modelMessages);

				// Merge default options with provided options
				const mergedOptions = { ...generationOptions, ...options };

				// Start streaming
				const result = await streamTextWithWandler({
					model,
					messages: modelMessages,
					abortSignal,
					...mergedOptions,
					onChunk: (chunk: StreamChunk) => {
						// Update status to streaming after first chunk
						setStatus("streaming");

						// Handle different chunk types
						if (chunk.type === "text-delta") {
							// Update the assistant message content
							setMessages(prevMessages => {
								const updatedMessages = [...prevMessages];
								const assistantMessageIndex = updatedMessages.findIndex(msg => msg.id === assistantMessage.id);
								
								if (assistantMessageIndex !== -1) {
									updatedMessages[assistantMessageIndex] = {
										...updatedMessages[assistantMessageIndex],
										content: updatedMessages[assistantMessageIndex].content + chunk.text,
									};
								}
								
								return updatedMessages;
							});
						} else if (chunk.type === "reasoning") {
							// Update reasoning in metadata
							setMessages(prevMessages => {
								const updatedMessages = [...prevMessages];
								const assistantMessageIndex = updatedMessages.findIndex(msg => msg.id === assistantMessage.id);
								
								if (assistantMessageIndex !== -1) {
									const prevReasoning = updatedMessages[assistantMessageIndex].metadata?.reasoning || "";
									updatedMessages[assistantMessageIndex] = {
										...updatedMessages[assistantMessageIndex],
										metadata: {
											...updatedMessages[assistantMessageIndex].metadata,
											reasoning: prevReasoning + chunk.text,
										},
									};
								}
								
								return updatedMessages;
							});
						}
					},
				});

				// Store stream reader for cancellation if available
				if (result.textStream && typeof result.textStream.getReader === "function") {
					streamRef.current = result.textStream.getReader();
				}

				// Wait for completion if available
				if (result.result) {
					try {
						await result.result;
					} catch (error) {
						console.error("Error while waiting for result promise:", error);
						throw error;
					}
				}

				// Mark message as complete
				setMessages(prevMessages => {
					const updatedMessages = [...prevMessages];
					const assistantMessageIndex = updatedMessages.findIndex(msg => msg.id === assistantMessage.id);
					
					if (assistantMessageIndex !== -1) {
						// Check if the assistant message has content
						if (!updatedMessages[assistantMessageIndex].content || updatedMessages[assistantMessageIndex].content.trim() === "") {
							// Remove empty assistant message
							updatedMessages.splice(assistantMessageIndex, 1);
							setIsGenerating(false);
							setStatus("ready");
							return updatedMessages;
						}
						
						// Mark as complete
						updatedMessages[assistantMessageIndex] = {
							...updatedMessages[assistantMessageIndex],
							isComplete: true,
						};
					}
					
					// Update state
					setIsGenerating(false);
					setStatus("ready");
					
					// Call onFinish with the updated messages
					onFinish?.(updatedMessages);
					
					return updatedMessages;
				});
			} catch (err) {
				// Handle errors
				const error = err instanceof Error ? err : new Error(String(err));

				console.error("Error during message processing:", error.message);

				// Don't treat aborts as errors in the UI
				if (error.name === "AbortError") {
					setIsGenerating(false);
					setStatus("ready");
					return;
				}

				// Set error state
				setError(error);
				setStatus("error");
				onError?.(error);

				// Reset generation state
				setIsGenerating(false);
			}
		},
		[input, messages, model, generationOptions, onError, onFinish]
	);

	// Stop generation
	const stop = useCallback(() => {
		abortControllerRef.current?.abort();
		streamRef.current?.cancel();
		setIsGenerating(false);
		setStatus("ready");
		
		// Mark the last assistant message as complete if it exists
		setMessages(prevMessages => {
			const updatedMessages = [...prevMessages];
			const lastAssistantIndex = updatedMessages.findIndex(
				msg => msg.role === "assistant" && !msg.isComplete
			);
			
			if (lastAssistantIndex !== -1) {
				updatedMessages[lastAssistantIndex] = {
					...updatedMessages[lastAssistantIndex],
					isComplete: true,
				};
			}
			
			return updatedMessages;
		});
	}, []);

	// Clear chat history
	const clearChat = useCallback(() => {
		stop();
		setMessages([]);
		setError(null);
		setStatus("ready");
	}, [stop]);

	// Handle input change
	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		setInput(e.target.value);
	}, []);

	// Handle form submission
	const handleSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			append(input);
		},
		[append, input]
	);

	return {
		// State
		messages,
		isGenerating,
		input,
		error,
		status,

		// Actions
		append,
		clearChat,
		stop,
		setInput,
		setMessages,

		// Convenience
		handleInputChange,
		handleSubmit,
	};
}
