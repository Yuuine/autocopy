import type { AIProvider, AIProviderConfig } from '../../types';
import { BaseAIService } from './base';
import { DeepSeekService } from './deepseek';
import { MoonshotService } from './moonshot';

export interface AIFactoryConfig {
  provider: AIProvider;
  config: AIProviderConfig;
}

export class AIServiceFactory {
  private static readonly serviceMap: Record<AIProvider, new (config: AIProviderConfig) => BaseAIService> = {
    deepseek: DeepSeekService,
    moonshot: MoonshotService,
  };

  static createService(provider: AIProvider, config: AIProviderConfig): BaseAIService;
  static createService(config: AIFactoryConfig): BaseAIService;
  static createService(
    providerOrConfig: AIProvider | AIFactoryConfig,
    config?: AIProviderConfig
  ): BaseAIService {
    let provider: AIProvider;
    let serviceConfig: AIProviderConfig;

    if (typeof providerOrConfig === 'string') {
      provider = providerOrConfig;
      serviceConfig = config!;
    } else {
      provider = providerOrConfig.provider;
      serviceConfig = providerOrConfig.config;
    }

    const ServiceClass = this.serviceMap[provider];
    if (!ServiceClass) {
      throw new Error(`Unsupported AI provider: ${provider}`);
    }

    return new ServiceClass(serviceConfig);
  }

  static getSupportedProviders(): AIProvider[] {
    return Object.keys(this.serviceMap) as AIProvider[];
  }

  static isProviderSupported(provider: string): provider is AIProvider {
    return provider in this.serviceMap;
  }
}
