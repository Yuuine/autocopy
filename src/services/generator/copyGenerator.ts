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
      temperature: options?.temperature ?? 0.8,
    };

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
    const results: CopywritingResult[] = [];

    for (let i = 0; i < count; i++) {
      const modifiedRequest: CopywritingRequest = {
        ...request,
        additionalRequirements: [
          request.additionalRequirements ?? '',
          `这是第 ${i + 1} 个版本，请尝试不同的切入角度和表达方式。`,
        ].filter(Boolean).join('\n'),
      };

      const result = await this.generateSingle(modifiedRequest, options);
      results.push(result);
    }

    return results;
  }

  private createResult(
    content: string, 
    request: CopywritingRequest
  ): CopywritingResult {
    const metadata: CopywritingMetadata = {
      articleType: request.articleType,
      tone: request.tone,
      platform: request.platform ?? '通用',
      hasEmoji: request.useEmoji,
      hasParagraphs: request.useParagraphs,
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
