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

  protected getTemperature(request: AIRequest): number | undefined {
    if (request.temperature !== undefined) {
      return request.temperature;
    }
    if (this.config.parameters?.temperature !== undefined) {
      return this.config.parameters.temperature;
    }
    return this.config.defaultTemperature ?? 0.7;
  }

  protected getMaxTokens(request: AIRequest): number | undefined {
    if (request.maxTokens !== undefined) {
      return request.maxTokens;
    }
    if (this.config.parameters?.maxTokens !== undefined) {
      return this.config.parameters.maxTokens;
    }
    return this.config.defaultMaxTokens ?? 2000;
  }

  protected getTopP(request: AIRequest): number | undefined {
    if (request.topP !== undefined) {
      return request.topP;
    }
    return this.config.parameters?.topP;
  }

  protected getPresencePenalty(request: AIRequest): number | undefined {
    if (request.presencePenalty !== undefined) {
      return request.presencePenalty;
    }
    return this.config.parameters?.presencePenalty;
  }

  protected getFrequencyPenalty(request: AIRequest): number | undefined {
    if (request.frequencyPenalty !== undefined) {
      return request.frequencyPenalty;
    }
    return this.config.parameters?.frequencyPenalty;
  }

  protected getModel(request: AIRequest): string {
    return request.model ?? this.config.model ?? 'default';
  }

  protected buildRequestBody(
    request: AIRequest,
    additionalParams?: Record<string, unknown>
  ): Record<string, unknown> {
    const body: Record<string, unknown> = {
      model: this.getModel(request),
      messages: request.messages,
    };

    const temperature = this.getTemperature(request);
    if (temperature !== undefined) {
      body['temperature'] = temperature;
    }

    const maxTokens = this.getMaxTokens(request);
    if (maxTokens !== undefined) {
      body['max_tokens'] = maxTokens;
    }

    const topP = this.getTopP(request);
    if (topP !== undefined) {
      body['top_p'] = topP;
    }

    const presencePenalty = this.getPresencePenalty(request);
    if (presencePenalty !== undefined) {
      body['presence_penalty'] = presencePenalty;
    }

    const frequencyPenalty = this.getFrequencyPenalty(request);
    if (frequencyPenalty !== undefined) {
      body['frequency_penalty'] = frequencyPenalty;
    }

    if (additionalParams) {
      Object.assign(body, additionalParams);
    }

    return body;
  }
}
