import { marked } from "marked";
import React, { useEffect, useState } from "react";
// eslint-disable-next-line import/no-internal-modules
import ReactDOM from "react-dom/client";

// DONT CHANGE THESE IMPORTS!
import { BaseModel, ExtendedMessage, useChat } from "../../packages/react/index";
import { loadModel, ProgressInfo } from "../../packages/wandler/index";

// Available models for the selector
const AVAILABLE_MODELS = [
	{ value: "onnx-community/Qwen2.5-Coder-0.5B-Instruct", label: "Qwen 0.5B (Coder)" },
	{ value: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX", label: "DeepSeek 1.5B" },
];

// Function to render markdown content
const renderMarkdown = (content: string) => {
	if (!content) return "";
	
	try {
		return marked.parse(content);
	} catch (error) {
		console.error("Error parsing markdown:", error);
		return content;
	}
};

interface MessageBubbleProps {
	message: ExtendedMessage;
	isStreaming?: boolean;
}

function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
	const isUser = message.role === "user";

	return (
		<div className={`message ${isUser ? "user" : "assistant"} ${isStreaming ? "streaming" : ""}`}>
			<div className="avatar">{isUser ? "👤" : "🤖"}</div>
			{isUser ? (
				<div className="content">
					{message.content || (isStreaming ? "..." : "")}
					{isStreaming && <span className="cursor">▌</span>}
				</div>
			) : (
				<div className="content">
					{message.metadata?.reasoning && (
						<ReasoningBubble 
							text={message.metadata.reasoning} 
							isStreaming={isStreaming && !message.isComplete} 
						/>
					)}
					<div dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content || "") }} />
					{isStreaming && <span className="cursor">▌</span>}
				</div>
			)}
		</div>
	);
}

interface ReasoningBubbleProps {
	text: string;
	isStreaming?: boolean;
}

function ReasoningBubble({ text, isStreaming }: ReasoningBubbleProps) {
	return (
		<div className="reasoning">
			<div className="reasoning-header">Reasoning:</div>
			<div className="reasoning-content">
				{text}
				{isStreaming && <span className="cursor">▌</span>}
			</div>
		</div>
	);
}

// Root style for the entire application
const rootStyle = {
	fontFamily: "sans-serif",
	backgroundColor: "#111111",
	color: "#ffffff",
	padding: "20px",
};

// Main App Component
function App() {
	const [model, setModel] = useState<BaseModel | null>(null);
	const [loading, setLoading] = useState(false);
	const [progress, setProgress] = useState({ loaded: 0, total: 0 });
	const [error, setError] = useState<string | null>(null);
	const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].value);

	async function loadAIModel() {
		try {
			setLoading(true);
			setError(null);

			const loadedModel = await loadModel(selectedModel, {
				onProgress: (info: ProgressInfo) => {
					if (info.status === "progress") {
						setProgress({
							loaded: info.loaded,
							total: info.total,
						});
					}
				}
			});

			// Ensure the model has the required capabilities
			const modelWithCapabilities = {
				...loadedModel,
				capabilities: {
					textGeneration: true,
				},
			};

			// Type assertion to satisfy TypeScript
			setModel(modelWithCapabilities as BaseModel);
			setLoading(false);

			console.log("Model loaded successfully:", modelWithCapabilities);
		} catch (err: unknown) {
			console.error("Error loading model:", err);
			setError(err instanceof Error ? err.message : String(err));
			setLoading(false);
		}
	}

	// Create a placeholder model for when the real model is not loaded
	const placeholderModel = model || {
		id: "placeholder-model",
		name: "Model Not Loaded",
		capabilities: {
			textGeneration: false,
		},
	};

	const percent = progress.total ? Math.round((progress.loaded / progress.total) * 100) : 0;

	return (
		<div style={rootStyle}>
			<h1>useChat</h1>
			
			{!model && (
				<div style={{ marginBottom: "20px" }}>
					<p>
						This demo showcases the <code>useChat</code> react hook from <code>@wandler/react</code>
					</p>
					
					{error && (
						<div
							style={{
								padding: "10px",
								marginBottom: "20px",
								backgroundColor: "#2b2b2b",
								color: "#ff5252",
								border: "1px solid",
								borderImage: "linear-gradient(to right, #ff5252, #ff1744) 1",
							}}
						>
							<p>Error loading model: {error}</p>
							<p>Please check your console for more details.</p>
						</div>
					)}
				</div>
			)}
			
			<div style={{ marginBottom: "20px" }}>
				<h3 style={{ marginBottom: "10px" }}>Select Model</h3>
				<select 
					value={selectedModel} 
					onChange={(e) => setSelectedModel(e.target.value)}
					disabled={loading}
					style={{
						width: "100%",
						padding: "0.75rem",
						fontFamily: "system-ui, sans-serif",
						fontSize: "1rem",
						border: "1px solid",
						borderImage: "linear-gradient(to right, #9c27b0, #673ab7, #3f51b5) 1",
						backgroundColor: "#1e1e1e",
						color: "#d4d4d4",
						marginBottom: "1rem",
						cursor: loading ? "not-allowed" : "pointer",
						opacity: loading ? 0.7 : 1,
					}}
				>
					{AVAILABLE_MODELS.map((model) => (
						<option key={model.value} value={model.value}>
							{model.label}
						</option>
					))}
				</select>
			</div>
			
			<ChatDemo 
				model={placeholderModel} 
				onLoadModel={loadAIModel} 
				isModelLoaded={!!model} 
				isLoading={loading}
				loadingProgress={percent}
				loadingError={error}
			/>
		</div>
	);
}

