export type ArticleType = 
  | '推广文案'
  | '产品介绍'
  | '活动宣传'
  | '品牌故事'
  | '知识分享'
  | '情感表达'
  | '新闻资讯'
  | '其他';

export type Tone = 
  | '正式'
  | '轻松'
  | '幽默'
  | '专业'
  | '亲切'
  | '激情'
  | '温暖'
  | '客观';

export interface CustomTone {
  id: string;
  name: string;
  description: string;
  rules?: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface CopywritingRequest {
  articleType: ArticleType;
  tone: Tone;
  customToneId?: string;
  useParagraphs: boolean;
  useEmoji: boolean;
  useHashtag: boolean;
  content: string;
  wordCount: number;
  keywords?: string[];
  additionalRequirements?: string;
  targetAudience?: string;
  brandVoice?: string;
  productFeatures?: string[] | string;
  competitorReference?: string;
  forbiddenWords?: string[];
}

export interface CopywritingResult {
  id: string;
  content: string;
  wordCount: number;
  metadata: CopywritingMetadata;
  score?: ScoringResult;
}

export interface CopywritingMetadata {
  articleType: ArticleType;
  tone: Tone;
  hasEmoji: boolean;
  hasParagraphs: boolean;
  hasHashtag: boolean;
  createdAt: Date;
}

export interface GenerationOptions {
  count: number;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerationResult {
  success: boolean;
  results: CopywritingResult[];
  error?: string;
}

export interface ScoringCriteria {
  name: string;
  description: string;
  weight: number;
  maxScore: number;
}

export interface ScoringDetail {
  criteria: string;
  score: number;
  maxScore: number;
}

export interface ScoringResult {
  totalScore: number;
  maxScore: number;
  percentage: number;
  grade: 'excellent' | 'good' | 'needs_improvement' | 'poor';
  gradeLabel: string;
  details: ScoringDetail[];
  diagnosis: string;
  suggestions: string[];
}

export interface CopywritingResultWithScore extends CopywritingResult {
  score?: ScoringResult;
}
