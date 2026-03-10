import type { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIProviderConfig
} from '../../types';
import { BaseAIService } from './base';

interface OpenAIChatResponse {
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
  };
}

interface OpenAIError {
  error: {
    message: string;
    type: string;
    code: string;
  };
}

export class OpenAIService extends BaseAIService {
  protected readonly provider: AIProvider = 'openai';

  constructor(config: AIProviderConfig) {
    super(config);
    this.validateConfig();
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const url = `${this.config.baseUrl ?? 'https://api.openai.com/v1'}/chat/completions`;
    
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
        const errorData = await httpResponse.json() as OpenAIError;
        throw new Error(
          `OpenAI API error: ${errorData.error?.message ?? httpResponse.statusText}`
        );
      }

      const data = await httpResponse.json() as OpenAIChatResponse;
      
      const firstChoice = data.choices[0];
      if (!firstChoice) {
        throw new Error('No response from OpenAI API');
      }

      const content = firstChoice.message.content;
      if (content === null) {
        throw new Error('No content in OpenAI API response');
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
        throw new Error(`OpenAI service error: ${error.message}`);
      }
      throw new Error('Unknown error occurred in OpenAI service');
    }
  }
}
