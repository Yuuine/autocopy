import type { 
  CopywritingRequest, 
  CopywritingResult, 
  GenerationOptions,
  GenerationResult,
  CopywritingMetadata
} from '../../types';
import type { BaseAIService } from '../ai';
import { 
  buildSystemPrompt, 
  buildUserPrompt, 
  buildMultiVersionPrompt 
} from '../../templates';
import { 
  countWords, 
  splitByVersions, 
  generateId, 
  cleanResponse 
} from '../../utils';

export interface StreamGenerateOptions extends GenerationOptions {
  onVersionStart?: (versionIndex: number, totalVersions: number) => void;
  onVersionComplete?: (versionIndex: number, result: CopywritingResult) => void;
  onComplete?: (results: CopywritingResult[]) => void;
  onError?: (error: string) => void;
}

export class CopyGenerator {
  constructor(private readonly aiService: BaseAIService) {}

  async generate(
    request: CopywritingRequest,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const count = options?.count ?? 1;
    
    try {
      if (count === 1) {
        const result = await this.generateSingle(request, options);
        return {
          success: true,
          results: [result],
        };
      }

      const results = await this.generateMultiple(request, options);
      return {
        success: true,
        results,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        results: [],
        error: errorMessage,
      };
    }
  }

  async generateWithCustomPrompt(options: {
    systemPrompt: string;
    userPrompt: string;
    count?: number;
    temperature?: number;
    maxTokens?: number;
  }): Promise<GenerationResult> {
    const { systemPrompt, userPrompt, count = 3, temperature, maxTokens } = options;
    
    try {
      const chatRequest: import('../../types').AIRequest = {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      };

      if (temperature !== undefined) {
        chatRequest.temperature = temperature;
      }
      if (maxTokens !== undefined) {
        chatRequest.maxTokens = maxTokens;
      }

      const response = await this.aiService.chat(chatRequest);
      const cleanedContent = cleanResponse(response.content);

      if (count === 1) {
        return {
          success: true,
          results: [this.createResultFromContent(cleanedContent)],
        };
      }

      const versions = splitByVersions(cleanedContent);
      
      if (versions.length === 1 && count > 1) {
        const promises = Array.from({ length: count }, async (_, i) => {
          try {
            const modifiedUserPrompt = `${userPrompt}\n\n## 特别说明\n这是第 ${i + 1} 个版本，请尝试不同的切入角度和表达方式。`;
            const individualRequest: import('../../types').AIRequest = {
              messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: modifiedUserPrompt },
              ],
            };
            if (temperature !== undefined) {
              individualRequest.temperature = temperature;
            }
            if (maxTokens !== undefined) {
              individualRequest.maxTokens = maxTokens;
            }
            const response = await this.aiService.chat(individualRequest);
            return this.createResultFromContent(cleanResponse(response.content));
          } catch (error) {
            console.error(`Error generating version ${i + 1}:`, error);
            return this.createResultFromContent(`生成第 ${i + 1} 个版本时出错，请重试`);
          }
        });
        
        const results = await Promise.all(promises);
        return { success: true, results };
      }

