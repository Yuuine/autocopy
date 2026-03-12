export interface ProviderInfo {
  id: string;
  name: string;
  description: string;
  defaultModel: string;
  requiresSecretKey: boolean;
  models: string[];
  configured: boolean;
  instances?: InstanceSummary[];
}

export interface InstanceSummary {
  id: string;
  name: string;
  provider: string;
  enabled: boolean;
  apiKeyMasked: string;
  model?: string;
  baseUrl?: string;
  parameters?: ModelParameters;
}

export interface ModelParameters {
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  presencePenalty?: number;
  frequencyPenalty?: number;
}

export const PARAMETER_CONFIGS = {
  temperature: {
    label: '温度 (Temperature)',
    description: '控制输出的随机性。值越高输出越随机，值越低输出越确定。',
    min: 0,
    max: 2,
    step: 0.1,
    default: 0.7,
  },
  maxTokens: {
    label: '最大生成长度 (Max Tokens)',
    description: '控制生成的最大 token 数量。',
    min: 100,
    max: 8000,
    step: 100,
    default: 2000,
  },
  topP: {
    label: 'Top P',
    description: '核采样参数。控制模型从概率最高的 token 中选择的比例。',
    min: 0,
    max: 1,
    step: 0.05,
    default: 1,
  },
  presencePenalty: {
    label: '存在惩罚 (Presence Penalty)',
    description: '正值会惩罚新 token 是否出现在现有文本中，增加模型谈论新话题的可能性。',
    min: -2,
    max: 2,
    step: 0.1,
    default: 0,
  },
  frequencyPenalty: {
    label: '频率惩罚 (Frequency Penalty)',
    description: '正值会根据 token 在现有文本中的频率进行惩罚，降低重复相同内容的可能性。',
    min: -2,
    max: 2,
    step: 0.1,
    default: 0,
  },
};
