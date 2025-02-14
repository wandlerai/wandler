import type { WorkerInstance, WorkerMessage, WorkerResponse } from "@wandler/types/worker";

export class WorkerBridge {
	private messageHandlers: Map<string, (response: WorkerResponse) => void>;
	private worker: Worker;
	private isTerminated: boolean;
	private originalOnMessage: ((e: MessageEvent) => void) | null = null;

	constructor(workerUrl: string | URL) {
		this.messageHandlers = new Map();
		this.isTerminated = false;
		this.worker = new Worker(workerUrl, { type: "module" });
		this.setupMessageHandling();
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
				if (type === "error") {
					const error = new Error(payload.message);
					error.name = payload.name;
					(error as any).code = payload.code;
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
			// Notify all pending handlers of the error
			this.messageHandlers.forEach(handler => {
				handler({
					type: "error",
					payload: e.error || new Error(e.message),
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
			const timeoutId = setTimeout(() => {
				this.messageHandlers.delete(message.id);
				reject(new Error("Worker operation timed out"));
			}, 30000); // 30 second timeout

			this.messageHandlers.set(message.id, (response: WorkerResponse) => {
				clearTimeout(timeoutId);
				if (response.type === "error") {
					reject(response.payload);
				} else {
					resolve(response);
				}
			});

			try {
				this.worker.postMessage(message);
			} catch (error) {
				clearTimeout(timeoutId);
				this.messageHandlers.delete(message.id);
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
			isTerminated: this.isTerminated,
		};
	}
}
