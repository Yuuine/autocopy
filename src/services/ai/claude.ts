import type { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIProviderConfig
} from '../../types';
import { BaseAIService } from './base';

interface ClaudeChatResponse {
  id: string;
  type: string;
  role: string;
  model: string;
  content: Array<{
    type: string;
    text: string;
  }>;
  stop_reason: string | null;
  stop_sequence: string | null;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
}

interface ClaudeError {
  error: {
    message: string;
    type: string;
  };
}

export class ClaudeService extends BaseAIService {
  protected readonly provider: AIProvider = 'anthropic';

  constructor(config: AIProviderConfig) {
    super(config);
    this.validateConfig();
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const url = `${this.config.baseUrl ?? 'https://api.anthropic.com/v1'}/messages`;
    
    const systemMessage = request.messages.find(m => m.role === 'system');
    const userMessages = request.messages.filter(m => m.role !== 'system');
    
    const body: Record<string, unknown> = {
      model: this.getModel(request),
      messages: userMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    const maxTokens = this.getMaxTokens(request);
    if (maxTokens !== undefined) {
      body['max_tokens'] = maxTokens;
    }

    if (systemMessage) {
      body['system'] = systemMessage.content;
    }

    const temperature = this.getTemperature(request);
    if (temperature !== undefined) {
      body['temperature'] = temperature;
    }

    const topP = this.getTopP(request);
    if (topP !== undefined) {
      body['top_p'] = topP;
    }

    try {
      const httpResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': this.config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!httpResponse.ok) {
        const errorData = await httpResponse.json() as ClaudeError;
        throw new Error(
          `Claude API error: ${errorData.error?.message ?? httpResponse.statusText}`
        );
      }

      const data = await httpResponse.json() as ClaudeChatResponse;
      
      const textContent = data.content.find(c => c.type === 'text');
      if (!textContent) {
        throw new Error('No text response from Claude API');
      }

      return {
        content: textContent.text,
        model: data.model,
        provider: this.provider,
        usage: {
          promptTokens: data.usage.input_tokens,
          completionTokens: data.usage.output_tokens,
          totalTokens: data.usage.input_tokens + data.usage.output_tokens,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Claude service error: ${error.message}`);
      }
      throw new Error('Unknown error occurred in Claude service');
    }
  }
}
