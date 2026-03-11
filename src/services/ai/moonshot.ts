import type { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIProviderConfig
} from '../../types';
import { BaseAIService } from './base';
import { createLogger, logApiCall } from '../../utils/logger';

const logger = createLogger('Moonshot');

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
    logger.debug('Moonshot 服务初始化完成');
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const timer = logger.timer('chat');
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const url = `${baseUrl}/chat/completions`;
    const model = this.getModel(request);
    
    logger.debug(`发送请求到 Moonshot API: ${model}`);
    
    const body = this.buildRequestBody(request);

    try {
      const httpStart = Date.now();
      const httpResponse = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!httpResponse.ok) {
        let errorMessage = `Moonshot API error: ${httpResponse.status} ${httpResponse.statusText}`;
        try {
          const errorData = await httpResponse.json() as MoonshotError;
          if (errorData.error?.message) {
            errorMessage = `Moonshot API error: ${errorData.error.message}`;
          }
        } catch {
          const textResponse = await httpResponse.text().catch(() => '');
          if (textResponse) {
            errorMessage = `Moonshot API error: ${textResponse.substring(0, 200)}`;
          }
        }
        logger.error(`API 请求失败: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const data = await httpResponse.json() as MoonshotChatResponse;
      const httpDuration = Date.now() - httpStart;
      
      const firstChoice = data.choices[0];
      if (!firstChoice) {
        logger.error('API 返回空响应');
        throw new Error('No response from Moonshot API');
      }

      const content = firstChoice.message.content;
      if (content === null) {
        logger.error('API 返回空内容');
        throw new Error('No content in Moonshot API response');
      }

      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined;

      logApiCall('Moonshot', model, usage?.promptTokens, usage?.completionTokens, httpDuration);

      const aiResponse: AIResponse = {
        content: content,
        model: data.model,
        provider: this.provider,
      };

      if (usage) {
        aiResponse.usage = usage;
      }

      timer();
      return aiResponse;
    } catch (error) {
      timer();
      if (error instanceof Error) {
        logger.error(`Moonshot 服务错误: ${error.message}`);
        throw new Error(`Moonshot service error: ${error.message}`);
      }
      throw new Error('Unknown error occurred in Moonshot service');
    }
  }
}
