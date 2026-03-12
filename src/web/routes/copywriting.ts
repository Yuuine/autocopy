import { Router, Request, Response, NextFunction } from 'express';
import type { CopywritingRequest } from '../../index';
import type { ProviderInstanceId } from '../../types';
import { AIServiceFactory } from '../../services/ai';
import { CopyGenerator, ScoringService } from '../../services/generator';
import type { GenerationOptions } from '../../types';
import { getInstanceDecrypted, getDefaultInstanceId, hasInstance, getInstance, getCustomTones, addCustomTone, updateCustomTone, deleteCustomTone, getCustomToneById } from '../../utils/userConfig';
import { createError } from '../middleware';
import { buildSystemPrompt, buildUserPrompt, buildMultiVersionPrompt } from '../../templates';
import { createLogger } from '../../utils/logger';

const router = Router();
const logger = createLogger('Copywriting');

interface GenerateRequestBody extends CopywritingRequest {
  instanceId?: ProviderInstanceId;
  count?: number;
  customToneId?: string;
  enableScoring?: boolean;
}

async function generateWithInstance(
  instanceId: ProviderInstanceId,
  request: CopywritingRequest,
  options?: { count?: number }
) {
  const timer = logger.timer('generateWithInstance');
  
  const config = getInstanceDecrypted(instanceId);
  
  if (!config) {
    throw new Error(`模型实例 ${instanceId} 未配置或已禁用`);
  }
  
  const instance = getInstance(instanceId);
  if (!instance) {
    throw new Error(`无法获取模型实例 ${instanceId}`);
  }
  
  logger.debug(`使用模型: ${instance.provider}/${instance.model || 'default'}`);
  
  const serviceConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model?: string | undefined } = {
    apiKey: config.apiKey,
    model: config.model ?? undefined,
  };
  
  if (config.secretKey) {
    serviceConfig.secretKey = config.secretKey;
  }
  if (config.baseUrl) {
    serviceConfig.baseUrl = config.baseUrl;
  }
  
  const aiService = AIServiceFactory.createService(instance.provider, serviceConfig);
  const generator = new CopyGenerator(aiService);
  
  const genOptions: GenerationOptions | undefined = options?.count !== undefined 
    ? { count: options.count }
    : undefined;
  
  const result = await generator.generate(request, genOptions);

  logger.debug(`生成结果: success=${result.success}, count=${result.results.length}`);
  
  timer();
  return result;
}

router.post('/generate', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const timer = logger.timer('POST /generate');
  
  try {
    const {
      articleType,
      tone,
      useParagraphs,
      useEmoji,
      useHashtag,
      content,
      wordCount,
      keywords,
      additionalRequirements,
      count,
      instanceId: requestedInstanceId,
      customToneId,
    } = req.body as GenerateRequestBody;

    logger.info(`收到生成请求: 类型=${articleType || '其他'}, 语气=${tone || '轻松'}, 字数=${wordCount}, 数量=${count || 3}`);

    if (!content || content.trim().length === 0) {
      logger.warn('请求验证失败: 内容描述为空');
      throw createError('内容描述不能为空', 400);
    }

    if (!wordCount || wordCount < 10 || wordCount > 2000) {
      logger.warn(`请求验证失败: 字数无效 ${wordCount}`);
      throw createError('字数要求必须在 10-2000 之间', 400);
    }

    const instanceId: ProviderInstanceId = requestedInstanceId ?? getDefaultInstanceId();
    
    if (!instanceId || !hasInstance(instanceId)) {
      const defaultId = getDefaultInstanceId();
      if (!defaultId || !hasInstance(defaultId)) {
        logger.warn('没有可用的模型实例');
        throw createError(
          '请先配置至少一个模型服务。前往"模型配置"页面添加您的 API 密钥。',
          400
        );
      }
    }

    logger.debug(`使用实例: ${instanceId}`);

    const request: CopywritingRequest = {
      articleType: articleType ?? '其他',
      tone: tone ?? '轻松',
      useParagraphs: useParagraphs ?? true,
      useEmoji: useEmoji ?? false,
      useHashtag: useHashtag ?? false,
      content,
      wordCount,
    };
    
    if (keywords) {
      request.keywords = keywords;
    }
    if (additionalRequirements) {
      request.additionalRequirements = additionalRequirements;
    }
    if (customToneId) {
      request.customToneId = customToneId;
    }

    const result = await generateWithInstance(instanceId, request, {
      count: count ?? 3,
    });

    if (result.success) {
      logger.info(`生成成功: ${result.results.length} 个结果`);
    } else {
      logger.warn(`生成失败: ${result.error}`);
    }

    res.json({
      ...result,
      instanceId,
    });
    
    timer();
  } catch (error) {
    timer();
    logger.error('生成请求出错:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return next(createError('API 密钥无效或已过期，请检查配置', 401));
      }
      return next(createError(error.message, 400));
    }
    next(createError('生成失败', 500));
  }
});

