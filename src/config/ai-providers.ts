import type { AIProvider } from '../types';

export interface ProviderDefaultConfig {
  baseUrl: string;
  model: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export const PROVIDER_DEFAULTS: Record<AIProvider, ProviderDefaultConfig> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    model: 'deepseek-chat',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-3-opus-20240229',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
  wenxin: {
    baseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    model: 'ernie-bot-4',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
  qwen: {
    baseUrl: 'https://dashscope.aliyuncs.com/api/v1',
    model: 'qwen-turbo',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    model: 'gemini-pro',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
};

export function getProviderDefaults(provider: AIProvider): ProviderDefaultConfig {
  return PROVIDER_DEFAULTS[provider];
}
