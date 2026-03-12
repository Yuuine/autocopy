import type { 
  AIProvider, 
  AIRequest, 
  AIResponse, 
  AIProviderConfig,
  AIStreamGenerator
} from '../../types';
import { BaseAIService } from './base';
import { createLogger, logApiCall } from '../../utils/logger';

const logger = createLogger('DeepSeek');

interface DeepSeekChatResponse {
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

interface DeepSeekStreamChunk {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: string;
      content?: string | null;
    };
    finish_reason: string | null;
  }>;
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
  private readonly defaultBaseUrl = 'https://api.deepseek.com';

  constructor(config: AIProviderConfig) {
    super(config);
    this.validateConfig();
    logger.debug('DeepSeek 服务初始化完成');
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    const timer = logger.timer('chat');
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const url = `${baseUrl}/chat/completions`;
    const model = this.getModel(request);
    
    logger.debug(`发送请求到 DeepSeek API: ${model}`);
    
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
        let errorMessage = `DeepSeek API error: ${httpResponse.status} ${httpResponse.statusText}`;
        try {
          const errorData = await httpResponse.json() as DeepSeekError;
          if (errorData.error?.message) {
            errorMessage = `DeepSeek API error: ${errorData.error.message}`;
          }
        } catch {
          const textResponse = await httpResponse.text().catch(() => '');
          if (textResponse) {
            errorMessage = `DeepSeek API error: ${textResponse.substring(0, 200)}`;
          }
        }
        logger.error(`API 请求失败: ${errorMessage}`);
        throw new Error(errorMessage);
      }

      const data = await httpResponse.json() as DeepSeekChatResponse;
      const httpDuration = Date.now() - httpStart;
      
      const firstChoice = data.choices[0];
      if (!firstChoice) {
        logger.error('API 返回空响应');
        throw new Error('No response from DeepSeek API');
      }

      const content = firstChoice.message.content;
      if (content === null) {
        logger.error('API 返回空内容');
        throw new Error('No content in DeepSeek API response');
      }

      const usage = data.usage ? {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      } : undefined;

      logApiCall('DeepSeek', model, usage?.promptTokens, usage?.completionTokens, httpDuration);

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
        logger.error(`DeepSeek 服务错误: ${error.message}`);
        throw new Error(`DeepSeek service error: ${error.message}`);
      }
      throw new Error('Unknown error occurred in DeepSeek service');
    }
  }

  async *chatStream(request: AIRequest): AIStreamGenerator {
    const timer = logger.timer('chatStream');
    const baseUrl = this.config.baseUrl ?? this.defaultBaseUrl;
    const url = `${baseUrl}/chat/completions`;
    const model = this.getModel(request);
    
    logger.debug(`发送流式请求到 DeepSeek API: ${model}`);
    
    const body = this.buildRequestBody(request, { stream: true });

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
        let errorMessage = `DeepSeek API error: ${httpResponse.status} ${httpResponse.statusText}`;
        try {
          const errorData = await httpResponse.json() as DeepSeekError;
          if (errorData.error?.message) {
            errorMessage = `DeepSeek API error: ${errorData.error.message}`;
          }
        } catch {
          const textResponse = await httpResponse.text().catch(() => '');
          if (textResponse) {
            errorMessage = `DeepSeek API error: ${textResponse.substring(0, 200)}`;
          }
        }
        logger.error(`API 请求失败: ${errorMessage}`);
        yield { content: '', done: true, error: errorMessage };
        return;
      }

      const reader = httpResponse.body?.getReader();
      if (!reader) {
        yield { content: '', done: true, error: 'Response body is not readable' };
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) {
            continue;
          }

          const data = trimmedLine.slice(6);
          if (data === '[DONE]') {
            const httpDuration = Date.now() - httpStart;
            logApiCall('DeepSeek', model, undefined, undefined, httpDuration);
            yield { content: '', done: true };
            timer();
            return;
          }

          try {
            const chunk = JSON.parse(data) as DeepSeekStreamChunk;
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              yield { content, done: false };
            }
          } catch (parseError) {
            logger.warn(`解析流式数据失败: ${parseError}`);
          }
        }
      }

      yield { content: '', done: true };
      timer();
    } catch (error) {
      timer();
      if (error instanceof Error) {
        logger.error(`DeepSeek 流式服务错误: ${error.message}`);
        yield { content: '', done: true, error: error.message };
      } else {
        yield { content: '', done: true, error: 'Unknown error occurred in DeepSeek stream service' };
      }
    }
  }
}
