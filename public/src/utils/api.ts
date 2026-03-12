import type { CopywritingFormData, GenerationResult, SSEEvent, PromptPreview } from '../types/index.js';
import type { InstanceSummary, ModelParameters, ProviderInfo } from '../types/provider.js';
import type { ScoringResult } from '../types/scoring.js';
import type { CustomTone } from '../types/custom-tone.js';
import { createLogger } from './logger.js';

const logger = createLogger('API');

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string = '') {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    const data = await response.json();
    return data;
  }

  async getProviders(): Promise<{
    providers: ProviderInfo[];
    instances: InstanceSummary[];
    defaultInstanceId: string;
  }> {
    return this.request('/api/providers');
  }

  async createInstance(data: {
    provider: string;
    name?: string;
    apiKey: string;
    secretKey?: string;
    model: string;
    baseUrl?: string;
  }): Promise<{ success: boolean; message: string; instanceId?: string }> {
    return this.request('/api/providers/instances', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInstance(
    instanceId: string,
    data: {
      name?: string;
      apiKey?: string;
      secretKey?: string;
      model?: string;
      baseUrl?: string;
    }
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/providers/instances/${instanceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteInstance(instanceId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/providers/instances/${instanceId}`, {
      method: 'DELETE',
    });
  }

  async setDefaultInstance(instanceId: string): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/providers/instances/${instanceId}/default`, {
      method: 'POST',
    });
  }

  async validateProvider(data: {
    provider: string;
    apiKey: string;
    secretKey?: string;
    baseUrl?: string;
    model: string;
  }): Promise<{ success: boolean; message: string }> {
    return this.request('/api/providers/validate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateInstanceParameters(
    instanceId: string,
    parameters: ModelParameters
  ): Promise<{ success: boolean; message: string }> {
    return this.request(`/api/providers/instances/${instanceId}/parameters`, {
      method: 'PUT',
      body: JSON.stringify(parameters),
    });
  }

  async previewPrompt(data: CopywritingFormData): Promise<{
    success: boolean;
    prompts?: PromptPreview;
    error?: string;
  }> {
    return this.request('/api/copywriting/preview', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateWithPrompt(data: {
    instanceId: string;
    systemPrompt: string;
    userPrompt: string;
    count: number;
  }): Promise<{
    success: boolean;
    results?: GenerationResult[];
    instanceId?: string;
    error?: string;
  }> {
    return this.request('/api/copywriting/generate-with-prompt', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async *generateStream(
    data: CopywritingFormData
  ): AsyncGenerator<SSEEvent, void, unknown> {
    const url = `${this.baseUrl}/api/copywriting/generate-stream`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: '请求失败' }));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('无法读取响应流');
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
        if (line.startsWith('event: ')) {
          continue;
        }
        
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);
          try {
            const event = JSON.parse(dataStr);
            yield event;
          } catch (parseError) {
            logger.warn('解析SSE数据失败:', parseError);
          }
        }
      }
    }
  }

  async getScore(content: string, instanceId: string): Promise<ScoringResult | null> {
    try {
      const result = await this.request<{ success: boolean; score?: ScoringResult }>(
        '/api/copywriting/score',
        {
          method: 'POST',
          body: JSON.stringify({ content, instanceId }),
        }
      );
      return result.success && result.score ? result.score : null;
    } catch (error) {
      logger.error('获取评分失败:', error);
      return null;
    }
  }

  async getCustomTones(): Promise<{ success: boolean; customTones: CustomTone[] }> {
    return this.request('/api/copywriting/custom-tones');
  }

  async createCustomTone(data: {
    name: string;
    description: string;
  }): Promise<{ success: boolean; error?: string }> {
    return this.request('/api/copywriting/custom-tones', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCustomTone(
    toneId: string,
    data: { name: string; description: string }
  ): Promise<{ success: boolean; error?: string }> {
    return this.request(`/api/copywriting/custom-tones/${toneId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCustomTone(toneId: string): Promise<{ success: boolean; error?: string }> {
    return this.request(`/api/copywriting/custom-tones/${toneId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new ApiClient();
