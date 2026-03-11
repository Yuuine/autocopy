import type { AIProvider } from '../types';

export interface ProviderDefaultConfig {
  baseUrl: string;
  models: string[];
  defaultModel: string;
}

export const PROVIDER_DEFAULTS: Record<AIProvider, ProviderDefaultConfig> = {
  deepseek: {
    baseUrl: 'https://api.deepseek.com',
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    defaultModel: 'deepseek-chat',
  },
  moonshot: {
    baseUrl: 'https://api.moonshot.cn/v1',
    models: ['kimi-k2.5', 'kimi-k2-turbo-preview', 'kimi-k2-0711-preview'],
    defaultModel: 'kimi-k2-turbo-preview',
  },
};

export function getProviderDefaults(provider: AIProvider): ProviderDefaultConfig {
  return PROVIDER_DEFAULTS[provider];
}

export function getProviderModels(provider: AIProvider): string[] {
  return PROVIDER_DEFAULTS[provider]?.models || [];
}

export function isValidModel(provider: AIProvider, model: string): boolean {
  return PROVIDER_DEFAULTS[provider]?.models.includes(model) || false;
}
