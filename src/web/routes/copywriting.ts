import { Router, Request, Response } from 'express';
import type { CopywritingRequest } from '../../index';
import type { AIProvider } from '../../types';
import { AIServiceFactory } from '../../services/ai';
import { CopyGenerator } from '../../services/generator';
import type { GenerationOptions } from '../../types';
import { getDecryptedProviderConfig, getDefaultProvider, hasProviderConfig, getCustomTones, addCustomTone, updateCustomTone, deleteCustomTone, getCustomToneById } from '../../utils/userConfig';
import { createError } from '../middleware';
import { buildSystemPrompt, buildUserPrompt, buildMultiVersionPrompt } from '../../templates';

const router = Router();

interface GenerateRequestBody extends CopywritingRequest {
  provider?: AIProvider;
  count?: number;
  customToneId?: string;
}

async function generateWithProvider(
  provider: AIProvider,
  request: CopywritingRequest,
  options?: { count?: number }
) {
  const config = getDecryptedProviderConfig(provider);
  
  if (!config) {
    throw new Error(`模型 ${provider} 未配置或未启用`);
  }
  
  const serviceConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model?: string } = {
    apiKey: config.apiKey,
  };
  
  if (config.secretKey) {
    serviceConfig.secretKey = config.secretKey;
  }
  if (config.baseUrl) {
    serviceConfig.baseUrl = config.baseUrl;
  }
  if (config.model) {
    serviceConfig.model = config.model;
  }
  
  const aiService = AIServiceFactory.createService(provider, serviceConfig);
  const generator = new CopyGenerator(aiService);
  
  const genOptions: GenerationOptions | undefined = options?.count !== undefined 
    ? { count: options.count }
    : undefined;
  
  return generator.generate(request, genOptions);
}

router.post('/generate', async (req: Request, res: Response): Promise<void> => {
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
      provider: requestedProvider,
      customToneId,
    } = req.body as GenerateRequestBody;

    if (!content) {
      throw createError('内容描述不能为空', 400);
    }

    if (!wordCount || wordCount < 10 || wordCount > 2000) {
      throw createError('字数要求必须在 10-2000 之间', 400);
    }

    const provider: AIProvider = requestedProvider ?? getDefaultProvider();
    
    if (!hasProviderConfig(provider)) {
      const defaultConfigured = hasProviderConfig(getDefaultProvider());
      if (!defaultConfigured) {
        throw createError(
          '请先配置至少一个模型服务。前往"模型配置"页面添加您的 API 密钥。',
          400
        );
      }
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

    const result = await generateWithProvider(provider, request, {
      count: count ?? 3,
    });

    res.json({
      ...result,
      provider,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw createError('API 密钥无效或已过期，请检查配置', 401);
      }
      throw createError(error.message, 400);
    }
    throw createError('生成失败', 500);
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

    if (!content) {
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
  provider?: AIProvider;
  systemPrompt: string;
  userPrompt: string;
  count?: number;
  temperature?: number;
  maxTokens?: number;
}

router.post('/generate-with-prompt', async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      provider: requestedProvider,
      systemPrompt,
      userPrompt,
      count,
      temperature,
      maxTokens,
    } = req.body as GenerateWithPromptBody;

    if (!systemPrompt || !userPrompt) {
      throw createError('系统提示词和用户提示词不能为空', 400);
    }

    const provider: AIProvider = requestedProvider ?? getDefaultProvider();
    
    if (!hasProviderConfig(provider)) {
      throw createError(
        '请先配置至少一个模型服务。前往"模型配置"页面添加您的 API 密钥。',
        400
      );
    }

    const config = getDecryptedProviderConfig(provider);
    
    if (!config) {
      throw createError(`模型 ${provider} 未配置或未启用`, 400);
    }

    const serviceConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model?: string } = {
      apiKey: config.apiKey,
    };
    
    if (config.secretKey) {
      serviceConfig.secretKey = config.secretKey;
    }
    if (config.baseUrl) {
      serviceConfig.baseUrl = config.baseUrl;
    }
    if (config.model) {
      serviceConfig.model = config.model;
    }

    const aiService = AIServiceFactory.createService(provider, serviceConfig);
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
      provider,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('API key')) {
        throw createError('API 密钥无效或已过期，请检查配置', 401);
      }
      throw createError(error.message, 400);
    }
    throw createError('生成失败', 500);
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

export default router;