router.post('/generate-stream', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      articleType,
      tone,
      useParagraphs,
      useEmoji,
      useHashtag,
      content,
      wordCount,
      keywords,
      additionalRequirements,
      count,
      instanceId: requestedInstanceId,
      customToneId,
    } = req.body as GenerateRequestBody;

    if (!content || content.trim().length === 0) {
      logger.warn('请求验证失败: 内容描述为空');
      throw createError('内容描述不能为空', 400);
    }

    const instanceId = requestedInstanceId ?? getDefaultInstanceId();
    
    if (!instanceId || !hasInstance(instanceId)) {
      logger.warn(`模型实例不存在: ${instanceId}`);
      throw createError('请先配置模型实例', 400);
    }

    const config = getInstanceDecrypted(instanceId);
    if (!config) {
      throw createError(`模型实例 ${instanceId} 未配置或已禁用`, 400);
    }

    const instance = getInstance(instanceId);
    if (!instance) {
      throw createError(`无法获取模型实例 ${instanceId}`, 400);
    }

    let finalTone = tone || '轻松';
    if (customToneId) {
      const customTone = getCustomToneById(customToneId);
      if (customTone) {
        finalTone = customTone.name as typeof finalTone;
      }
    }

    const request: CopywritingRequest = {
      articleType: articleType || '推广文案',
      tone: finalTone as import('../../types').Tone,
      useParagraphs: useParagraphs ?? true,
      useEmoji: useEmoji ?? false,
      useHashtag: useHashtag ?? false,
      content: content.trim(),
      wordCount: wordCount ?? 500,
      ...(keywords && keywords.length > 0 ? { keywords } : {}),
      ...(additionalRequirements ? { additionalRequirements } : {}),
    };

    const serviceConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model?: string | undefined } = {
      apiKey: config.apiKey,
      model: config.model ?? undefined,
    };
    
    if (config.secretKey) {
      serviceConfig.secretKey = config.secretKey;
    }
    if (config.baseUrl) {
      serviceConfig.baseUrl = config.baseUrl;
    }

    const aiService = AIServiceFactory.createService(instance.provider, serviceConfig);
    const generator = new CopyGenerator(aiService);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const sendEvent = (event: string, data: unknown) => {
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    try {
      const stream = generator.generateStream(request, { count: count ?? 3 });
      
      for await (const chunk of stream) {
        if (res.writableEnded) break;
        
        switch (chunk.type) {
          case 'version_start':
            sendEvent('version_start', {
              versionIndex: chunk.versionIndex,
              totalVersions: chunk.totalVersions,
            });
            break;
          case 'content_start':
            sendEvent('content_start', {
              versionIndex: chunk.versionIndex,
            });
            break;
          case 'content':
            sendEvent('content', {
              versionIndex: chunk.versionIndex,
              content: chunk.content,
            });
            break;
          case 'version_complete':
            sendEvent('version_complete', {
              versionIndex: chunk.versionIndex,
              result: chunk.result,
            });
            break;
          case 'error':
            sendEvent('error', {
              versionIndex: chunk.versionIndex,
              error: chunk.error,
            });
            break;
          case 'complete':
            sendEvent('complete', {});
            break;
        }
      }
    } catch (streamError) {
      logger.error('流式生成出错:', streamError instanceof Error ? streamError.message : streamError);
      sendEvent('error', { error: streamError instanceof Error ? streamError.message : 'Unknown error' });
    }

    res.end();
  } catch (error) {
    logger.error('流式生成请求出错:', error instanceof Error ? error.message : error);
    
    if (!res.headersSent) {
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          return next(createError('API 密钥无效或已过期，请检查配置', 401));
        }
        return next(createError(error.message, 400));
      }
      next(createError('生成失败', 500));
    }
  }
});

router.get('/options', (_req: Request, res: Response): void => {
  res.json({
    articleTypes: [
      { value: '推广文案', label: '推广文案' },
      { value: '产品介绍', label: '产品介绍' },
      { value: '活动宣传', label: '活动宣传' },
      { value: '品牌故事', label: '品牌故事' },
      { value: '知识分享', label: '知识分享' },
      { value: '情感表达', label: '情感表达' },
      { value: '新闻资讯', label: '新闻资讯' },
      { value: '其他', label: '其他' },
    ],
    tones: [
      { value: '正式', label: '正式' },
      { value: '轻松', label: '轻松' },
      { value: '幽默', label: '幽默' },
      { value: '专业', label: '专业' },
      { value: '亲切', label: '亲切' },
      { value: '激情', label: '激情' },
      { value: '温暖', label: '温暖' },
      { value: '客观', label: '客观' },
    ],
  });
});

