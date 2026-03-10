import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT_LENGTH = 32;

const SECRET_FILE = path.join(process.cwd(), 'data', '.secret');

function getEncryptionKey(): Buffer {
  const secret = getOrCreateSecret();
  return crypto.scryptSync(secret, 'autocopy-salt', 32);
}

function getOrCreateSecret(): string {
  try {
    if (fs.existsSync(SECRET_FILE)) {
      return fs.readFileSync(SECRET_FILE, 'utf8').trim();
    }
  } catch {
    // Ignore read errors
  }
  
  const newSecret = crypto.randomBytes(32).toString('hex');
  
  try {
    const dir = path.dirname(SECRET_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SECRET_FILE, newSecret, 'utf8');
  } catch {
    console.warn('Warning: Could not save encryption secret to file.');
  }
  
  return newSecret;
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const salt = crypto.randomBytes(SALT_LENGTH);
  
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  const combined = Buffer.concat([
    salt,
    iv,
    authTag,
    Buffer.from(encrypted, 'hex')
  ]);
  
  return combined.toString('base64');
}

export function decrypt(encryptedData: string): string {
  const key = getEncryptionKey();
  const combined = Buffer.from(encryptedData, 'base64');
  
  const iv = combined.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const authTag = combined.subarray(
    SALT_LENGTH + IV_LENGTH,
    SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH
  );
  const encrypted = combined.subarray(SALT_LENGTH + IV_LENGTH + AUTH_TAG_LENGTH);
  
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

export function hashApiKey(apiKey: string): string {
  return crypto
    .createHash('sha256')
    .update(apiKey)
    .digest('hex')
    .substring(0, 16);
}

export function validateApiKeyFormat(provider: string, apiKey: string): boolean {
  const patterns: Record<string, RegExp> = {
    openai: /^sk-[A-Za-z0-9]{20,}$/,
    anthropic: /^sk-ant-[A-Za-z0-9-]{20,}$/,
    deepseek: /^sk-[A-Za-z0-9]{20,}$/,
    wenxin: /^[A-Za-z0-9]{20,}$/,
    qwen: /^sk-[A-Za-z0-9]{20,}$/,
    gemini: /^AI[A-Za-z0-9]{20,}$/,
  };
  
  const pattern = patterns[provider];
  if (!pattern) {
    return apiKey.length >= 10;
  }
  
  return pattern.test(apiKey);
}
