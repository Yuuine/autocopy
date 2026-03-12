import type { BaseAIService } from '../ai';
import type { ScoringResult, ScoringDetail } from '../../types/copywriting';
import { createLogger } from '../../utils/logger';

const logger = createLogger('Scoring');

const SCORING_PROMPT = `你是一位专业的文案诊断分析专家。请对用户的文案进行全面评估，从多个维度进行打分，并提供整体诊断分析和改进建议。

评分维度及标准（满分100分）：

1. 内容相关性（25分）
   - 评分标准：文案内容是否紧扣主题，是否偏离用户需求
   - 25分：完全切题，内容精准
   - 18-24分：基本相关，有小幅偏离
   - 10-17分：部分相关，有明显偏题
   - 0-9分：严重偏离主题

2. 结构逻辑性（25分）
   - 评分标准：文案结构是否清晰，逻辑是否连贯，层次是否分明
   - 25分：结构严谨，逻辑清晰，层次分明
   - 18-24分：结构较好，逻辑基本通顺
   - 10-17分：结构松散，逻辑有断层
   - 0-9分：结构混乱，逻辑不清

3. 语言表达力（25分）
   - 评分标准：用词是否精准，句式是否多样，语言是否有感染力
   - 25分：语言精炼，表达生动，感染力强
   - 18-24分：语言流畅，表达较好
   - 10-17分：语言平淡，表达一般
   - 0-9分：语言粗糙，表达欠佳

4. 目标适配度（25分）
   - 评分标准：是否符合目标受众特点，是否达成文案目标，语气风格是否恰当
   - 25分：完全适配，精准触达目标受众
   - 18-24分：基本适配，效果较好
   - 10-17分：适配度一般，有改进空间
   - 0-9分：适配度差，难以达成目标

请以JSON格式返回评分结果，格式如下：
{
  "details": [
    {
      "criteria": "内容相关性",
      "score": 95,
      "maxScore": 100
    },
    {
      "criteria": "结构逻辑性",
      "score": 90,
      "maxScore": 100
    },
    {
      "criteria": "语言表达力",
      "score": 85,
      "maxScore": 100
    },
    {
      "criteria": "目标适配度",
      "score": 82,
      "maxScore": 100
    }
  ],
  "diagnosis": "整体诊断分析：针对文案的整体性分析，总结其核心优势与主要问题，控制在100-200字以内...",
  "suggestions": ["具体可操作的改进建议1", "具体可操作的改进建议2", "具体可操作的改进建议3"]
}

注意：
1. details数组必须包含4个维度：内容相关性、结构逻辑性、语言表达力、目标适配度
2. 每个维度的maxScore都是100，score根据评分标准给出合理分数
3. diagnosis字段是一段整体性分析文字，不是数组
4. suggestions数组提供3-5条简短、具体、可操作的改进建议
5. 请确保返回的是纯JSON格式，不要包含任何其他文字说明`;

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
        score: Math.min(Math.max(0, Number(d.score) || 0), Number(d.maxScore) || 100),
        maxScore: Number(d.maxScore) || 100,
      }));

      const totalScore = details.reduce((sum, d) => sum + d.score, 0);
      const maxScore = details.length * 100;
      const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

      const { grade, gradeLabel } = this.getGrade(percentage);

      return {
        totalScore,
        maxScore,
        percentage,
        grade,
        gradeLabel,
        details,
        diagnosis: parsed.diagnosis || '暂无诊断分析',
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      };
    } catch (error) {
      console.error('Failed to parse scoring result:', error);
      return this.getDefaultScoringResult();
    }
  }

  private getGrade(percentage: number): { grade: ScoringResult['grade']; gradeLabel: string } {
    if (percentage >= 90) return { grade: 'excellent', gradeLabel: '优秀' };
    if (percentage >= 75) return { grade: 'good', gradeLabel: '良好' };
    if (percentage >= 60) return { grade: 'needs_improvement', gradeLabel: '需改进' };
    return { grade: 'poor', gradeLabel: '差' };
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
      maxScore: 400,
      percentage: 0,
      grade: 'poor',
      gradeLabel: '差',
      details: [
        { criteria: '内容相关性', score: 0, maxScore: 100 },
        { criteria: '结构逻辑性', score: 0, maxScore: 100 },
        { criteria: '语言表达力', score: 0, maxScore: 100 },
        { criteria: '目标适配度', score: 0, maxScore: 100 },
      ],
      diagnosis: '评分解析失败，请重试',
      suggestions: ['请重新生成文案并再次评分'],
    };
  }
}
