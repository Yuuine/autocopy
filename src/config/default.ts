import type { Tone, ArticleType } from '../types';

export interface GenerationConfig {
  defaultCount: number;
  defaultTemperature: number;
  defaultMaxTokens: number;
}

export interface DefaultConfig {
  articleType: ArticleType;
  tone: Tone;
  useParagraphs: boolean;
  useEmoji: boolean;
  wordCount: number;
}

export const defaultGenerationConfig: GenerationConfig = {
  defaultCount: 3,
  defaultTemperature: 0.8,
  defaultMaxTokens: 1500,
};

export const defaultValues: DefaultConfig = {
  articleType: '其他',
  tone: '轻松',
  useParagraphs: true,
  useEmoji: false,
  wordCount: 200,
};
