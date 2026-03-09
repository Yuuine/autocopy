import type { AIProviderConfig, Tone, ArticleType, Platform } from '../types';

export interface AppConfig {
  ai: AIProviderConfig;
  generation: GenerationConfig;
  defaults: DefaultConfig;
}

export interface GenerationConfig {
  defaultCount: number;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export interface DefaultConfig {
  articleType: ArticleType;
  tone: Tone;
  platform: Platform;
  useParagraphs: boolean;
  useEmoji: boolean;
  wordCount: number;
}

export const defaultConfig: AppConfig = {
  ai: {
    apiKey: process.env['DEEPSEEK_API_KEY'] ?? '',
    baseUrl: process.env['DEEPSEEK_BASE_URL'] ?? 'https://api.deepseek.com/v1',
    model: process.env['DEEPSEEK_MODEL'] ?? 'deepseek-chat',
    defaultTemperature: 0.7,
    defaultMaxTokens: 2000,
  },
  generation: {
    defaultCount: 3,
    defaultTemperature: 0.8,
    defaultMaxTokens: 1500,
  },
  defaults: {
    articleType: '其他',
    tone: '轻松',
    platform: '通用',
    useParagraphs: true,
    useEmoji: false,
    wordCount: 200,
  },
};

export function createConfig(overrides?: Partial<AppConfig>): AppConfig {
  if (!overrides) {
    return defaultConfig;
  }

  return {
    ai: { ...defaultConfig.ai, ...overrides.ai },
    generation: { ...defaultConfig.generation, ...overrides.generation },
    defaults: { ...defaultConfig.defaults, ...overrides.defaults },
  };
}
