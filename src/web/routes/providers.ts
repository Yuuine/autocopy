import { Router, Request, Response } from 'express';
import type { AIProvider, ModelParameters } from '../../types';
import { AIServiceFactory } from '../../services/ai';
import {
  setProviderConfig,
  removeProviderConfig,
  setDefaultProvider,
  getDefaultProvider,
  getEnabledProviders,
  hasProviderConfig,
  getAllProviderSummaries,
  getProviderConfigSummary,
  setProviderParameters,
  getProviderParameters,
  setGlobalParameters,
  getGlobalParameters,
  getEffectiveParameters,
} from '../../utils/userConfig';
import { validateApiKeyFormat } from '../../utils/encryption';
import { createError } from '../middleware';

const router = Router();

const PROVIDER_INFO: Record<AIProvider, {
  name: string;
  description: string;
  defaultModel: string;
  requiresSecretKey: boolean;
  models: string[];
}> = {
  deepseek: {
    name: 'DeepSeek',
    description: 'DeepSeek-V3.2 (128K上下文) 大模型服务',
    defaultModel: 'deepseek-chat',
    requiresSecretKey: false,
    models: ['deepseek-chat', 'deepseek-reasoner'],
  },
  openai: {
    name: 'OpenAI',
    description: 'OpenAI GPT 系列模型',
    defaultModel: 'gpt-4',
    requiresSecretKey: false,
    models: ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo'],
  },
  anthropic: {
    name: 'Claude',
    description: 'Anthropic Claude 系列模型',
    defaultModel: 'claude-3-opus-20240229',
    requiresSecretKey: false,
    models: ['claude-3-opus-20240229', 'claude-3-sonnet-20240229', 'claude-3-haiku-20240307'],
  },
  wenxin: {
    name: '文心一言',
    description: '百度文心大模型服务',
    defaultModel: 'ernie-bot-4',
    requiresSecretKey: true,
    models: ['ernie-bot-4', 'ernie-bot', 'ernie-bot-turbo'],
  },
  qwen: {
    name: '通义千问',
    description: '阿里云通义大模型服务',
    defaultModel: 'qwen-turbo',
    requiresSecretKey: false,
    models: ['qwen-turbo', 'qwen-plus', 'qwen-max'],
  },
  gemini: {
    name: 'Gemini',
    description: 'Google Gemini 大模型服务',
    defaultModel: 'gemini-pro',
    requiresSecretKey: false,
    models: ['gemini-pro', 'gemini-pro-vision'],
  },
};

router.get('/', (_req: Request, res: Response): void => {
  const providers = Object.entries(PROVIDER_INFO).map(([key, info]) => {
    const summary = getProviderConfigSummary(key as AIProvider);
    return {
      id: key as AIProvider,
      ...info,
      configured: hasProviderConfig(key as AIProvider),
      parameters: summary?.parameters,
    };
  });

  res.json({
    providers,
    defaultProvider: getDefaultProvider(),
    enabledProviders: getEnabledProviders(),
    globalParameters: getGlobalParameters(),
  });
});

router.get('/:provider', (req: Request, res: Response): void => {
  const provider = req.params['provider'] as AIProvider;
  
  if (!PROVIDER_INFO[provider]) {
    throw createError('不支持的模型提供商', 400);
  }

  const summary = getProviderConfigSummary(provider);
  
  res.json({
    id: provider,
    ...PROVIDER_INFO[provider],
    config: summary,
  });
});

router.post('/:provider', (req: Request, res: Response): void => {
  const provider = req.params['provider'] as AIProvider;
  const { apiKey, secretKey, baseUrl, model, parameters } = req.body;

  if (!PROVIDER_INFO[provider]) {
    throw createError('不支持的模型提供商', 400);
  }

  if (!apiKey || typeof apiKey !== 'string') {
    throw createError('API 密钥不能为空', 400);
  }

  if (!validateApiKeyFormat(provider, apiKey)) {
    throw createError('API 密钥格式不正确', 400);
  }

  if (PROVIDER_INFO[provider].requiresSecretKey && !secretKey) {
    throw createError(`${PROVIDER_INFO[provider].name} 需要提供 Secret Key`, 400);
  }

  const config = setProviderConfig(provider, apiKey, {
    secretKey,
    baseUrl,
    model: model ?? PROVIDER_INFO[provider].defaultModel,
    parameters,
  });

  res.json({
    success: true,
    message: `${PROVIDER_INFO[provider].name} 配置已保存`,
    config: {
      provider,
      enabled: config.enabled,
      apiKeyMasked: config.apiKey,
      model: config.model,
      parameters: config.parameters,
    },
  });
});

