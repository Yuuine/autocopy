import type { 
  CopywritingRequest, 
  GenerationOptions,
  GenerationResult,
  AIProviderConfig,
  CopywritingResult,
  ArticleType,
  Tone,
  ProviderInstanceId
} from './types';
import { AIServiceFactory } from './services/ai';
import { CopyGenerator } from './services/generator';
import { getInstanceDecrypted, getDefaultInstanceId } from './utils/userConfig';

export class AutoCopy {
  private instanceId: ProviderInstanceId;

  constructor(instanceId?: ProviderInstanceId) {
    this.instanceId = instanceId ?? '';
  }

  async generate(
    request: CopywritingRequest,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const effectiveInstanceId = this.instanceId || getDefaultInstanceId();
    
    if (!effectiveInstanceId) {
      throw new Error('未配置任何模型实例，请先在前端配置 API 密钥');
    }
    
    const config = getInstanceDecrypted(effectiveInstanceId);
    
    if (!config) {
      throw new Error(`模型实例 ${effectiveInstanceId} 未配置或已禁用`);
    }
    
    const instance = getInstanceDecrypted(effectiveInstanceId);
    if (!instance) {
      throw new Error(`无法获取模型实例 ${effectiveInstanceId} 的配置`);
    }
    
    const serviceConfig: AIProviderConfig = {
      apiKey: config.apiKey,
      model: config.model ?? '',
    };
    
    if (config.baseUrl) {
      serviceConfig.baseUrl = config.baseUrl;
    }
    
    const instanceData = await import('./utils/userConfig').then(m => m.getInstance(effectiveInstanceId));
    if (!instanceData) {
      throw new Error(`无法获取模型实例 ${effectiveInstanceId}`);
    }
    
    const aiService = AIServiceFactory.createService(instanceData.provider, serviceConfig);
    const generator = new CopyGenerator(aiService);
    
    return generator.generate(request, options);
  }

  async generateMultiple(
    request: CopywritingRequest,
    count: number = 3
  ): Promise<GenerationResult> {
    return this.generate(request, { count });
  }

  setInstance(instanceId: ProviderInstanceId): void {
    this.instanceId = instanceId;
  }

  getInstance(): ProviderInstanceId {
    return this.instanceId;
  }
}

export { 
  type CopywritingRequest,
  type GenerationOptions,
  type GenerationResult,
  type CopywritingResult,
  type ArticleType,
  type Tone,
  type AIProviderConfig,
  type ProviderInstanceId,
};

export { AIServiceFactory } from './services/ai';
export { CopyGenerator } from './services/generator';
export { 
  getInstanceDecrypted, 
  addInstance,
  updateInstance,
  removeInstance,
  getDefaultInstanceId,
  setDefaultInstance,
  getAllInstanceSummaries,
  hasInstance 
} from './utils/userConfig';
export { PROVIDER_DEFAULTS, getProviderModels } from './config/ai-providers';

export function createAutoCopy(instanceId?: ProviderInstanceId): AutoCopy {
  return new AutoCopy(instanceId);
}

export default AutoCopy;
