export interface Message {
	role: "user" | "assistant" | "system";
	content: string;
} 