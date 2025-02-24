import type { ModelOptions } from "@wandler/types/model";
import type { WorkerInstance } from "@wandler/types/worker";

import { WorkerBridge } from "@wandler/worker/bridge";

const WORKER_TIMEOUT = 30000; // 30 seconds

// Helper function to create a worker from a string of code
function createWorkerFromString(code: string): Worker {
	const blob = new Blob([code], { type: "application/javascript" });
	const url = URL.createObjectURL(blob);
	return new Worker(url, { type: "module" });
}

// Minimal worker code that can be used as a fallback
// This is a simplified version that just forwards the error
const MINIMAL_WORKER_CODE = `
self.onmessage = (e) => {
  const { id, type } = e.data;
  self.postMessage({
    id,
    type: "error",
    payload: new Error("Worker fallback mode: This is a minimal worker implementation. The full worker.js file could not be loaded.")
  });
};
`;

// Helper function to get the correct worker URL or create an inline worker
function getWorkerUrl(): URL | Worker {
	// For debugging
	const baseUrl = import.meta.url;
	console.debug("Base URL for worker resolution:", baseUrl);

	// First try direct import using the package name
	// This should work when the package is installed from npm
	try {
		const workerUrl = new URL("wandler/worker", import.meta.url);
		console.debug("Resolved worker URL (method 1):", workerUrl.href);

		// Verify the worker exists with a HEAD request
		try {
			const xhr = new XMLHttpRequest();
			xhr.open("HEAD", workerUrl.href, false);
			xhr.send();
			if (xhr.status >= 200 && xhr.status < 300) {
				return workerUrl;
			}
		} catch (e) {
			console.debug("Worker verification failed:", e);
		}
	} catch (error) {
		console.debug("Method 1 failed:", error);
	}

	// Try using a relative path to the built worker
	try {
		const workerUrl = new URL("../dist/worker/worker.js", import.meta.url);
		console.debug("Resolved worker URL (method 2):", workerUrl.href);

		// Verify the worker exists
		try {
			const xhr = new XMLHttpRequest();
			xhr.open("HEAD", workerUrl.href, false);
			xhr.send();
			if (xhr.status >= 200 && xhr.status < 300) {
				return workerUrl;
			}
		} catch (e) {
			console.debug("Worker verification failed:", e);
		}
	} catch (error2) {
		console.debug("Method 2 failed:", error2);
	}

	// Try the development path with JS extension
	try {
		const workerUrl = new URL("../worker/worker.js", import.meta.url);
		console.debug("Resolved worker URL (method 3):", workerUrl.href);

		// Verify the worker exists
		try {
			const xhr = new XMLHttpRequest();
			xhr.open("HEAD", workerUrl.href, false);
			xhr.send();
			if (xhr.status >= 200 && xhr.status < 300) {
				return workerUrl;
			}
		} catch (e) {
			console.debug("Worker verification failed:", e);
		}
	} catch (error3) {
		console.debug("Method 3 failed:", error3);
	}

	// Check if we're in a Vite-bundled environment
	const isViteBundled =
		baseUrl.startsWith("data:") ||
		baseUrl.includes("/.vite/") ||
		baseUrl.includes("/node_modules/.vite/");

	if (isViteBundled) {
		console.debug("Detected Vite bundled environment");

		// For Vite, try to fetch the worker content directly from the package
		try {
			// Attempt to fetch the worker code directly
			const xhr = new XMLHttpRequest();
			xhr.open("GET", "node_modules/wandler/dist/worker/worker.js", false);
			try {
				xhr.send();
				if (xhr.status >= 200 && xhr.status < 300) {
					// We got the worker code, create an inline worker
					console.debug("Creating inline worker from fetched code");
					return createWorkerFromString(xhr.responseText);
				}
			} catch (e) {
				console.debug("Worker fetch failed:", e);
			}
		} catch (error) {
			console.debug("Vite worker fetch failed:", error);
		}
	}

	// If all else fails, create a minimal worker as a fallback
	console.warn("Could not resolve worker URL. Using minimal fallback worker.");
	console.warn("Functionality will be limited. Check console for more details.");
	return createWorkerFromString(MINIMAL_WORKER_CODE);
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
			const workerUrlOrInstance = getWorkerUrl();

			let bridge: WorkerBridge;

			if (workerUrlOrInstance instanceof Worker) {
				// If we got a Worker instance directly (from the fallback)
				console.debug("Using pre-created worker instance");
				bridge = new WorkerBridge(workerUrlOrInstance, true);
			} else {
				// Otherwise, we got a URL
				console.debug("Creating worker with URL:", workerUrlOrInstance.href);
				bridge = new WorkerBridge(workerUrlOrInstance);
			}

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
