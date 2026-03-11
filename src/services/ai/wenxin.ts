import type { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIProviderConfig
} from '../../types';
import { BaseAIService } from './base';

interface WenxinChatResponse {
  id: string;
  object: string;
  created: number;
  result: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface WenxinError {
  error_code: number;
  error_msg: string;
}

export class WenxinService extends BaseAIService {
  protected readonly provider: AIProvider = 'wenxin';

  constructor(config: AIProviderConfig) {
    super(config);
    this.validateConfig();
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const accessToken = await this.getAccessToken();
    const url = `${this.config.baseUrl ?? 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat'}/${this.getModel(request)}?access_token=${accessToken}`;
    
    const systemMessage = request.messages.find(m => m.role === 'system');
    const userMessages = request.messages.filter(m => m.role !== 'system');
    
    const body: Record<string, unknown> = {
      messages: userMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    };

    if (systemMessage) {
      body['system'] = systemMessage.content;
    }

    const temperature = this.getTemperature(request);
    if (temperature !== undefined) {
      body['temperature'] = temperature;
    }

    const maxTokens = this.getMaxTokens(request);
    if (maxTokens !== undefined) {
      body['max_output_tokens'] = maxTokens;
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

    try {
      const httpResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!httpResponse.ok) {
        const errorData = await httpResponse.json() as WenxinError;
        throw new Error(
          `Wenxin API error: ${errorData.error_msg ?? httpResponse.statusText}`
        );
      }

      const data = await httpResponse.json() as WenxinChatResponse;
      
      if (!data.result) {
        throw new Error('No response from Wenxin API');
      }

      return {
        content: data.result,
        model: this.getModel(request),
        provider: this.provider,
        usage: {
          promptTokens: data.usage?.prompt_tokens ?? 0,
          completionTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Wenxin service error: ${error.message}`);
      }
      throw new Error('Unknown error occurred in Wenxin service');
    }
  }

  private async getAccessToken(): Promise<string> {
    const apiKey = this.config.apiKey;
    const secretKey = this.config.secretKey;
    
    if (!apiKey || !secretKey) {
      throw new Error('Wenxin API key and secret key are required');
    }

    const url = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to get Wenxin access token');
      }

      const data = await response.json() as { access_token: string };
      return data.access_token;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get Wenxin access token: ${error.message}`);
      }
      throw new Error('Unknown error occurred while getting Wenxin access token');
    }
  }
}
