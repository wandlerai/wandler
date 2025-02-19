# User Story: Automatic device selection

**As a** Wandler user (developer)

**I want** Wandler to automatically select and use the best available device for model execution

**So that** I get the best possible performance without having to manually handle device selection
and fallback logic

## Acceptance Criteria

### Device Selection

- Wandler should support two automatic device modes:
  - `device: "auto"` - Use transformers.js built-in device selection
  - `device: "best"` - Try WebGPU first, fallback to "auto" if not available

### "Best" Device Selection Process

- When `device: "best"` is specified:
  1. Attempt to initialize WebGPU
  2. If WebGPU fails for any reason, fallback to `device: "auto"` and let transformers.js handle the
     device selection

### Device Support Detection

- Before attempting WebGPU:
  - Check browser support for WebGPU
  - Verify GPU compatibility
  - Log detailed information about why WebGPU failed if checks fail

### Error Handling & Logging

- Log device selection process:
  - Success: "Using WebGPU for model execution"
  - Fallback: "WebGPU not supported (reason), falling back to auto device selection"
- The final selected device should be accessible via the model object

### Manual Override

- Users can still explicitly specify a device (e.g., `"cpu"`, `"wasm"`, `"webgpu"`)
- Explicit device selection should bypass the automatic selection process
- If an explicit device fails, an error should be thrown (no fallback)

## Implementation Notes

### Device Selection Logic

```typescript
async function selectBestDevice() {
	try {
		// Try WebGPU
		if (await canUseWebGPU()) {
			return "webgpu";
		}
	} catch (error) {
		console.log("WebGPU not available:", error.message);
	}

	// Fallback to auto
	return "auto";
}
```

### Integration Points

- Add WebGPU capability detection
- Expose selected device information in model metadata
- Document the difference between "auto" and "best" modes

### Error Messages

- WebGPU not supported: "WebGPU not available: {reason}"
- Fallback notification: "Falling back to automatic device selection"
- Final device: "Model loaded successfully using {device}"