router.post('/preview', (req: Request, res: Response): void => {
  try {
    const {
      articleType,
      tone,
      useParagraphs,
      useEmoji,
      useHashtag,
      content,
      wordCount,
      keywords,
      additionalRequirements,
      count,
      customToneId,
    } = req.body as GenerateRequestBody;

    if (!content || content.trim().length === 0) {
      throw createError('内容描述不能为空', 400);
    }

    if (!wordCount || wordCount < 10 || wordCount > 2000) {
      throw createError('字数要求必须在 10-2000 之间', 400);
    }

    const request: CopywritingRequest = {
      articleType: articleType ?? '其他',
      tone: tone ?? '轻松',
      useParagraphs: useParagraphs ?? true,
      useEmoji: useEmoji ?? false,
      useHashtag: useHashtag ?? false,
      content,
      wordCount,
    };
    
    if (keywords) {
      request.keywords = keywords;
    }
    if (additionalRequirements) {
      request.additionalRequirements = additionalRequirements;
    }
    if (customToneId) {
      request.customToneId = customToneId;
    }

    const systemPrompt = buildSystemPrompt(request);
    const versionCount = count ?? 3;
    const userPrompt = versionCount > 1 
      ? buildMultiVersionPrompt(request, versionCount) 
      : buildUserPrompt(request);

    res.json({
      success: true,
      prompts: {
        system: systemPrompt,
        user: userPrompt,
      },
      request,
      count: versionCount,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw createError(error.message, 400);
    }
    throw createError('预览生成失败', 500);
  }
});

interface GenerateWithPromptBody {
  instanceId?: ProviderInstanceId;
  systemPrompt: string;
  userPrompt: string;
  count?: number;
  temperature?: number;
  maxTokens?: number;
}

router.post('/generate-with-prompt', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      instanceId: requestedInstanceId,
      systemPrompt,
      userPrompt,
      count,
      temperature,
      maxTokens,
    } = req.body as GenerateWithPromptBody;

    if (!systemPrompt || !userPrompt) {
      throw createError('系统提示词和用户提示词不能为空', 400);
    }

    const instanceId: ProviderInstanceId = requestedInstanceId ?? getDefaultInstanceId();
    
    if (!instanceId || !hasInstance(instanceId)) {
      throw createError(
        '请先配置至少一个模型服务。前往"模型配置"页面添加您的 API 密钥。',
        400
      );
    }

    const config = getInstanceDecrypted(instanceId);
    
    if (!config) {
      throw createError(`模型实例 ${instanceId} 未配置或已启用`, 400);
    }

    const instance = getInstance(instanceId);
    if (!instance) {
      throw createError(`无法获取模型实例 ${instanceId}`, 400);
    }

    const serviceConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model?: string | undefined } = {
      apiKey: config.apiKey,
      model: config.model ?? undefined,
    };
    
    if (config.secretKey) {
      serviceConfig.secretKey = config.secretKey;
    }
    if (config.baseUrl) {
      serviceConfig.baseUrl = config.baseUrl;
    }

    const aiService = AIServiceFactory.createService(instance.provider, serviceConfig);
    const generator = new CopyGenerator(aiService);

    const generateOptions: {
      systemPrompt: string;
      userPrompt: string;
      count: number;
      temperature?: number;
      maxTokens?: number;
    } = {
      systemPrompt,
      userPrompt,
      count: count ?? 3,
    };

    if (temperature !== undefined) {
      generateOptions.temperature = temperature;
    }
    if (maxTokens !== undefined) {
      generateOptions.maxTokens = maxTokens;
    }

    const result = await generator.generateWithCustomPrompt(generateOptions);

    res.json({
      ...result,
      instanceId,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return next(createError('API 密钥无效或已过期，请检查配置', 401));
      }
      return next(createError(error.message, 400));
    }
    next(createError('生成失败', 500));
  }
});

