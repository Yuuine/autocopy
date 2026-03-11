import { Router, Request, Response } from 'express';
import type { AIProvider, ModelParameters } from '../../types';
import { AIServiceFactory } from '../../services/ai';
import {
  addInstance,
  updateInstance,
  removeInstance,
  setDefaultInstance,
  getDefaultInstanceId,
  hasInstance,
  getAllInstanceSummaries,
  getInstanceSummary,
  getInstance,
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
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
  },
  moonshot: {
    name: 'Kimi (Moonshot)',
    description: 'Moonshot AI Kimi 系列模型',
    defaultModel: 'kimi-k2-turbo-preview',
    requiresSecretKey: false,
    models: [
      'kimi-k2.5',
      'kimi-k2-turbo-preview',
      'kimi-k2-0711-preview',
    ],
  },
};

router.get('/', (_req: Request, res: Response): void => {
  const instances = getAllInstanceSummaries();
  const defaultInstanceId = getDefaultInstanceId();
  
  const providers = Object.entries(PROVIDER_INFO).map(([key, info]) => {
    const providerInstances = instances.filter(i => i.provider === key);
    return {
      id: key as AIProvider,
      ...info,
      configured: providerInstances.length > 0,
      instances: providerInstances,
    };
  });

  res.json({
    providers,
    instances,
    defaultInstanceId,
    globalParameters: getGlobalParameters(),
  });
});

router.get('/providers', (_req: Request, res: Response): void => {
  const providers = Object.entries(PROVIDER_INFO).map(([key, info]) => ({
    id: key as AIProvider,
    ...info,
  }));
  
  res.json({ providers });
});

router.get('/instances', (_req: Request, res: Response): void => {
  const instances = getAllInstanceSummaries();
  const defaultInstanceId = getDefaultInstanceId();
  
  res.json({
    instances,
    defaultInstanceId,
  });
});

router.get('/instances/:instanceId', (req: Request, res: Response): void => {
  const { instanceId } = req.params;
  
  if (!instanceId) {
    throw createError('缺少实例ID', 400);
  }
  
  const summary = getInstanceSummary(instanceId);
  
  if (!summary) {
    throw createError('实例不存在', 404);
  }
  
  res.json({
    success: true,
    instance: summary,
  });
});

router.post('/instances', (req: Request, res: Response): void => {
  const { provider, name, apiKey, secretKey, baseUrl, model, parameters } = req.body;

  if (!provider || !PROVIDER_INFO[provider as AIProvider]) {
    throw createError('不支持的模型提供商', 400);
  }

  if (!apiKey || typeof apiKey !== 'string') {
    throw createError('API 密钥不能为空', 400);
  }

  if (!validateApiKeyFormat(provider as AIProvider, apiKey)) {
    throw createError('API 密钥格式不正确', 400);
  }

  const providerInfo = PROVIDER_INFO[provider as AIProvider];
  
  if (providerInfo.requiresSecretKey && !secretKey) {
    throw createError(`${providerInfo.name} 需要提供 Secret Key`, 400);
  }

  const instanceName = name?.trim() || `${providerInfo.name} - ${model || providerInfo.defaultModel}`;
  
  const instance = addInstance(provider as AIProvider, instanceName, apiKey, {
    secretKey,
    baseUrl,
    model: model ?? providerInfo.defaultModel,
    parameters,
  });

  res.json({
    success: true,
    message: `${instanceName} 配置已保存`,
    instance,
  });
});

router.put('/instances/:instanceId', (req: Request, res: Response): void => {
  const { instanceId } = req.params;
  const { name, apiKey, secretKey, baseUrl, model, parameters, enabled } = req.body;

  if (!instanceId) {
    throw createError('缺少实例ID', 400);
  }

  if (!hasInstance(instanceId)) {
    throw createError('实例不存在', 404);
  }

  const instance = updateInstance(instanceId, {
    name,
    apiKey,
    secretKey,
    baseUrl,
    model,
    parameters,
    enabled,
  });

  if (!instance) {
    throw createError('更新实例失败', 500);
  }

  res.json({
    success: true,
    message: `${instance.name} 配置已更新`,
    instance,
  });
});

