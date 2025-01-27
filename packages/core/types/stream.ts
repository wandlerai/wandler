export interface StreamResult<T> {
	textStream: ReadableStream<T>;
	[Symbol.asyncIterator](): AsyncIterator<T>;
	response: Promise<string>;
} 