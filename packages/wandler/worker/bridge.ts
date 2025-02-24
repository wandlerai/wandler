import type { WorkerInstance, WorkerMessage, WorkerResponse } from "@wandler/types/worker";

export class WorkerBridge {
	private messageHandlers: Map<string, (response: WorkerResponse) => void>;
	private worker: Worker;
	private isTerminated: boolean;
	private originalOnMessage: ((e: MessageEvent) => void) | null = null;
	private workerUrl: string | URL | Worker;

	constructor(workerUrlOrInstance: string | URL | Worker, isWorkerInstance = false) {
		this.messageHandlers = new Map();
		this.isTerminated = false;
		this.workerUrl = workerUrlOrInstance;

		try {
			if (isWorkerInstance || workerUrlOrInstance instanceof Worker) {
				// If we're given a Worker instance directly
				console.debug("Using provided Worker instance");
				this.worker = workerUrlOrInstance as Worker;
			} else {
				// Otherwise create a new Worker from the URL
				console.debug(
					"Creating worker with URL:",
					typeof workerUrlOrInstance === "string" ? workerUrlOrInstance : workerUrlOrInstance.href
				);
				this.worker = new Worker(workerUrlOrInstance as string | URL, { type: "module" });
			}

			this.setupMessageHandling();
		} catch (error) {
			console.error("Failed to create worker:", error);
			// Re-throw with more context
			let errorContext = "unknown source";
			if (typeof workerUrlOrInstance === "string") {
				errorContext = workerUrlOrInstance;
			} else if (workerUrlOrInstance instanceof URL) {
				errorContext = workerUrlOrInstance.href;
			} else if (workerUrlOrInstance instanceof Worker) {
				errorContext = "provided Worker instance";
			}

			throw new Error(
				`Failed to create worker from ${errorContext}: ${error instanceof Error ? error.message : String(error)}`
			);
		}
	}

	private setupMessageHandling() {
		this.worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
			const { id, type, payload } = e.data;

			// Allow external message handler to process first
			if (this.originalOnMessage) {
				this.originalOnMessage(e);
			}

			const handler = this.messageHandlers.get(id);
			if (handler) {
				if (type === "error" && payload instanceof Error) {
					const error = new Error(payload.message);
					error.name = payload.name;
					if ("code" in payload) {
						(error as any).code = payload.code;
					}
					handler({ type, payload: error, id });
				} else {
					handler(e.data);
				}
				// Clean up one-time handlers
				if (type !== "stream" && type !== "progress") {
					this.messageHandlers.delete(id);
				}
			}
		};

		this.worker.onerror = (e: ErrorEvent) => {
			console.error("Worker error:", e);

			// Log the worker source
			if (this.workerUrl instanceof Worker) {
				console.error("Worker was created from a Worker instance");
			} else if (typeof this.workerUrl === "string") {
				console.error("Worker URL was:", this.workerUrl);
			} else if (this.workerUrl instanceof URL) {
				console.error("Worker URL was:", this.workerUrl.href);
			}

			// Create a more detailed error message
			const errorMessage = `Worker error: ${e.message}. File: ${e.filename}, Line: ${e.lineno}, Col: ${e.colno}`;

			// Notify all pending handlers of the error
			this.messageHandlers.forEach(handler => {
				handler({
					type: "error",
					payload: e.error || new Error(errorMessage),
					id: "error",
				});
			});
		};
	}

	public setMessageHandler(handler: (e: MessageEvent) => void) {
		this.originalOnMessage = handler;
	}

	public async sendMessage(message: WorkerMessage): Promise<WorkerResponse> {
		if (this.isTerminated) {
			throw new Error("Worker has been terminated");
		}

		return new Promise((resolve, reject) => {
			this.messageHandlers.set(message.id, (response: WorkerResponse) => {
				if (response.type === "error") {
					reject(response.payload);
				} else {
					resolve(response);
				}
			});

			try {
				this.worker.postMessage(message);
			} catch (error) {
				this.messageHandlers.delete(message.id);
				console.error("Error posting message to worker:", error);
				reject(error);
			}
		});
	}

	public terminate() {
		if (!this.isTerminated) {
			this.worker.terminate();
			this.messageHandlers.clear();
			this.isTerminated = true;
		}
	}

	public getInstance(): WorkerInstance {
		return {
			worker: this.worker,
			bridge: this,
			terminate: () => this.terminate(),
		};
	}
}
