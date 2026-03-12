export interface PromptPreview {
  system: string;
  user: string;
}

export interface CopywritingFormData {
  articleType: string;
  tone: string;
  customToneId?: string;
  useParagraphs: boolean;
  useEmoji: boolean;
  useHashtag: boolean;
  content: string;
  wordCount: number;
  keywords?: string[];
  additionalRequirements?: string;
  count: number;
  instanceId: string;
  enableScoring: boolean;
}

export interface GenerationResult {
  content: string;
  wordCount: number;
}

export interface SSEEvent {
  versionIndex?: number;
  totalVersions?: number;
  content?: string;
  result?: GenerationResult;
  error?: string;
}
