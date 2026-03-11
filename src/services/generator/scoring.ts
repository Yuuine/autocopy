import type { BaseAIService } from '../ai';
import type { ScoringResult, ScoringDetail } from '../../types/copywriting';
import { createLogger } from '../../utils/logger';

const logger = createLogger('Scoring');

const SCORING_PROMPT = `你是一位专业的文案评分专家。请对以下文案进行全面评估，从多个维度给出评分和详细点评。

评分维度及标准：
1. 内容相关性（20分）：文案内容是否紧扣主题，是否满足用户需求
2. 语言表达（20分）：文字是否流畅、准确、有感染力
3. 结构逻辑（20分）：段落组织是否合理，逻辑是否清晰
4. 创意创新（20分）：是否有独特的切入点或表达方式
5. 目标达成（20分）：是否符合文案类型和语气要求，能否达成预期效果

请以JSON格式返回评分结果，格式如下：
{
  "details": [
    {
      "criteria": "内容相关性",
      "score": 18,
      "maxScore": 20,
      "comment": "具体点评..."
    },
    {
      "criteria": "语言表达",
      "score": 16,
      "maxScore": 20,
      "comment": "具体点评..."
    },
    {
      "criteria": "结构逻辑",
      "score": 17,
      "maxScore": 20,
      "comment": "具体点评..."
    },
    {
      "criteria": "创意创新",
      "score": 15,
      "maxScore": 20,
      "comment": "具体点评..."
    },
    {
      "criteria": "目标达成",
      "score": 18,
      "maxScore": 20,
      "comment": "具体点评..."
    }
  ],
  "summary": "总体评价...",
  "suggestions": ["改进建议1", "改进建议2"]
}

请确保返回的是纯JSON格式，不要包含任何其他文字说明。`;

export class ScoringService {
  constructor(private readonly aiService: BaseAIService) {}

  async scoreContent(
    content: string,
    context?: {
      articleType?: string;
      tone?: string;
      wordCount?: number;
    }
  ): Promise<ScoringResult> {
    const userPrompt = this.buildUserPrompt(content, context);
    
    logger.debug('开始评分, 内容长度:', content.length);
    
    const response = await this.aiService.chat({
      messages: [
        { role: 'system', content: SCORING_PROMPT },
        { role: 'user', content: userPrompt },
      ],
    });

    const result = this.parseScoringResult(response.content);
    logger.info(`评分完成: ${result.percentage}分`);
    
    return result;
  }

  private buildUserPrompt(
    content: string,
    context?: {
      articleType?: string;
      tone?: string;
      wordCount?: number;
    }
  ): string {
    let prompt = `请对以下文案进行评分：\n\n---\n${content}\n---\n`;
    
    if (context) {
      prompt += '\n文案背景信息：';
      if (context.articleType) {
        prompt += `\n- 文案类型：${context.articleType}`;
      }
      if (context.tone) {
        prompt += `\n- 语气风格：${context.tone}`;
      }
      if (context.wordCount) {
        prompt += `\n- 目标字数：${context.wordCount}字`;
      }
    }
    
    return prompt;
  }

  private parseScoringResult(response: string): ScoringResult {
    try {
      const cleaned = this.extractJson(response);
      const parsed = JSON.parse(cleaned);
      
      const details: ScoringDetail[] = (parsed.details || []).map((d: any) => ({
        criteria: d.criteria || '未知维度',
        score: Math.min(Math.max(0, Number(d.score) || 0), Number(d.maxScore) || 20),
        maxScore: Number(d.maxScore) || 20,
        comment: d.comment || '',
      }));

      const totalScore = details.reduce((sum, d) => sum + d.score, 0);
      const maxScore = details.reduce((sum, d) => sum + d.maxScore, 0);
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      return {
        totalScore,
        maxScore,
        percentage,
        details,
        summary: parsed.summary || '暂无总体评价',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (error) {
      console.error('Failed to parse scoring result:', error);
      return this.getDefaultScoringResult();
    }
  }

  private extractJson(text: string): string {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return jsonMatch[0];
    }
    throw new Error('No JSON found in response');
  }

  private getDefaultScoringResult(): ScoringResult {
    return {
      totalScore: 0,
      maxScore: 100,
      percentage: 0,
      details: [
        { criteria: '内容相关性', score: 0, maxScore: 20, comment: '评分解析失败' },
        { criteria: '语言表达', score: 0, maxScore: 20, comment: '评分解析失败' },
        { criteria: '结构逻辑', score: 0, maxScore: 20, comment: '评分解析失败' },
        { criteria: '创意创新', score: 0, maxScore: 20, comment: '评分解析失败' },
        { criteria: '目标达成', score: 0, maxScore: 20, comment: '评分解析失败' },
      ],
      summary: '评分解析失败，请重试',
      suggestions: ['请重新生成文案并再次评分'],
    };
  }
}
