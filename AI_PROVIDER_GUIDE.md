# 多模型 AI 服务使用指南

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Service Architecture                   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   DeepSeek   │    │    OpenAI    │    │   Claude     │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │          │
│  ┌──────┴───────┐    ┌──────┴───────┐    ┌──────┴───────┐  │
│  │   Wenxin     │    │    Qwen      │    │   Gemini     │  │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘  │
│         │                   │                   │          │
│         └───────────────────┼───────────────────┘          │
│                             │                              │
│                    ┌────────┴────────┐                     │
│                    │  AIServiceFactory │                    │
│                    └────────┬────────┘                     │
│                             │                              │
│                    ┌────────┴────────┐                     │
│                    │   BaseAIService  │                     │
│                    │   (统一接口)      │                     │
│                    └─────────────────┘                     │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 快速开始

### 1. 环境变量配置

在项目根目录创建 `.env` 文件：

```bash
# DeepSeek (默认)
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_MODEL=deepseek-chat

# OpenAI
OPENAI_API_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4

# Claude (Anthropic)
ANTHROPIC_API_KEY=your_anthropic_api_key
ANTHROPIC_MODEL=claude-3-opus-20240229

# 文心一言 (百度)
WENXIN_API_KEY=your_wenxin_api_key
WENXIN_SECRET_KEY=your_wenxin_secret_key
WENXIN_MODEL=ernie-bot-4

# 通义千问 (阿里云)
QWEN_API_KEY=your_qwen_api_key
QWEN_MODEL=qwen-turbo

# Gemini (Google)
GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-pro
```

### 2. 基础使用

```typescript
import { AIServiceFactory } from './src/services/ai';
import type { AIRequest } from './src/types';

// 创建 DeepSeek 服务（默认）
const deepseekService = AIServiceFactory.createService('deepseek', {
  apiKey: process.env.DEEPSEEK_API_KEY!,
  model: 'deepseek-chat',
});

// 创建 OpenAI 服务
const openaiService = AIServiceFactory.createService('openai', {
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4',
});

// 统一调用接口
const request: AIRequest = {
  messages: [
    { role: 'system', content: '你是一个专业的文案写手。' },
    { role: 'user', content: '帮我写一段关于咖啡的文案。' }
  ],
  temperature: 0.7,
  maxTokens: 1000,
};

const deepseekResponse = await deepseekService.chat(request);
const openaiResponse = await openaiService.chat(request);
```

### 3. 动态切换模型

```typescript
import { AIServiceFactory } from './src/services/ai';
import { createMultiProviderConfig, getProviderConfig } from './src/config/ai-providers';
import type { AIProvider } from './src/types';

// 加载多模型配置
const config = createMultiProviderConfig();

// 动态切换模型
async function chatWithProvider(provider: AIProvider, request: AIRequest) {
  const providerConfig = getProviderConfig(config, provider);
  
  if (!providerConfig?.enabled) {
    throw new Error(`Provider ${provider} is not enabled`);
  }
  
  const service = AIServiceFactory.createService(provider, providerConfig);
  return await service.chat(request);
}

// 使用不同模型
const response = await chatWithProvider('openai', request);
// 或
const response = await chatWithProvider('wenxin', request);
```

### 4. 错误处理

```typescript
import { 
  AIServiceError, 
  AIAuthenticationError, 
  AIRateLimitError,
  withRetry 
} from './src/services/ai';

async function safeChat(service, request) {
  try {
    // 自动重试机制
    return await withRetry(
      () => service.chat(request),
      { maxRetries: 3, delayMs: 1000 }
    );
  } catch (error) {
    if (error instanceof AIAuthenticationError) {
      console.error('API 密钥无效，请检查配置');
    } else if (error instanceof AIRateLimitError) {
      console.error('请求过于频繁，请稍后重试');
    } else if (error instanceof AIServiceError) {
      console.error(`AI 服务错误 [${error.code}]:`, error.message);
    } else {
      console.error('未知错误:', error);
    }
    throw error;
  }
}
```

## 添加新模型

### 步骤 1: 创建服务类

```typescript
// src/services/ai/newprovider.ts
import type { AIProvider, AIRequest, AIResponse, AIProviderConfig } from '../../types';
import { BaseAIService } from './base';

export class NewProviderService extends BaseAIService {
  protected readonly provider: AIProvider = 'newprovider';

  constructor(config: AIProviderConfig) {
    super(config);
    this.validateConfig();
  }

  async chat(request: AIRequest): Promise<AIResponse> {
    // 实现 API 调用逻辑
    const response = await fetch(`${this.config.baseUrl}/chat`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.getModel(request),
        messages: request.messages,
        temperature: this.getTemperature(request),
        max_tokens: this.getMaxTokens(request),
      }),
    });

    const data = await response.json();
    
    return {
      content: data.content,
      model: data.model,
      provider: this.provider,
      usage: data.usage,
    };
  }
}
```

### 步骤 2: 注册到工厂

```typescript
// src/services/ai/factory.ts
import { NewProviderService } from './newprovider';

export class AIServiceFactory {
  private static readonly serviceMap = {
    deepseek: DeepSeekService,
    openai: OpenAIService,
    anthropic: ClaudeService,
    wenxin: WenxinService,
    newprovider: NewProviderService, // 添加新模型
    // ...
  };
}
```

### 步骤 3: 更新类型定义

```typescript
// src/types/ai.ts
export type AIProvider = 
  | 'deepseek' 
  | 'openai' 
  | 'anthropic'
  | 'wenxin'
  | 'newprovider'; // 添加新模型
```

### 步骤 4: 添加配置

```typescript
// src/config/ai-providers.ts
export const defaultMultiProviderConfig: MultiProviderConfig = {
  providers: {
    newprovider: {
      enabled: false,
      apiKey: process.env['NEWPROVIDER_API_KEY'] ?? '',
      baseUrl: process.env['NEWPROVIDER_BASE_URL'],
      model: process.env['NEWPROVIDER_MODEL'] ?? 'default-model',
      defaultTemperature: 0.7,
      defaultMaxTokens: 2000,
    },
  },
};
```

## 支持的模型

| 提供商 | 类型 | 默认模型 | 认证方式 |
|--------|------|----------|----------|
| DeepSeek | 通用 | deepseek-chat | API Key |
| OpenAI | 通用 | gpt-4 | API Key |
| Claude | 通用 | claude-3-opus | API Key |
| 文心一言 | 国产 | ernie-bot-4 | API Key + Secret |
| 通义千问 | 国产 | qwen-turbo | API Key |
| Gemini | 通用 | gemini-pro | API Key |

## 注意事项

1. **API 密钥安全**：永远不要将 API 密钥提交到代码仓库
2. **错误重试**：建议对网络错误使用 `withRetry` 包装调用
3. **模型差异**：不同模型的参数支持可能略有不同
4. **速率限制**：注意各提供商的速率限制策略
