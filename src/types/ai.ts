export type AIProvider = 
  | 'deepseek' 
  | 'openai' 
  | 'anthropic'
  | 'wenxin'
  | 'qwen'
  | 'gemini';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export interface AIResponse {
  content: string;
  usage?: AIUsage;
  model: string;
  provider: AIProvider;
}

export interface AIUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AIProviderConfig {
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
}

export interface AIServiceError {
  code: string;
  message: string;
  provider: AIProvider;
  details?: Record<string, unknown>;
}
