// Coming soon: React components and hooks for Wandler
export const version = "0.0.0";

// Export hooks
export type {
	BaseModel,
	ExtendedMessage,
	GenerationConfig,
	Message,
	StreamChunk,
	UseChatHelpers,
	UseChatOptions,
} from "./hooks/useChat";
export { useChat } from "./hooks/useChat";
