import type { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIProviderConfig
} from '../../types';
import { BaseAIService } from './base';

interface DeepSeekChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface DeepSeekError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export class DeepSeekService extends BaseAIService {
  protected readonly provider: AIProvider = 'deepseek';

  constructor(config: AIProviderConfig) {
    super(config);
    this.validateConfig();
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const url = `${this.config.baseUrl}/chat/completions`;
    
    const body = {
      model: this.getModel(request),
      messages: request.messages,
      temperature: this.getTemperature(request),
      max_tokens: this.getMaxTokens(request),
    };

    try {
      const httpResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!httpResponse.ok) {
        const errorData = await httpResponse.json() as DeepSeekError;
        throw new Error(
          `DeepSeek API error: ${errorData.error?.message ?? httpResponse.statusText}`
        );
      }

      const data = await httpResponse.json() as DeepSeekChatResponse;
      
      const firstChoice = data.choices[0];
      if (!firstChoice) {
        throw new Error('No response from DeepSeek API');
      }

      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined;

      const aiResponse: AIResponse = {
        content: firstChoice.message.content,
        model: data.model,
        provider: this.provider,
      };

      if (usage) {
        aiResponse.usage = usage;
      }

      return aiResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`DeepSeek service error: ${error.message}`);
      }
      throw new Error('Unknown error occurred in DeepSeek service');
    }
  }
}
