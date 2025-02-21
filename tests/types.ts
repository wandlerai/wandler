// Single Window interface augmentation
declare global {
	interface Window {
		testAPI: {
			loadModel: (model: string, options?: any) => Promise<any>;
			generateText: (options: any) => Promise<any>;
			streamText: (options: any) => Promise<any>;
		};
		testLogs: Array<{
			timestamp: number;
			type: string;
			info?: any;
			capabilities?: any;
			error?: string;
			model?: string;
			options?: any;
			prompt?: string;
			text?: string;
			reasoning?: string | null;
			sources?: string[] | null;
			finishReason?: string;
			usage?: {
				promptTokens: number;
				completionTokens: number;
				totalTokens: number;
			};
			messages?: Array<{
				role: "assistant" | "user" | "system";
				content: string;
			}>;
		}>;
		logTestEvent: (event: any) => void;
	}
}

// Export these types for use in tests
export type TestLogEvent = Window["testLogs"][number];
export type TestAPI = Window["testAPI"];

// Ensure the types are available
export {};
