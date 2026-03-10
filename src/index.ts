import type { 
  CopywritingRequest, 
  GenerationOptions,
  GenerationResult,
  AIProviderConfig,
  CopywritingResult,
  ArticleType,
  Tone,
  Platform,
  AIProvider
} from './types';
import { AIServiceFactory } from './services/ai';
import { CopyGenerator } from './services/generator';
import { getDecryptedProviderConfig } from './utils/userConfig';

export class AutoCopy {
  private provider: AIProvider;

  constructor(provider?: AIProvider) {
    this.provider = provider ?? 'deepseek';
  }

  async generate(
    request: CopywritingRequest,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    const config = getDecryptedProviderConfig(this.provider);
    
    if (!config) {
      throw new Error(`模型 ${this.provider} 未配置，请先在前端配置 API 密钥`);
    }
    
    const serviceConfig: AIProviderConfig = {
      apiKey: config.apiKey,
    };
    
    if (config.baseUrl) {
      serviceConfig.baseUrl = config.baseUrl;
    }
    if (config.model) {
      serviceConfig.model = config.model;
    }
    
    const aiService = AIServiceFactory.createService(this.provider, serviceConfig);
    const generator = new CopyGenerator(aiService);
    
    return generator.generate(request, options);
  }

  async generateMultiple(
    request: CopywritingRequest,
    count: number = 3
  ): Promise<GenerationResult> {
    return this.generate(request, { count });
  }

  setProvider(provider: AIProvider): void {
    this.provider = provider;
  }

  getProvider(): AIProvider {
    return this.provider;
  }
}

export { 
  type CopywritingRequest,
  type GenerationOptions,
  type GenerationResult,
  type CopywritingResult,
  type ArticleType,
  type Tone,
  type Platform,
  type AIProvider,
  type AIProviderConfig,
};

export { AIServiceFactory } from './services/ai';
export { CopyGenerator } from './services/generator';
export { 
  getDecryptedProviderConfig, 
  setProviderConfig, 
  getDefaultProvider,
  hasProviderConfig 
} from './utils/userConfig';
export { PROVIDER_DEFAULTS } from './config/ai-providers';

export function createAutoCopy(provider?: AIProvider): AutoCopy {
  return new AutoCopy(provider);
}

export default AutoCopy;
