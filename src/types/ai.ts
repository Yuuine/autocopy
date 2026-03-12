export type AIProvider = 'deepseek' | 'moonshot';

export type ProviderInstanceId = string;

export interface ProviderInstance {
  id: ProviderInstanceId;
  name: string;
  provider: AIProvider;
  apiKey: string;
  secretKey?: string | undefined;
  baseUrl?: string | undefined;
  model: string;
  parameters?: ModelParameters;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  instanceId?: ProviderInstanceId;
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
  secretKey?: string | undefined;
  baseUrl?: string | undefined;
  model?: string | undefined;
  defaultTemperature?: number | undefined;
  defaultMaxTokens?: number | undefined;
  parameters?: ModelParameters | undefined;
}

export interface AIServiceError {
  code: string;
  message: string;
  provider: AIProvider;
  details?: Record<string, unknown>;
}

export interface AIStreamChunk {
  content: string;
  done: boolean;
  error?: string;
}

export type AIStreamGenerator = AsyncGenerator<AIStreamChunk, void, unknown>;
