import type { ModelOptions } from "@wandler/types/model";
import type { WorkerInstance } from "@wandler/types/worker";

import { WorkerBridge } from "@wandler/worker/bridge";

const WORKER_TIMEOUT = 30000; // 30 seconds

// Helper function to get the correct worker URL
function getWorkerUrl(): URL {
	// For debugging
	const baseUrl = import.meta.url;
	console.debug("Base URL for worker resolution:", baseUrl);

	// Check if we're in a Vite-bundled environment (data: URL or .vite in the path)
	const isViteBundled =
		baseUrl.startsWith("data:") ||
		baseUrl.includes("/.vite/") ||
		baseUrl.includes("/node_modules/.vite/");

	if (isViteBundled) {
		console.debug("Detected Vite bundled environment");

		// In Vite environments, we need to use a public URL approach
		// This assumes the worker file is copied to the public directory or served as a separate asset
		try {
			// Try to use a direct path to the worker in the public directory
			// This requires manually copying the worker file to the public directory in your app
			const publicWorkerUrl = new URL("./worker.js", window.location.origin);
			console.debug("Using public worker URL:", publicWorkerUrl.href);
			return publicWorkerUrl;
		} catch (error) {
			console.debug("Public worker URL failed:", error);
			console.error(
				"When using Vite or other bundlers, you need to manually copy the worker file to your public directory."
			);
			console.error(
				"See documentation at: https://github.com/timpietrusky/wandlerai/blob/main/packages/wandler/worker/README.md"
			);
			throw new Error("Worker loading failed in bundled environment. See console for details.");
		}
	}

	try {
		// First try direct import using the package name
		// This should work when the package is installed from npm
		const workerUrl = new URL("wandler/worker", import.meta.url);
		console.debug("Resolved worker URL (method 1):", workerUrl.href);
		return workerUrl;
	} catch (error) {
		console.debug("Method 1 failed:", error);

		try {
			// Try using a relative path to the built worker
			// This should work in development and when bundled
			const workerUrl = new URL("../dist/worker/worker.js", import.meta.url);
			console.debug("Resolved worker URL (method 2):", workerUrl.href);
			return workerUrl;
		} catch (error2) {
			console.debug("Method 2 failed:", error2);

			try {
				// Fallback to the development path with JS extension
				const workerUrl = new URL("../worker/worker.js", import.meta.url);
				console.debug("Resolved worker URL (method 3):", workerUrl.href);
				return workerUrl;
			} catch (error3) {
				console.debug("Method 3 failed:", error3);

				// Last resort, try the TS file directly (for development)
				try {
					const workerUrl = new URL("../worker/worker.ts", import.meta.url);
					console.debug("Resolved worker URL (method 4):", workerUrl.href);
					return workerUrl;
				} catch (error4) {
					console.debug("Method 4 failed:", error4);

					// If all else fails, throw a helpful error
					throw new Error(
						"Could not resolve worker URL. When using bundlers like Vite, you may need to manually copy the worker file to your public directory."
					);
				}
			}
		}
	}
}

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
			const workerUrl = getWorkerUrl();
			console.debug("Creating worker with URL:", workerUrl.href);
			const bridge = new WorkerBridge(workerUrl);
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
		this.workers.forEach(worker => worker.terminate());
		this.workers.clear();
	}
}
