/**
 * This file is used to test the worker loading functionality.
 * It can be used to verify that the worker is loaded correctly in both development and production environments.
 */

import { WorkerManager } from "./worker-manager";

export async function testWorkerLoading(): Promise<boolean> {
	try {
		const workerManager = WorkerManager.getInstance();

		if (!workerManager.canUseWorker()) {
			console.warn("Web Workers are not supported in this environment");
			return false;
		}

		// Try to create a worker with a test model ID
		const worker = await workerManager.createWorker("test-model");

		// If we get here, the worker was created successfully
		console.log("Worker created successfully");

		// Clean up
		workerManager.terminateWorker("test-model");

		return true;
	} catch (error) {
		console.error("Worker loading test failed:", error);
		return false;
	}
}

// Export a function to check if workers are supported
export function canUseWorker(): boolean {
	const workerManager = WorkerManager.getInstance();
	return workerManager.canUseWorker();
}