      return {
        success: true,
        results: versions.map(content => this.createResultFromContent(content)),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        success: false,
        results: [],
        error: errorMessage,
      };
    }
  }

  private createResultFromContent(content: string): CopywritingResult {
    return {
      id: generateId(),
      content,
      wordCount: countWords(content),
      metadata: {
        articleType: '其他',
        tone: '轻松',
        hasEmoji: false,
        hasParagraphs: true,
        hasHashtag: false,
        createdAt: new Date(),
      },
    };
  }

  private async generateSingle(
    request: CopywritingRequest,
    options?: GenerationOptions
  ): Promise<CopywritingResult> {
    const systemPrompt = buildSystemPrompt(request);
    const userPrompt = buildUserPrompt(request);

    const chatRequest: import('../../types').AIRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    if (options?.temperature !== undefined) {
      chatRequest.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      chatRequest.maxTokens = options.maxTokens;
    }

    const response = await this.aiService.chat(chatRequest);

    const cleanedContent = cleanResponse(response.content);
    
    return this.createResult(cleanedContent, request);
  }

  private async generateMultiple(
    request: CopywritingRequest,
    options?: GenerationOptions
  ): Promise<CopywritingResult[]> {
    const count = options?.count ?? 3;
    
    const systemPrompt = buildSystemPrompt(request);
    const userPrompt = buildMultiVersionPrompt(request, count);

    const chatRequest: import('../../types').AIRequest = {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    };

    if (options?.temperature !== undefined) {
      chatRequest.temperature = options.temperature;
    }
    if (options?.maxTokens !== undefined) {
      chatRequest.maxTokens = options.maxTokens;
    }

    const response = await this.aiService.chat(chatRequest);

    const cleanedContent = cleanResponse(response.content);
    const versions = splitByVersions(cleanedContent);

    if (versions.length === 1 && count > 1) {
      return this.generateIndividually(request, options);
    }

    return versions.map(content => this.createResult(content, request));
  }

  private async generateIndividually(
    request: CopywritingRequest,
    options?: GenerationOptions
  ): Promise<CopywritingResult[]> {
    const count = options?.count ?? 3;
    
    const promises = Array.from({ length: count }, async (_, i) => {
      try {
        const modifiedRequest: CopywritingRequest = {
          ...request,
          additionalRequirements: [
            request.additionalRequirements ?? '',
            `这是第 ${i + 1} 个版本，请尝试不同的切入角度和表达方式。`,
          ].filter(Boolean).join('\n'),
        };

        return await this.generateSingle(modifiedRequest, options);
      } catch (error) {
        console.error(`Error generating individual version ${i + 1}:`, error);
        return this.createResult(`生成第 ${i + 1} 个版本时出错: ${error instanceof Error ? error.message : '未知错误'}`, request);
      }
    });

    return Promise.all(promises);
  }

  private createResult(
    content: string, 
    request: CopywritingRequest
  ): CopywritingResult {
    const metadata: CopywritingMetadata = {
      articleType: request.articleType,
      tone: request.tone,
      hasEmoji: request.useEmoji,
      hasParagraphs: request.useParagraphs,
      hasHashtag: request.useHashtag,
      createdAt: new Date(),
    };

    return {
      id: generateId(),
      content,
      wordCount: countWords(content),
      metadata,
    };
  }

  async *generateStream(
    request: CopywritingRequest,
    options?: GenerationOptions
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const count = options?.count ?? 3;
    const systemPrompt = buildSystemPrompt(request);
    
    const diversityStrategies = [
      '【版本差异化要求】请从用户痛点切入，以问题-解决方案的逻辑展开，采用故事叙述体结构，情感基调偏向理性客观。',
      '【版本差异化要求】请从场景故事切入，营造代入感和情感共鸣，采用清单体结构，情感基调偏向感性温暖。',
      '【版本差异化要求】请从数据事实切入，用权威信息建立信任，采用问答体结构，情感基调偏向专业权威。',
      '【版本差异化要求】请从热点话题切入，借势引发关注和讨论，采用对比体结构，情感基调偏向激情澎湃。',
      '【版本差异化要求】请从对比视角切入，突出差异化优势，采用递进体结构，情感基调偏向轻松幽默。',
      '【版本差异化要求】请从悬念设问切入，激发好奇心和阅读欲，采用总分体结构，情感基调偏向亲切对话。',
    ];
    
    for (let versionIndex = 0; versionIndex < count; versionIndex++) {
      yield {
        type: 'version_start',
        versionIndex,
        totalVersions: count,
      };

      const diversityHint = diversityStrategies[versionIndex % diversityStrategies.length];
      const modifiedRequest: CopywritingRequest = {
        ...request,
        additionalRequirements: [
          request.additionalRequirements ?? '',
          diversityHint,
        ].filter(Boolean).join('\n\n'),
      };

      const userPrompt = buildUserPrompt(modifiedRequest);

      try {
        const chatRequest: import('../../types').AIRequest = {
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        };

        if (options?.temperature !== undefined) {
          chatRequest.temperature = options.temperature;
        }
        if (options?.maxTokens !== undefined) {
          chatRequest.maxTokens = options.maxTokens;
        }

        yield* this.streamSingleVersion(chatRequest, versionIndex, request);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        yield {
          type: 'error',
          versionIndex,
          error: errorMessage,
        };
      }
    }

    yield { type: 'complete' };
  }

  private async *streamSingleVersion(
    chatRequest: import('../../types').AIRequest,
    versionIndex: number,
    request: CopywritingRequest
  ): AsyncGenerator<StreamChunk, void, unknown> {
    let accumulatedContent = '';

    yield {
      type: 'content_start',
      versionIndex,
    };

    try {
      const stream = this.aiService.chatStream(chatRequest);
      
      for await (const chunk of stream) {
        if (chunk.error) {
          yield {
            type: 'error',
            versionIndex,
            error: chunk.error,
          };
          return;
        }
        
        if (chunk.content) {
          accumulatedContent += chunk.content;
          yield {
            type: 'content',
            versionIndex,
            content: chunk.content,
          };
        }
        
        if (chunk.done) {
          break;
        }
      }

      const cleanedContent = cleanResponse(accumulatedContent);
      const wordCount = countWords(cleanedContent);

      yield {
        type: 'version_complete',
        versionIndex,
        result: {
          id: generateId(),
          content: cleanedContent,
          wordCount,
          metadata: {
            articleType: request.articleType,
            tone: request.tone,
            hasEmoji: request.useEmoji,
            hasParagraphs: request.useParagraphs,
            hasHashtag: request.useHashtag,
            createdAt: new Date(),
          },
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      yield {
        type: 'error',
        versionIndex,
        error: errorMessage,
      };
    }
  }
}

export interface StreamChunk {
  type: 'version_start' | 'content_start' | 'content' | 'version_complete' | 'error' | 'complete';
  versionIndex?: number;
  totalVersions?: number;
  content?: string;
  result?: CopywritingResult;
  error?: string;
}