function ChatDemo({ 
	model, 
	onLoadModel, 
	isModelLoaded = false, 
	isLoading = false,
	loadingProgress = 0,
	loadingError = null
}: {
	model: BaseModel;
	onLoadModel?: () => void;
	isModelLoaded?: boolean;
	isLoading?: boolean;
	loadingProgress?: number;
	loadingError?: string | null;
}) {
	const {
		messages,
		input,
		handleSubmit,
		handleInputChange,
		isGenerating,
		stop,
		clearChat,
		status,
		error,
	} = useChat({
		model,
	});

	// Calculate the last assistant message
	const lastAssistantMessage = [...messages]
		.reverse()
		.find((message) => message.role === "assistant");

	// Create a wrapper function for textarea events
	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		// Call the original handleInputChange with the event
		handleInputChange(e as unknown as React.ChangeEvent<HTMLInputElement>);
	};

	// Adjust textarea height based on content
	useEffect(() => {
		const textarea = document.querySelector(".message-input") as HTMLTextAreaElement;
		if (textarea) {
			textarea.style.height = "auto";
			textarea.style.height = `${textarea.scrollHeight}px`;
		}
	}, [input]);

	return (
		<div className="chat-container">
			{isModelLoaded && (
				<div className="chat-header">
					<div className="model-info">
						<div className="model-name">{model.name}</div>
						<div className="model-status">Status: {status}</div>
					</div>
					<div className="actions">
						<button onClick={clearChat} disabled={isGenerating || messages.length === 0}>
							Clear
						</button>
					</div>
				</div>
			)}

			{error && (
				<div className="loading-error">
					<p>Error: {error.message}</p>
				</div>
			)}

			{!isModelLoaded ? (
				<div className="load-model-container">
					<button
						onClick={onLoadModel}
						disabled={isLoading}
						className="load-model-btn"
					>
						{isLoading ? `Loading (${loadingProgress}%)` : "Load Model"}
					</button>
				</div>
			) : (
				<>
					<div className="chat-messages">
						{messages.map((message: ExtendedMessage) => {
							return (
								<MessageBubble
									key={message.id}
									message={message}
									isStreaming={status === "streaming" && message.id === lastAssistantMessage?.id} 
								/>
							);
						})}
					</div>

					<div className="chat-input">
						<form onSubmit={handleSubmit}>
							<textarea
								className="message-input"
								value={input}
								onChange={handleTextareaChange}
								placeholder="Type your message..."
								disabled={isGenerating}
								color="#ffffff"
							/>
							<button
								type="submit"
								className={isGenerating ? "stop-button" : "send-button"}
								disabled={isGenerating ? false : !input.trim()}
								onClick={isGenerating ? stop : undefined}
							>
								{isGenerating ? "Stop" : "Send"}
							</button>
						</form>
					</div>
				</>
			)}
		</div>
	);
}

// Render the app
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
