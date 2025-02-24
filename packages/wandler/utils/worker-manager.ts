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

// Helper function to test if a URL exists by making a HEAD request
function urlExists(url: string): boolean {
	try {
		const xhr = new XMLHttpRequest();
		xhr.open("HEAD", url, false);
		xhr.send();
		return xhr.status >= 200 && xhr.status < 300;
	} catch (e) {
		console.debug("URL check failed:", e);
		return false;
	}
}

// Helper function to get the correct worker URL or create an inline worker
function getWorkerUrl(): URL | Worker {
	// For debugging
	const baseUrl = import.meta.url;
	console.debug("Base URL for worker resolution:", baseUrl);

	// Check if we're in a Vite-bundled environment
	const isViteBundled =
		baseUrl.startsWith("data:") ||
		baseUrl.includes("/.vite/") ||
		baseUrl.includes("/node_modules/.vite/");

	// STRATEGY 1: Try direct import.meta.url resolution first (recommended approach)
	// This should work in most bundlers that properly handle Web Workers
	try {
		// Try with the exact path "./worker.js" as recommended
		const workerUrl = new URL("./worker.js", import.meta.url);
		console.debug("Trying direct worker URL:", workerUrl.href);

		if (urlExists(workerUrl.href)) {
			console.debug("Worker found with direct URL");
			return workerUrl;
		}
	} catch (error) {
		console.debug("Direct worker URL failed:", error);
	}

	// Try with relative paths that might work in different build configurations
	const relativePaths = [
		"../worker/worker.js", // Source directory
		"../dist/worker/worker.js", // Built directory
		"./worker/worker.js", // Adjacent directory
		"wandler/worker.js", // Package name
	];

	for (const path of relativePaths) {
		try {
			const workerUrl = new URL(path, import.meta.url);
			console.debug(`Trying relative worker URL (${path}):`, workerUrl.href);

			if (urlExists(workerUrl.href)) {
				console.debug(`Worker found at relative path: ${path}`);
				return workerUrl;
			}
		} catch (error) {
			console.debug(`Relative path ${path} failed:`, error);
		}
	}

	// STRATEGY 2: Try to load from common locations in the site root
	// This works for bundlers that copy the worker file to the output directory
	try {
		// Try common locations for the worker file
		const possibleLocations = [
			"/worker.js", // Root of the site
			"/assets/worker.js", // Vite assets directory
			"/static/worker.js", // Common static directory
			"/js/worker.js", // Common JS directory
			"/dist/worker.js", // Common dist directory
			"/wandler/worker.js", // Namespaced directory
		];

		for (const location of possibleLocations) {
			const workerUrl = new URL(location, window.location.origin);
			console.debug(`Trying site root worker at: ${workerUrl.href}`);

			if (urlExists(workerUrl.href)) {
				console.debug(`Worker found at site root: ${location}`);
				return workerUrl;
			}
		}
	} catch (error) {
		console.debug("Site root worker loading failed:", error);
	}

	// STRATEGY 3: For Vite, create an inline worker with dynamic imports
	if (isViteBundled) {
		console.debug("Creating Vite-compatible inline worker");

		try {
			// Create a worker that dynamically imports the worker module
			// This approach works with Vite's code splitting
			const bootstrapWorker = `
				// First try to import using relative path
				import('./worker.js')
					.catch(() => import('../worker/worker.js'))
					.catch(() => import('../dist/worker/worker.js'))
					.catch(() => import('wandler/worker'))
					.then(module => {
						// Set up message handler
						self.onmessage = (e) => {
							const { id, type, payload } = e.data;
							// Process the message using the imported worker code
							if (type === "load" && module.loadModel) {
								module.loadModel(payload.modelPath, payload.options)
									.then(result => {
										self.postMessage({ id, type: "load", payload: result });
									})
									.catch(error => {
										self.postMessage({ id, type: "error", payload: error });
									});
							} else if (type === "generate" && module.handleGenerateText) {
								module.handleGenerateText(payload.messages, payload.options)
									.then(result => {
										self.postMessage({ id, type: "generate", payload: result });
									})
									.catch(error => {
										self.postMessage({ id, type: "error", payload: error });
									});
							} else if (type === "stream" && module.handleStreamText) {
								module.handleStreamText(payload.model, payload.messages, payload.config, id)
									.catch(error => {
										self.postMessage({ id, type: "error", payload: error });
									});
							} else {
								self.postMessage({ 
									id, 
									type: "error", 
									payload: new Error(\`Unknown message type or method not found: \${type}\`) 
								});
							}
						};
					})
					.catch(error => {
						// If the import fails, send an error message
						self.onmessage = (e) => {
							const { id } = e.data;
							self.postMessage({
								id,
								type: "error",
								payload: new Error(\`Failed to load worker module: \${error.message}\`)
							});
						};
					});
			`;

			return createWorkerFromString(bootstrapWorker);
		} catch (error) {
			console.debug("Vite inline worker creation failed:", error);
		}
	}

	// STRATEGY 4: If all else fails, create a minimal worker as a fallback
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
