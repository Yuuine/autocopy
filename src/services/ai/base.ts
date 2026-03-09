import type { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIProviderConfig,
  AIMessage 
} from '../../types';

export abstract class BaseAIService {
  protected config: AIProviderConfig;
  protected abstract readonly provider: AIProvider;

  constructor(config: AIProviderConfig) {
    this.config = config;
  }

  abstract chat(request: AIRequest): Promise<AIResponse>;

  protected validateConfig(): void {
    if (!this.config.apiKey) {
      throw new Error(`API key is required for ${this.provider}`);
    }
  }

  protected buildMessages(
    systemPrompt: string, 
    userPrompt: string
  ): AIMessage[] {
    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  protected getTemperature(request: AIRequest): number {
    return request.temperature ?? this.config.defaultTemperature ?? 0.7;
  }

  protected getMaxTokens(request: AIRequest): number {
    return request.maxTokens ?? this.config.defaultMaxTokens ?? 2000;
  }

  protected getModel(request: AIRequest): string {
    return request.model ?? this.config.model ?? 'default';
  }
}
