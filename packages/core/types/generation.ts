export interface GenerationConfig {
	max_new_tokens?: number;
	do_sample?: boolean;
	temperature?: number;
	top_p?: number;
	repetition_penalty?: number;
} 