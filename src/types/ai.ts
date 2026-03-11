export type AIProvider = 
  | 'deepseek' 
  | 'openai' 
  | 'anthropic'
  | 'wenxin'
  | 'qwen'
  | 'gemini'
  | 'moonshot';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIRequest {
  messages: AIMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
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

export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export interface AIProviderConfig {
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
  defaultTemperature?: number;
  defaultMaxTokens?: number;
  parameters?: ModelParameters;
}

export interface AIServiceError {
  code: string;
  message: string;
  provider: AIProvider;
  details?: Record<string, unknown>;
}
