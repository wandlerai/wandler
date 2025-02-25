import type { ModelOptions } from "@wandler/types/model";
import type { WorkerInstance } from "@wandler/types/worker";

import { WorkerBridge } from "@wandler/worker/bridge";

// Import the worker directly using Vite's worker plugin
// The ?worker&inline suffix tells Vite to inline the worker as a blob URL
// @ts-ignore - TypeScript doesn't understand Vite's special imports
import WorkerScript from "../worker/worker?worker&inline";

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
		if (existingWorker) {
			return existingWorker;
		}

		try {
			// Create a worker using Vite's inline worker
			const worker = new WorkerScript();
			console.debug("Created worker using Vite's inline worker");

			// Create a bridge with the worker instance
			const bridge = new WorkerBridge(worker, true);
			const workerInstance = bridge.getInstance();

			// Store the worker instance
			this.workers.set(modelId, workerInstance);

			// Set up automatic cleanup if requested
			if (options?.workerOptions?.terminateOnIdle) {
				setTimeout(() => {
					if (this.workers.get(modelId) === workerInstance) {
						this.terminateWorker(modelId);
					}
				}, options.workerOptions.timeout || WORKER_TIMEOUT);
			}

			return workerInstance;
		} catch (error) {
			console.error("Failed to create worker:", error);
			throw new Error(
				`Failed to initialize worker: ${error instanceof Error ? error.message : String(error)}`
			);
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
		this.workers.forEach(worker => {
			worker.terminate();
		});
		this.workers.clear();
	}
}
