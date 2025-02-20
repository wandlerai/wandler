import { getProvider } from "@wandler/providers/registry";
import type { BaseModel, ModelOptions } from "@wandler/types/model";
import type { WorkerMessage } from "@wandler/types/worker";
import { WorkerManager } from "@wandler/utils/worker-manager";

export async function loadModel(modelPath: string, options: ModelOptions = {}): Promise<BaseModel> {
	const workerManager = WorkerManager.getInstance();
	const useWorker = options.useWorker ?? workerManager.canUseWorker();

	// Get the provider
	const provider = getProvider(modelPath);

	if (useWorker) {
		try {
			const worker = await workerManager.createWorker(modelPath, options);
			const bridge = worker.bridge;

			// Create a copy of options without the callback
			const { onProgress, ...workerOptions } = options;

			const message: WorkerMessage = {
				type: "load",
				payload: {
					modelPath,
					options: workerOptions,
				},
				id: `load-${Date.now()}`,
			};

			// Set up progress handling in the main thread
			if (onProgress) {
				bridge.setMessageHandler((e: MessageEvent) => {
					if (e.data.type === "progress") {
						onProgress(e.data.payload);
					}
				});
			}

			const response = await bridge.sendMessage(message);
			if (response.type === "error") {
				throw response.payload;
			}

			const model = response.payload as BaseModel;

			// Add worker-specific methods and properties
			return {
				...model,
				worker: {
					bridge,
				},
				dispose: () => {
					workerManager.terminateWorker(modelPath);
				},
			};
		} catch (error) {
			console.warn("Worker-based loading failed:", error);
			if (!options.fallback) {
				throw error;
			}
			// Fall back to main thread loading
			console.log("Falling back to main thread loading...");
		}
	}

	// Main thread loading
	return provider.loadModel(modelPath, options);
}
