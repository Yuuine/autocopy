import type { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIProviderConfig
} from '../../types';
import { BaseAIService } from './base';

interface MoonshotChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: string;
      content: string | null;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cached_tokens?: number;
  };
}

interface MoonshotError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export class MoonshotService extends BaseAIService {
  protected readonly provider: AIProvider = 'moonshot';
  private readonly defaultBaseUrl = 'https://api.moonshot.cn/v1';

  constructor(config: AIProviderConfig) {
    super(config);
    this.validateConfig();
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const url = `${baseUrl}/chat/completions`;
    
    const body = this.buildRequestBody(request);

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
        const errorData = await httpResponse.json() as MoonshotError;
        throw new Error(
          `Moonshot API error: ${errorData.error?.message ?? httpResponse.statusText}`
        );
      }

      const data = await httpResponse.json() as MoonshotChatResponse;
      
      const firstChoice = data.choices[0];
      if (!firstChoice) {
        throw new Error('No response from Moonshot API');
      }

      const content = firstChoice.message.content;
      if (content === null) {
        throw new Error('No content in Moonshot API response');
      }

      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined;

      const aiResponse: AIResponse = {
        content: content,
        model: data.model,
        provider: this.provider,
      };

      if (usage) {
        aiResponse.usage = usage;
      }

      return aiResponse;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Moonshot service error: ${error.message}`);
      }
      throw new Error('Unknown error occurred in Moonshot service');
    }
  }
}