router.get('/custom-tones', (_req: Request, res: Response): void => {
  try {
    const customTones = getCustomTones();
    res.json({
      success: true,
      customTones,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw createError(error.message, 400);
    }
    throw createError('获取自定义语气失败', 500);
  }
});

interface AddCustomToneBody {
  name: string;
  description: string;
}

router.post('/custom-tones', (req: Request, res: Response): void => {
  try {
    const { name, description } = req.body as AddCustomToneBody;

    if (!name || name.trim().length === 0) {
      throw createError('语气名称不能为空', 400);
    }

    if (name.length > 8) {
      throw createError('语气名称不能超过8个汉字', 400);
    }

    if (!description || description.trim().length === 0) {
      throw createError('语气说明不能为空', 400);
    }

    if (description.length > 500) {
      throw createError('语气说明不能超过500个汉字', 400);
    }

    const customTone = addCustomTone(name.trim(), description.trim());
    res.json({
      success: true,
      customTone,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw createError(error.message, 400);
    }
    throw createError('添加自定义语气失败', 500);
  }
});

interface UpdateCustomToneBody {
  name: string;
  description: string;
}

router.put('/custom-tones/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw createError('缺少语气ID', 400);
    }
    
    const { name, description } = req.body as UpdateCustomToneBody;

    if (!name || name.trim().length === 0) {
      throw createError('语气名称不能为空', 400);
    }

    if (name.length > 8) {
      throw createError('语气名称不能超过8个汉字', 400);
    }

    if (!description || description.trim().length === 0) {
      throw createError('语气说明不能为空', 400);
    }

    if (description.length > 500) {
      throw createError('语气说明不能超过500个汉字', 400);
    }

    const customTone = updateCustomTone(id, name.trim(), description.trim());
    
    if (!customTone) {
      throw createError('自定义语气不存在', 404);
    }

    res.json({
      success: true,
      customTone,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw createError(error.message, 400);
    }
    throw createError('更新自定义语气失败', 500);
  }
});

router.delete('/custom-tones/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw createError('缺少语气ID', 400);
    }
    
    const success = deleteCustomTone(id);
    
    if (!success) {
      throw createError('自定义语气不存在', 404);
    }

    res.json({
      success: true,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw createError(error.message, 400);
    }
    throw createError('删除自定义语气失败', 500);
  }
});

router.get('/custom-tones/:id', (req: Request, res: Response): void => {
  try {
    const { id } = req.params;
    
    if (!id) {
      throw createError('缺少语气ID', 400);
    }
    
    const customTone = getCustomToneById(id);
    
    if (!customTone) {
      throw createError('自定义语气不存在', 404);
    }

    res.json({
      success: true,
      customTone,
    });
  } catch (error) {
    if (error instanceof Error) {
      throw createError(error.message, 400);
    }
    throw createError('获取自定义语气失败', 500);
  }
});

interface ScoreContentBody {
  content: string;
  instanceId?: ProviderInstanceId;
  articleType?: string;
  tone?: string;
  wordCount?: number;
}

router.post('/score', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      content,
      instanceId: requestedInstanceId,
      articleType,
      tone,
      wordCount,
    } = req.body as ScoreContentBody;

    if (!content || content.trim().length === 0) {
      throw createError('文案内容不能为空', 400);
    }

    const instanceId: ProviderInstanceId = requestedInstanceId ?? getDefaultInstanceId();
    
    if (!instanceId || !hasInstance(instanceId)) {
      throw createError(
        '请先配置至少一个模型服务。前往"模型配置"页面添加您的 API 密钥。',
        400
      );
    }

    const config = getInstanceDecrypted(instanceId);
    
    if (!config) {
      throw createError(`模型实例 ${instanceId} 未配置或已禁用`, 400);
    }

    const instance = getInstance(instanceId);
    if (!instance) {
      throw createError(`无法获取模型实例 ${instanceId}`, 400);
    }

    const serviceConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model?: string | undefined } = {
      apiKey: config.apiKey,
      model: config.model ?? undefined,
    };
    
    if (config.secretKey) {
      serviceConfig.secretKey = config.secretKey;
    }
    if (config.baseUrl) {
      serviceConfig.baseUrl = config.baseUrl;
    }

    const aiService = AIServiceFactory.createService(instance.provider, serviceConfig);
    const scoringService = new ScoringService(aiService);

    const scoringContext: { articleType?: string; tone?: string; wordCount?: number } = {};
    if (articleType) scoringContext.articleType = articleType;
    if (tone) scoringContext.tone = tone;
    if (wordCount) scoringContext.wordCount = wordCount;

    const result = await scoringService.scoreContent(content, scoringContext);

    res.json({
      success: true,
      score: result,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        return next(createError('API 密钥无效或已过期，请检查配置', 401));
      }
      return next(createError(error.message, 400));
    }
    next(createError('评分失败', 500));
  }
});

export default router;
