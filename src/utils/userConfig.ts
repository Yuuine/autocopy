import fs from 'fs';
import path from 'path';
import type { AIProvider, ModelParameters } from '../types';
import type { CustomTone } from '../types/copywriting';
import { encrypt, decrypt, hashApiKey } from './encryption';

export interface UserProviderConfig {
  provider: AIProvider;
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
  parameters?: ModelParameters;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserConfig {
  defaultProvider: AIProvider;
  providers: Record<AIProvider, UserProviderConfig>;
  customTones: CustomTone[];
  globalParameters?: ModelParameters;
}

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_FILE = path.join(CONFIG_DIR, 'user-config.json');

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function getEmptyConfig(): UserConfig {
  return {
    defaultProvider: '' as AIProvider,
    providers: {} as Record<AIProvider, UserProviderConfig>,
    customTones: [],
  };
}

export function loadUserConfig(): UserConfig {
  try {
    ensureConfigDir();
    
    if (!fs.existsSync(CONFIG_FILE)) {
      return getEmptyConfig();
    }
    
    const data = fs.readFileSync(CONFIG_FILE, 'utf8');
    const config = JSON.parse(data) as UserConfig;
    
    return config;
  } catch (error) {
    console.error('Error loading user config:', error);
    return getEmptyConfig();
  }
}

export function saveUserConfig(config: UserConfig): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), 'utf8');
  } catch (error) {
    console.error('Error saving user config:', error);
    throw new Error('Failed to save configuration');
  }
}

export function setProviderConfig(
  provider: AIProvider,
  apiKey: string,
  options?: {
    secretKey?: string;
    baseUrl?: string;
    model?: string;
    parameters?: ModelParameters;
  }
): {
  provider: AIProvider;
  enabled: boolean;
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
  parameters?: ModelParameters;
  createdAt: Date;
  updatedAt: Date;
} {
  const config = loadUserConfig();
  
  const encryptedApiKey = encrypt(apiKey);
  
  const providerConfigBase: UserProviderConfig = {
    provider,
    apiKey: encryptedApiKey,
    enabled: true,
    createdAt: config.providers[provider]?.createdAt ?? new Date(),
    updatedAt: new Date(),
  };
  
  if (options?.secretKey) {
    providerConfigBase.secretKey = encrypt(options.secretKey);
  }
  if (options?.baseUrl) {
    providerConfigBase.baseUrl = options.baseUrl;
  }
  if (options?.model) {
    providerConfigBase.model = options.model;
  }
  if (options?.parameters) {
    providerConfigBase.parameters = options.parameters;
  }
  
  config.providers[provider] = providerConfigBase;
  
  if (!config.defaultProvider || !config.providers[config.defaultProvider]?.enabled) {
    config.defaultProvider = provider;
  }
  
  saveUserConfig(config);
  
  const result: {
    provider: AIProvider;
    enabled: boolean;
    apiKey: string;
    secretKey?: string;
    baseUrl?: string;
    model?: string;
    parameters?: ModelParameters;
    createdAt: Date;
    updatedAt: Date;
  } = {
    provider,
    enabled: true,
    apiKey: hashApiKey(apiKey),
    createdAt: providerConfigBase.createdAt,
    updatedAt: providerConfigBase.updatedAt,
  };
  
  if (options?.secretKey) {
    result.secretKey = hashApiKey(options.secretKey);
  }
  if (options?.baseUrl) {
    result.baseUrl = options.baseUrl;
  }
  if (options?.model) {
    result.model = options.model;
  }
  if (options?.parameters) {
    result.parameters = options.parameters;
  }
  
  return result;
}

export function getProviderConfig(provider: AIProvider): UserProviderConfig | null {
  const config = loadUserConfig();
  const providerConfig = config.providers[provider];
  
  if (!providerConfig || !providerConfig.enabled) {
    return null;
  }
  
  const result: UserProviderConfig = {
    ...providerConfig,
    apiKey: decrypt(providerConfig.apiKey),
  };
  
  if (providerConfig.secretKey) {
    result.secretKey = decrypt(providerConfig.secretKey);
  }
  
  return result;
}

export function getDecryptedProviderConfig(provider: AIProvider): {
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
  parameters?: ModelParameters;
} | null {
  const config = loadUserConfig();
  const providerConfig = config.providers[provider];
  
  if (!providerConfig || !providerConfig.enabled) {
    return null;
  }
  
  const result: { 
    apiKey: string; 
    secretKey?: string; 
    baseUrl?: string; 
    model?: string;
    parameters?: ModelParameters;
  } = {
    apiKey: decrypt(providerConfig.apiKey),
  };
  
  if (providerConfig.secretKey) {
    result.secretKey = decrypt(providerConfig.secretKey);
  }
  if (providerConfig.baseUrl) {
    result.baseUrl = providerConfig.baseUrl;
  }
  if (providerConfig.model) {
    result.model = providerConfig.model;
  }
  if (providerConfig.parameters) {
    result.parameters = providerConfig.parameters;
  }
  
  return result;
}

export function setProviderParameters(
  provider: AIProvider, 
  parameters: ModelParameters
): boolean {
  const config = loadUserConfig();
  const providerConfig = config.providers[provider];
  
  if (!providerConfig) {
    return false;
  }
  
  providerConfig.parameters = parameters;
  providerConfig.updatedAt = new Date();
  
  saveUserConfig(config);
  return true;
}

export function getProviderParameters(provider: AIProvider): ModelParameters | null {
  const config = loadUserConfig();
  const providerConfig = config.providers[provider];
  
  if (!providerConfig) {
    return null;
  }
  
  return providerConfig.parameters || null;
}

export function setGlobalParameters(parameters: ModelParameters): void {
  const config = loadUserConfig();
  config.globalParameters = parameters;
  saveUserConfig(config);
}