router.delete('/:provider', (req: Request, res: Response): void => {
  const provider = req.params['provider'] as AIProvider;

  if (!PROVIDER_INFO[provider]) {
    throw createError('不支持的模型提供商', 400);
  }

  const removed = removeProviderConfig(provider);

  if (!removed) {
    throw createError('该模型配置不存在', 404);
  }

  res.json({
    success: true,
    message: `${PROVIDER_INFO[provider].name} 配置已删除`,
  });
});

router.post('/:provider/default', (req: Request, res: Response): void => {
  const provider = req.params['provider'] as AIProvider;

  if (!PROVIDER_INFO[provider]) {
    throw createError('不支持的模型提供商', 400);
  }

  const success = setDefaultProvider(provider);

  if (!success) {
    throw createError('该模型未配置或未启用，无法设为默认', 400);
  }

  res.json({
    success: true,
    message: `${PROVIDER_INFO[provider].name} 已设为默认模型`,
    defaultProvider: provider,
  });
});

router.post('/:provider/validate', async (req: Request, res: Response): Promise<void> => {
  const provider = req.params['provider'] as AIProvider;
  const { apiKey, secretKey, baseUrl } = req.body;

  if (!PROVIDER_INFO[provider]) {
    throw createError('不支持的模型提供商', 400);
  }

  if (!apiKey) {
    throw createError('API 密钥不能为空', 400);
  }

  try {
    const testConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model: string } = {
      apiKey,
      model: PROVIDER_INFO[provider].defaultModel,
    };
    
    if (secretKey) {
      testConfig.secretKey = secretKey;
    }
    if (baseUrl) {
      testConfig.baseUrl = baseUrl;
    }

    const service = AIServiceFactory.createService(provider, testConfig);
    
    await service.chat({
      messages: [{ role: 'user', content: 'Hi' }],
      maxTokens: 10,
    });

    res.json({
      success: true,
      message: 'API 密钥验证成功',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '验证失败';
    res.status(400).json({
      success: false,
      message: `API 密钥验证失败: ${message}`,
    });
  }
});

router.get('/:provider/parameters', (req: Request, res: Response): void => {
  const provider = req.params['provider'] as AIProvider;
  
  if (!PROVIDER_INFO[provider]) {
    throw createError('不支持的模型提供商', 400);
  }

  const parameters = getProviderParameters(provider);
  
  res.json({
    success: true,
    parameters,
  });
});

router.put('/:provider/parameters', (req: Request, res: Response): void => {
  const provider = req.params['provider'] as AIProvider;
  const parameters = req.body as ModelParameters;
  
  if (!PROVIDER_INFO[provider]) {
    throw createError('不支持的模型提供商', 400);
  }

  if (!hasProviderConfig(provider)) {
    throw createError('该模型未配置，请先配置 API 密钥', 400);
  }

  const success = setProviderParameters(provider, parameters);
  
  if (!success) {
    throw createError('保存参数失败', 500);
  }

  res.json({
    success: true,
    message: `${PROVIDER_INFO[provider].name} 参数已保存`,
    parameters,
  });
});

router.get('/parameters/global', (_req: Request, res: Response): void => {
  const parameters = getGlobalParameters();
  
  res.json({
    success: true,
    parameters,
  });
});

router.put('/parameters/global', (req: Request, res: Response): void => {
  const parameters = req.body as ModelParameters;
  
  setGlobalParameters(parameters);
  
  res.json({
    success: true,
    message: '全局参数已保存',
    parameters,
  });
});

router.get('/:provider/parameters/effective', (req: Request, res: Response): void => {
  const provider = req.params['provider'] as AIProvider;
  
  if (!PROVIDER_INFO[provider]) {
    throw createError('不支持的模型提供商', 400);
  }

  const parameters = getEffectiveParameters(provider);
  
  res.json({
    success: true,
    parameters,
  });
});

router.get('/summaries', (_req: Request, res: Response): void => {
  const summaries = getAllProviderSummaries();
  res.json({ summaries });
});

export default router;