router.delete('/instances/:instanceId', (req: Request, res: Response): void => {
  const { instanceId } = req.params;

  if (!instanceId) {
    throw createError('缺少实例ID', 400);
  }

  const instance = getInstance(instanceId);
  
  if (!instance) {
    throw createError('实例不存在', 404);
  }

  const removed = removeInstance(instanceId);

  if (!removed) {
    throw createError('删除实例失败', 500);
  }

  res.json({
    success: true,
    message: `${instance.name} 配置已删除`,
  });
});

router.post('/instances/:instanceId/default', (req: Request, res: Response): void => {
  const { instanceId } = req.params;

  if (!instanceId) {
    throw createError('缺少实例ID', 400);
  }

  const instance = getInstance(instanceId);
  
  if (!instance) {
    throw createError('实例不存在或未启用', 404);
  }

  const success = setDefaultInstance(instanceId);

  if (!success) {
    throw createError('设置默认实例失败', 400);
  }

  res.json({
    success: true,
    message: `${instance.name} 已设为默认模型`,
    defaultInstanceId: instanceId,
  });
});

router.post('/instances/:instanceId/validate', async (req: Request, res: Response): Promise<void> => {
  const { instanceId } = req.params;
  const { apiKey, secretKey, baseUrl } = req.body;

  if (!instanceId) {
    throw createError('缺少实例ID', 400);
  }

  const instance = getInstance(instanceId);
  
  if (!instance) {
    throw createError('实例不存在', 404);
  }

  const testApiKey = apiKey || instance.apiKey;
  
  if (!testApiKey) {
    throw createError('API 密钥不能为空', 400);
  }

  try {
    const testConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model: string } = {
      apiKey: testApiKey,
      model: instance.model || PROVIDER_INFO[instance.provider].defaultModel,
    };
    
    if (secretKey || instance.secretKey) {
      testConfig.secretKey = secretKey || instance.secretKey;
    }
    if (baseUrl || instance.baseUrl) {
      testConfig.baseUrl = baseUrl || instance.baseUrl;
    }

    const service = AIServiceFactory.createService(instance.provider, testConfig);
    
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

router.post('/validate', async (req: Request, res: Response): Promise<void> => {
  const { provider, apiKey, secretKey, baseUrl, model } = req.body;

  if (!provider || !PROVIDER_INFO[provider as AIProvider]) {
    throw createError('不支持的模型提供商', 400);
  }

  if (!apiKey) {
    throw createError('API 密钥不能为空', 400);
  }

  try {
    const providerInfo = PROVIDER_INFO[provider as AIProvider];
    const testConfig: { apiKey: string; secretKey?: string; baseUrl?: string; model: string } = {
      apiKey,
      model: model || providerInfo.defaultModel,
    };
    
    if (secretKey) {
      testConfig.secretKey = secretKey;
    }
    if (baseUrl) {
      testConfig.baseUrl = baseUrl;
    }

    const service = AIServiceFactory.createService(provider as AIProvider, testConfig);
    
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

router.get('/instances/:instanceId/parameters', (req: Request, res: Response): void => {
  const { instanceId } = req.params;
  
  if (!instanceId) {
    throw createError('缺少实例ID', 400);
  }

  const instance = getInstance(instanceId);
  
  if (!instance) {
    throw createError('实例不存在', 404);
  }
  
  res.json({
    success: true,
    parameters: instance.parameters || null,
  });
});

router.put('/instances/:instanceId/parameters', (req: Request, res: Response): void => {
  const { instanceId } = req.params;
  const parameters = req.body as ModelParameters;
  
  if (!instanceId) {
    throw createError('缺少实例ID', 400);
  }

  if (!hasInstance(instanceId)) {
    throw createError('实例不存在', 404);
  }

  const instance = updateInstance(instanceId, { parameters });
  
  if (!instance) {
    throw createError('保存参数失败', 500);
  }

  res.json({
    success: true,
    message: `${instance.name} 参数已保存`,
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

router.get('/instances/:instanceId/parameters/effective', (req: Request, res: Response): void => {
  const { instanceId } = req.params;
  
  if (!instanceId) {
    throw createError('缺少实例ID', 400);
  }

  if (!hasInstance(instanceId)) {
    throw createError('实例不存在', 404);
  }

  const parameters = getEffectiveParameters(instanceId);
  
  res.json({
    success: true,
    parameters,
  });
});

export default router;