export function getGlobalParameters(): ModelParameters | null {
  const config = loadUserConfig();
  return config.globalParameters || null;
}

export function getEffectiveParameters(provider: AIProvider): ModelParameters {
  const config = loadUserConfig();
  const providerConfig = config.providers[provider];
  
  return {
    ...config.globalParameters,
    ...providerConfig?.parameters,
  };
}

export function removeProviderConfig(provider: AIProvider): boolean {
  const config = loadUserConfig();
  
  if (!config.providers[provider]) {
    return false;
  }
  
  delete config.providers[provider];
  
  if (config.defaultProvider === provider) {
    const enabledProviders = Object.keys(config.providers).filter(
      p => config.providers[p as AIProvider]?.enabled
    ) as AIProvider[];
    config.defaultProvider = enabledProviders[0] ?? '' as AIProvider;
  }
  
  saveUserConfig(config);
  return true;
}

export function setDefaultProvider(provider: AIProvider): boolean {
  const config = loadUserConfig();
  
  if (!config.providers[provider]?.enabled) {
    return false;
  }
  
  config.defaultProvider = provider;
  saveUserConfig(config);
  return true;
}

export function getDefaultProvider(): AIProvider {
  const config = loadUserConfig();
  return config.defaultProvider;
}

export function getEnabledProviders(): AIProvider[] {
  const config = loadUserConfig();
  return Object.keys(config.providers).filter(
    p => config.providers[p as AIProvider]?.enabled
  ) as AIProvider[];
}

export function hasProviderConfig(provider: AIProvider): boolean {
  const config = loadUserConfig();
  return !!config.providers[provider]?.enabled;
}

export function maskApiKey(encryptedApiKey: string): string {
  try {
    const decrypted = decrypt(encryptedApiKey);
    if (decrypted.length <= 8) {
      return '****';
    }
    return `${decrypted.substring(0, 4)}...${decrypted.substring(decrypted.length - 4)}`;
  } catch {
    return '****';
  }
}

export function getProviderConfigSummary(provider: AIProvider): {
  provider: AIProvider;
  enabled: boolean;
  apiKeyMasked: string;
  model?: string;
  baseUrl?: string;
  parameters?: ModelParameters;
} | null {
  const config = loadUserConfig();
  const providerConfig = config.providers[provider];
  
  if (!providerConfig) {
    return null;
  }
  
  const result: { 
    provider: AIProvider; 
    enabled: boolean; 
    apiKeyMasked: string; 
    model?: string; 
    baseUrl?: string;
    parameters?: ModelParameters;
  } = {
    provider,
    enabled: providerConfig.enabled,
    apiKeyMasked: maskApiKey(providerConfig.apiKey),
  };
  
  if (providerConfig.model) {
    result.model = providerConfig.model;
  }
  if (providerConfig.baseUrl) {
    result.baseUrl = providerConfig.baseUrl;
  }
  if (providerConfig.parameters) {
    result.parameters = providerConfig.parameters;
  }
  
  return result;
}

export function getAllProviderSummaries(): Array<{
  provider: AIProvider;
  enabled: boolean;
  apiKeyMasked: string;
  model?: string;
  baseUrl?: string;
  parameters?: ModelParameters;
}> {
  const config = loadUserConfig();
  
  return Object.keys(config.providers).map(provider => {
    const pc = config.providers[provider as AIProvider];
    const result: { 
      provider: AIProvider; 
      enabled: boolean; 
      apiKeyMasked: string; 
      model?: string; 
      baseUrl?: string;
      parameters?: ModelParameters;
    } = {
      provider: provider as AIProvider,
      enabled: pc?.enabled ?? false,
      apiKeyMasked: maskApiKey(pc?.apiKey ?? ''),
    };
    
    if (pc?.model) {
      result.model = pc.model;
    }
    if (pc?.baseUrl) {
      result.baseUrl = pc.baseUrl;
    }
    if (pc?.parameters) {
      result.parameters = pc.parameters;
    }
    
    return result;
  });
}

export function getCustomTones(): CustomTone[] {
  const config = loadUserConfig();
  return config.customTones || [];
}

export function addCustomTone(name: string, description: string): CustomTone {
  const config = loadUserConfig();
  
  const newTone: CustomTone = {
    id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name,
    description,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  if (!config.customTones) {
    config.customTones = [];
  }
  
  config.customTones.push(newTone);
  saveUserConfig(config);
  
  return newTone;
}

export function updateCustomTone(id: string, name: string, description: string): CustomTone | null {
  const config = loadUserConfig();
  
  if (!config.customTones) {
    return null;
  }
  
  const toneIndex = config.customTones.findIndex(t => t.id === id);
  if (toneIndex === -1) {
    return null;
  }
  
  const existingTone = config.customTones[toneIndex];
  if (!existingTone) {
    return null;
  }
  
  const updatedTone: CustomTone = {
    id: existingTone.id,
    name,
    description,
    createdAt: existingTone.createdAt,
    updatedAt: new Date(),
  };
  
  config.customTones[toneIndex] = updatedTone;
  
  saveUserConfig(config);
  return updatedTone;
}

export function deleteCustomTone(id: string): boolean {
  const config = loadUserConfig();
  
  if (!config.customTones) {
    return false;
  }
  
  const initialLength = config.customTones.length;
  config.customTones = config.customTones.filter(t => t.id !== id);
  
  if (config.customTones.length === initialLength) {
    return false;
  }
  
  saveUserConfig(config);
  return true;
}

export function getCustomToneById(id: string): CustomTone | null {
  const config = loadUserConfig();
  
  if (!config.customTones) {
    return null;
  }
  
  return config.customTones.find(t => t.id === id) || null;
}
