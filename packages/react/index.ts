// React components and hooks for Wandler
export const version = "0.0.0";

// Export hooks and React-specific types only
export type {
	GenerationConfig,
	Message,
	StreamChunk,
	UseChatHelpers,
	UseChatOptions,
} from "./hooks/useChat";
export { useChat } from "./hooks/useChat";
