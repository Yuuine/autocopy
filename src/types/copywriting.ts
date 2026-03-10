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

export type Platform = 
  | '微信公众号'
  | '微博'
  | '小红书'
  | '抖音'
  | '朋友圈'
  | '通用';

export interface CopywritingRequest {
  articleType: ArticleType;
  tone: Tone;
  useParagraphs: boolean;
  useEmoji: boolean;
  useHashtag: boolean;
  content: string;
  wordCount: number;
  platform?: Platform;
  keywords?: string[];
  additionalRequirements?: string;
}

export interface CopywritingResult {
  id: string;
  content: string;
  wordCount: number;
  metadata: CopywritingMetadata;
}

export interface CopywritingMetadata {
  articleType: ArticleType;
  tone: Tone;
  platform: Platform;
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
