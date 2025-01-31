import { WorkerBridge } from "@wandler/worker/bridge";
import type { WorkerInstance } from "@wandler/worker/types";
import type { ModelOptions } from "@wandler/types/model";

const WORKER_TIMEOUT = 30000; // 30 seconds

export class WorkerManager {
	private static instance: WorkerManager;
	private workers: Map<string, WorkerInstance>;

	private constructor() {
		this.workers = new Map();
	}

	public static getInstance(): WorkerManager {
		if (!WorkerManager.instance) {
			WorkerManager.instance = new WorkerManager();
		}
		return WorkerManager.instance;
	}

	public canUseWorker(): boolean {
		return (
			typeof Worker !== "undefined" &&
			typeof ReadableStream !== "undefined" &&
			typeof MessageChannel !== "undefined"
		);
	}

	public async createWorker(modelId: string, options?: ModelOptions): Promise<WorkerInstance> {
		if (!this.canUseWorker()) {
			throw new Error("Web Workers are not supported in this environment");
		}

		// Check if worker already exists
		const existingWorker = this.workers.get(modelId);
		if (existingWorker && !existingWorker.isTerminated) {
			return existingWorker;
		}

		try {
			const bridge = new WorkerBridge(new URL("../worker/worker.ts", import.meta.url));
			const worker = bridge.getInstance();

			// Store the worker instance
			this.workers.set(modelId, worker);

			// Set up automatic cleanup if requested
			if (options?.workerOptions?.terminateOnIdle) {
				setTimeout(() => {
					if (this.workers.get(modelId) === worker) {
						this.terminateWorker(modelId);
					}
				}, options.workerOptions.timeout || WORKER_TIMEOUT);
			}

			return worker;
		} catch (error) {
			console.error("Failed to create worker:", error);
			throw new Error("Failed to initialize worker");
		}
	}

	public terminateWorker(modelId: string): void {
		const worker = this.workers.get(modelId);
		if (worker) {
			worker.terminate();
			this.workers.delete(modelId);
		}
	}

	public terminateAll(): void {
		this.workers.forEach(worker => worker.terminate());
		this.workers.clear();
	}
}
