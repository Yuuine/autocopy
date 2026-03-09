import 'dotenv/config';
import type { 
  CopywritingRequest, 
  GenerationOptions,
  GenerationResult,
  AIProviderConfig,
  CopywritingResult,
  ArticleType,
  Tone,
  Platform
} from './types';
import { createConfig, type AppConfig } from './config';
import { DeepSeekService } from './services/ai';
import { CopyGenerator } from './services/generator';

export class AutoCopy {
  private generator: CopyGenerator;
  private config: AppConfig;

  constructor(config?: Partial<AppConfig>) {
    this.config = createConfig(config);
    this.validateConfiguration();
    
    const aiService = this.createAIService(this.config.ai);
    this.generator = new CopyGenerator(aiService);
  }

  async generate(
    request: CopywritingRequest,
    options?: GenerationOptions
  ): Promise<GenerationResult> {
    return this.generator.generate(request, options);
  }

  async generateMultiple(
    request: CopywritingRequest,
    count: number = 3
  ): Promise<GenerationResult> {
    return this.generator.generate(request, { count });
  }

  private createAIService(config: AIProviderConfig): DeepSeekService {
    return new DeepSeekService(config);
  }

  private validateConfiguration(): void {
    if (!this.config.ai.apiKey) {
      throw new Error(
        'API key is required. Please set DEEPSEEK_API_KEY environment variable ' +
        'or provide it in the config.'
      );
    }
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
  type AppConfig,
};

export function createAutoCopy(config?: Partial<AppConfig>): AutoCopy {
  return new AutoCopy(config);
}

export default AutoCopy;
