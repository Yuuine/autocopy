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
}
