import fs from 'fs';
import path from 'path';
import type { AIProvider } from '../types';
import { encrypt, decrypt, hashApiKey } from './encryption';

export interface UserProviderConfig {
  provider: AIProvider;
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserConfig {
  defaultProvider: AIProvider;
  providers: Record<AIProvider, UserProviderConfig>;
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
  }
): {
  provider: AIProvider;
  enabled: boolean;
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
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
} | null {
  const config = loadUserConfig();
  const providerConfig = config.providers[provider];
  
  if (!providerConfig || !providerConfig.enabled) {
    return null;
  }
  
  const result: { apiKey: string; secretKey?: string; baseUrl?: string; model?: string } = {
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
  
  return result;
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
} | null {
  const config = loadUserConfig();
  const providerConfig = config.providers[provider];
  
  if (!providerConfig) {
    return null;
  }
  
  const result: { provider: AIProvider; enabled: boolean; apiKeyMasked: string; model?: string; baseUrl?: string } = {
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
  
  return result;
}

export function getAllProviderSummaries(): Array<{
  provider: AIProvider;
  enabled: boolean;
  apiKeyMasked: string;
  model?: string;
  baseUrl?: string;
}> {
  const config = loadUserConfig();
  
  return Object.keys(config.providers).map(provider => {
    const pc = config.providers[provider as AIProvider];
    const result: { provider: AIProvider; enabled: boolean; apiKeyMasked: string; model?: string; baseUrl?: string } = {
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
    
    return result;
  });
}
