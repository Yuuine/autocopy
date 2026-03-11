import fs from 'fs';
import path from 'path';
import type { AIProvider, ModelParameters, ProviderInstance, ProviderInstanceId } from '../types';
import type { CustomTone } from '../types/copywriting';
import { encrypt, decrypt, hashApiKey } from './encryption';

export interface UserConfig {
  defaultInstanceId: ProviderInstanceId;
  instances: Record<ProviderInstanceId, ProviderInstance>;
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
    defaultInstanceId: '',
    instances: {},
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

export function generateInstanceId(provider: AIProvider): ProviderInstanceId {
  return `${provider}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function createInstance(
  provider: AIProvider,
  name: string,
  apiKey: string,
  options?: {
    secretKey?: string;
    baseUrl?: string;
    model?: string;
    parameters?: ModelParameters;
  }
): ProviderInstance {
  const id = generateInstanceId(provider);
  const encryptedApiKey = encrypt(apiKey);
  
  const instance: ProviderInstance = {
    id,
    name,
    provider,
    apiKey: encryptedApiKey,
    enabled: true,
    model: options?.model || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  if (options?.secretKey) {
    instance.secretKey = encrypt(options.secretKey);
  }
  if (options?.baseUrl) {
    instance.baseUrl = options.baseUrl;
  }
  if (options?.parameters) {
    instance.parameters = options.parameters;
  }
  
  return instance;
}

export function addInstance(
  provider: AIProvider,
  name: string,
  apiKey: string,
  options?: {
    secretKey?: string;
    baseUrl?: string;
    model?: string;
    parameters?: ModelParameters;
  }
): ProviderInstance {
  const config = loadUserConfig();
  
  const instance = createInstance(provider, name, apiKey, options);
  config.instances[instance.id] = instance;
  
  if (!config.defaultInstanceId || !config.instances[config.defaultInstanceId]?.enabled) {
    config.defaultInstanceId = instance.id;
  }
  
  saveUserConfig(config);
  
  return {
    ...instance,
    apiKey: hashApiKey(apiKey),
  };
}

export function updateInstance(
  instanceId: ProviderInstanceId,
  updates: {
    name?: string;
    apiKey?: string;
    secretKey?: string;
    baseUrl?: string;
    model?: string;
    parameters?: ModelParameters;
    enabled?: boolean;
  }
): ProviderInstance | null {
  const config = loadUserConfig();
  const instance = config.instances[instanceId];
  
  if (!instance) {
    return null;
  }
  
  if (updates.name !== undefined) {
    instance.name = updates.name;
  }
  if (updates.apiKey !== undefined) {
    instance.apiKey = encrypt(updates.apiKey);
  }
  if (updates.secretKey !== undefined) {
    instance.secretKey = encrypt(updates.secretKey);
  }
  if (updates.baseUrl !== undefined) {
    instance.baseUrl = updates.baseUrl;
  }
  if (updates.model !== undefined) {
    instance.model = updates.model;
  }
  if (updates.parameters !== undefined) {
    instance.parameters = updates.parameters;
  }
  if (updates.enabled !== undefined) {
    instance.enabled = updates.enabled;
  }
  
  instance.updatedAt = new Date();
  saveUserConfig(config);
  
  const result = { ...instance };
  if (updates.apiKey !== undefined) {
    result.apiKey = hashApiKey(updates.apiKey);
  } else {
    result.apiKey = maskApiKey(instance.apiKey);
  }
  
  return result;
}

export function getInstance(instanceId: ProviderInstanceId): ProviderInstance | null {
  const config = loadUserConfig();
  const instance = config.instances[instanceId];
  
  if (!instance || !instance.enabled) {
    return null;
  }
  
  return {
    ...instance,
    apiKey: decrypt(instance.apiKey),
    secretKey: instance.secretKey ? decrypt(instance.secretKey) : undefined,
  };
}

export function getInstanceDecrypted(instanceId: ProviderInstanceId): {
  apiKey: string;
  secretKey?: string;
  baseUrl?: string;
  model?: string;
  parameters?: ModelParameters;
} | null {
  const config = loadUserConfig();
  const instance = config.instances[instanceId];
  
  if (!instance || !instance.enabled) {
    return null;
  }
  
  const result: { 
    apiKey: string; 
    secretKey?: string; 
    baseUrl?: string; 
    model?: string;
    parameters?: ModelParameters;
  } = {
    apiKey: decrypt(instance.apiKey),
    model: instance.model,
  };
  
  if (instance.secretKey) {
    result.secretKey = decrypt(instance.secretKey);
  }
  if (instance.baseUrl) {
    result.baseUrl = instance.baseUrl;
  }
  if (instance.parameters) {
    result.parameters = instance.parameters;
  }
  
  return result;
}

export function removeInstance(instanceId: ProviderInstanceId): boolean {
  const config = loadUserConfig();
  
  if (!config.instances[instanceId]) {
    return false;
  }
  
  delete config.instances[instanceId];
  
  if (config.defaultInstanceId === instanceId) {
    const enabledInstances = Object.keys(config.instances).filter(
      id => config.instances[id]?.enabled
    );
    config.defaultInstanceId = enabledInstances[0] ?? '';
  }
  
  saveUserConfig(config);
  return true;
}

export function setDefaultInstance(instanceId: ProviderInstanceId): boolean {
  const config = loadUserConfig();
  
  if (!config.instances[instanceId]?.enabled) {
    return false;
  }
  
  config.defaultInstanceId = instanceId;
  saveUserConfig(config);
  return true;
}

export function getDefaultInstance(): ProviderInstance | null {
  const config = loadUserConfig();
  return getInstance(config.defaultInstanceId);
}

export function getDefaultInstanceId(): ProviderInstanceId {
  const config = loadUserConfig();
  return config.defaultInstanceId;
}

export function getAllInstances(): ProviderInstance[] {
  const config = loadUserConfig();
  return Object.values(config.instances);
}

export function getEnabledInstances(): ProviderInstance[] {
  const config = loadUserConfig();
  return Object.values(config.instances).filter(instance => instance.enabled);
}

export function getInstancesByProvider(provider: AIProvider): ProviderInstance[] {
  const config = loadUserConfig();
  return Object.values(config.instances).filter(instance => instance.provider === provider);
}

export function hasModelInstance(provider: AIProvider, model: string): boolean {
  const config = loadUserConfig();
  return Object.values(config.instances).some(
    instance => instance.provider === provider && instance.model === model
  );
}

export function hasInstance(instanceId: ProviderInstanceId): boolean {
  const config = loadUserConfig();
  return !!config.instances[instanceId]?.enabled;
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

export function getInstanceSummary(instanceId: ProviderInstanceId): {
  id: ProviderInstanceId;
  name: string;
  provider: AIProvider;
  enabled: boolean;
  apiKeyMasked: string;
  model?: string;
  baseUrl?: string;
  parameters?: ModelParameters;
} | null {
  const config = loadUserConfig();
  const instance = config.instances[instanceId];
  
  if (!instance) {
    return null;
  }
  
  const result: { 
    id: ProviderInstanceId;
    name: string;
    provider: AIProvider;
    enabled: boolean; 
    apiKeyMasked: string; 
    model?: string; 
    baseUrl?: string;
    parameters?: ModelParameters;
  } = {
    id: instance.id,
    name: instance.name,
    provider: instance.provider,
    enabled: instance.enabled,
    apiKeyMasked: maskApiKey(instance.apiKey),
    model: instance.model,
  };
  
  if (instance.baseUrl) {
    result.baseUrl = instance.baseUrl;
  }
  if (instance.parameters) {
    result.parameters = instance.parameters;
  }
  
  return result;
}

export function getAllInstanceSummaries(): Array<{
  id: ProviderInstanceId;
  name: string;
  provider: AIProvider;
  enabled: boolean;
  apiKeyMasked: string;
  model?: string | undefined;
  baseUrl?: string | undefined;
  parameters?: ModelParameters | undefined;
}> {
  const config = loadUserConfig();
  
  return Object.values(config.instances).map(instance => ({
    id: instance.id,
    name: instance.name,
    provider: instance.provider,
    enabled: instance.enabled,
    apiKeyMasked: maskApiKey(instance.apiKey),
    model: instance.model ?? undefined,
    baseUrl: instance.baseUrl ?? undefined,
    parameters: instance.parameters ?? undefined,
  }));
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

export function getEffectiveParameters(instanceId: ProviderInstanceId): ModelParameters {
  const config = loadUserConfig();
  const instance = config.instances[instanceId];
  
  return {
    ...config.globalParameters,
    ...instance?.parameters,
  };
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
