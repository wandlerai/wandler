import { marked } from "marked";
import React, { useState } from "react";
// eslint-disable-next-line import/no-internal-modules
import ReactDOM from "react-dom/client";
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';

// DONT CHANGE THESE IMPORTS!
import { Message, useChat } from "../../packages/react/index";
import { BaseModel, loadModel, ProgressInfo } from "../../packages/wandler/index";

// Available models for the selector
const AVAILABLE_MODELS = [
	{ value: "onnx-community/Qwen2.5-Coder-0.5B-Instruct", label: "Qwen 0.5B (Coder)" },
	{ value: "onnx-community/DeepSeek-R1-Distill-Qwen-1.5B-ONNX", label: "DeepSeek 1.5B" },
];

// ScrollToBottom component that uses the StickToBottom context
function ScrollToBottom() {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();

  return (
    !isAtBottom && (
      <button
        className="scroll-to-bottom-btn"
        onClick={() => scrollToBottom()}
      >
        ↓
      </button>
    )
  );
}

// Function to render markdown content
function renderMarkdown(content: string) {
	return { __html: marked.parse(content) };
}

// Message bubble component
function MessageBubble({
	message,
	isStreaming = false,
}: {
	message: Message;
	isStreaming?: boolean;
}) {
	const isUser = message.role === "user";
	const hasReasoning = message.parts?.some((part) => part.type === "reasoning");

	// Get reasoning content if it exists
	const reasoningPart = message.parts?.find((part) => part.type === "reasoning");
	const reasoningContent = reasoningPart?.reasoning || "";

	// Get main content
	let content = message.content || "";

	// Add cursor for streaming effect
	const showCursor = isStreaming && !isUser && content.length > 0;

	return (
		<div className={`message ${isUser ? "user" : "assistant"}`}>
			<div className="avatar">{isUser ? "U" : "A"}</div>
			<div className="content">
				{hasReasoning && reasoningContent && (
					<div className="reasoning">
						<div className="reasoning-header">Reasoning:</div>
						<div
							className="reasoning-content"
							dangerouslySetInnerHTML={renderMarkdown(reasoningContent)}
						/>
					</div>
				)}
				<div dangerouslySetInnerHTML={renderMarkdown(content)} />
				{showCursor && <span className="cursor">▌</span>}
			</div>
		</div>
	);
}

// Main application component
function App() {
	const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[0].value);
	const [model, setModel] = useState<BaseModel | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [loadingProgress, setLoadingProgress] = useState(0);

	// Handle model selection change
	const handleModelChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setSelectedModel(e.target.value);
	};

	// Load the selected model
	const handleLoadModel = async () => {
		setIsLoading(true);
		setLoadingProgress(0);

		try {
			// Load the model with progress callback
			const loadedModel = await loadModel(selectedModel, {
				onProgress: (progress: ProgressInfo) => {
					const percentage = Math.round(
						(progress.loaded / progress.total) * 100
					);
					setLoadingProgress(percentage);
				},
			});

			setModel(loadedModel);
		} catch (error) {
			console.error("Error loading model:", error);
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div>
			<h1>Wandler Chat Demo</h1>
			<p>
				This demo showcases the <code>useChat</code> hook from the Wandler React
				package.
			</p>

			<div className="model-selector">
				<select
					className="model-select"
					value={selectedModel}
					onChange={handleModelChange}
					disabled={isLoading}
				>
					{AVAILABLE_MODELS.map((model) => (
						<option key={model.value} value={model.value}>
							{model.label}
						</option>
					))}
				</select>
			</div>

			{model ? (
				<ChatDemo
					model={model}
					isModelLoaded={true}
				/>
			) : (
				<ChatDemo
					model={null as unknown as BaseModel}
					onLoadModel={handleLoadModel}
					isModelLoaded={false}
					isLoading={isLoading}
					loadingProgress={loadingProgress}
				/>
			)}
		</div>
	);
}

function ChatDemo({ 
	model, 
	onLoadModel, 
	isModelLoaded = false, 
	isLoading = false,
	loadingProgress = 0
}: {
	model: BaseModel;
	onLoadModel?: () => void;
	isModelLoaded?: boolean;
	isLoading?: boolean;
	loadingProgress?: number;
}) {
	const {
		messages,
		input,
		handleSubmit,
		handleInputChange,
		isLoading: isGenerating,
		stop,
		clearMessages: clearChat,
		status,
		error: _error, // Rename to _error to indicate it's unused
	} = useChat({
		model,
	});
	
	// Create a wrapper function for textarea events
	const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		// Call the original handleInputChange with the event
		handleInputChange(e);
	};

	// Handle key press in textarea
	const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
		// If Enter is pressed without Shift, submit the form
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			
			// Only submit if there's content and we're not already generating
			if (input.trim() && !isGenerating) {
				handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
			}
		}
		// If Shift+Enter is pressed, allow default behavior (new line)
	};

	return (
		<div className="chat-container">
			{isModelLoaded && (
				<>
					<div className="chat-header">
						<div className="model-info">
							<div className="model-name">{model.name}</div>
							<div className="model-status">Status: {status}</div>
						</div>
						<div className="actions">
							<button 
								onClick={clearChat} 
								disabled={isGenerating || messages.length === 0}
								className="clear-chat-btn"
							>
								Clear
							</button>
						</div>
					</div>

					<StickToBottom className="chat-messages" resize="smooth" initial="smooth">
						<StickToBottom.Content>
							{messages.map((message: Message) => {
								return (
									<MessageBubble
										key={message.id}
										message={message}
										isStreaming={status === "streaming" && message.role === "assistant" && messages[messages.length - 1] === message}
									/>
								);
							})}
						</StickToBottom.Content>
					</StickToBottom>

					<div className="chat-input">
						<form onSubmit={handleSubmit}>
							<textarea
								className="message-input"
								placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
								value={input}
								onChange={handleTextareaChange}
								onKeyDown={handleKeyDown}
								disabled={isGenerating}
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
			) : null}
		</div>
	);
}

// Render the app
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
