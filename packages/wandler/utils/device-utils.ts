import type { ModelDevice, ModelDtype } from "@wandler/types/model";

// Types for device selection
export type DeviceType = ModelDevice;
export type TransformersDeviceType = Exclude<ModelDevice, "best">;

export interface DeviceSelection {
	device: TransformersDeviceType;
	recommendedDtype: ModelDtype;
}

// WebGPU type declarations
declare global {
	interface Navigator {
		gpu?: {
			requestAdapter(): Promise<GPUAdapter | null>;
		};
	}
	interface GPUAdapter {}
}

/**
 * Selects the best device and recommended dtype based on the requested device and system capabilities.
 * If a specific device is requested, it will be used with its recommended dtype.
 * For auto/best selection, it will try WebGPU first, then fall back to WASM.
 */
export async function selectBestDevice(requested: DeviceType = "auto"): Promise<DeviceSelection> {
	// If user explicitly requested a device, respect that
	if (requested !== "auto" && requested !== "best") {
		return {
			device: requested as TransformersDeviceType,
			// Default dtype based on device
			recommendedDtype: requested === "wasm" ? "q4" : "q4f16",
		};
	}

	// For auto/best, try to use WebGPU first
	try {
		if (typeof navigator !== "undefined" && "gpu" in navigator && navigator.gpu) {
			// Try to actually get a WebGPU adapter
			const adapter = await navigator.gpu.requestAdapter();
			if (adapter) {
				console.log("[Device] WebGPU adapter found, using it");
				return {
					device: "webgpu",
					recommendedDtype: "q4f16",
				};
			} else {
				console.log("[Device] WebGPU API exists but no adapter available");
			}
		}
	} catch (error) {
		console.log("[Device] WebGPU not available:", error);
	}

	// Fallback to WASM
	console.log("[Device] Using WASM with q4");
	return {
		device: "wasm",
		recommendedDtype: "q4",
	};
}
