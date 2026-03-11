# 加密模块文档

本文档详细说明 AutoCopy 项目中敏感数据（如 API Key）的加密存储方案。

## 概述

为了保护用户的 API Key 等敏感信息，AutoCopy 采用 **AES-256-GCM** 对称加密算法进行数据加密存储。

## 技术规格

| 项目 | 说明 |
|------|------|
| **加密算法** | AES-256-GCM |
| **密钥长度** | 256 位 (32 字节) |
| **IV 长度** | 16 字节 |
| **认证标签长度** | 16 字节 |
| **盐值长度** | 32 字节 |
| **密钥派生** | scrypt |

## 存储位置

### 加密密钥文件

```
data/.secret
```

- 首次运行时自动生成 64 字符随机密钥
- 用于派生 AES 加密密钥
- **重要**: 此文件不应提交到版本控制

### 用户配置文件

```
data/user-config.json
```

存储加密后的 API Key 和其他用户配置。

## 加密流程

```
┌─────────────────────────────────────────────────────────────┐
│                      加密流程                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. 生成随机盐值 (32 bytes)                                  │
│  2. 生成随机 IV (16 bytes)                                   │
│  3. 从 .secret 文件派生加密密钥 (scrypt)                      │
│  4. 使用 AES-256-GCM 加密明文                                │
│  5. 获取认证标签 (Auth Tag)                                  │
│  6. 组合: Salt + IV + AuthTag + Ciphertext                  │
│  7. Base64 编码输出                                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 数据结构

加密后的数据格式：

```
[32 bytes Salt][16 bytes IV][16 bytes AuthTag][N bytes Ciphertext]
```

最终输出为 Base64 编码字符串。

## 解密流程

```
┌─────────────────────────────────────────────────────────────┐
│                      解密流程                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Base64 解码加密数据                                      │
│  2. 提取 Salt (前 32 bytes)                                  │
│  3. 提取 IV (第 33-48 bytes)                                 │
│  4. 提取 AuthTag (第 49-64 bytes)                            │
│  5. 提取 Ciphertext (剩余部分)                               │
│  6. 从 .secret 文件派生解密密钥                              │
│  7. 设置 AuthTag 并解密                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## API 接口

### `encrypt(plaintext: string): string`

加密明文字符串。

**参数**:
- `plaintext` - 待加密的明文字符串

**返回**:
- Base64 编码的加密字符串

**示例**:

```typescript
import { encrypt } from './utils/encryption';

const apiKey = 'sk-xxxxxxxxxxxxxxxx';
const encrypted = encrypt(apiKey);
// 输出类似: "aBcDeFgHiJkLmNoPqRsTuVwXyZ..."
```

### `decrypt(encryptedData: string): string`

解密加密字符串。

**参数**:
- `encryptedData` - Base64 编码的加密字符串

**返回**:
- 解密后的明文字符串

**异常**:
- 如果认证标签验证失败，将抛出错误

**示例**:

```typescript
import { decrypt } from './utils/encryption';

const encrypted = 'aBcDeFgHiJkLmNoPqRsTuVwXyZ...';
const apiKey = decrypt(encrypted);
// 输出: 'sk-xxxxxxxxxxxxxxxx'
```

### `hashApiKey(apiKey: string): string`

生成 API Key 的短哈希值，用于显示掩码。

**参数**:
- `apiKey` - API Key 字符串

**返回**:
- 16 字符的 SHA-256 哈希值

**示例**:

```typescript
import { hashApiKey } from './utils/encryption';

const hash = hashApiKey('sk-xxxxxxxxxxxxxxxx');
// 输出: 'a1b2c3d4e5f6g7h8'
```

### `validateApiKeyFormat(provider: string, apiKey: string): boolean`

验证 API Key 格式是否符合特定提供商的要求。

**参数**:
- `provider` - 提供商名称 (`openai`, `anthropic`, `deepseek`, `wenxin`, `qwen`, `gemini`)
- `apiKey` - 待验证的 API Key

**返回**:
- `true` 格式正确，`false` 格式错误

**支持的格式**:

| 提供商 | 格式正则 |
|--------|----------|
| OpenAI | `^sk-[A-Za-z0-9]{20,}$` |
| Anthropic | `^sk-ant-[A-Za-z0-9-]{20,}$` |
| DeepSeek | `^sk-[A-Za-z0-9]{20,}$` |
| 文心一言 | `^[A-Za-z0-9]{20,}$` |
| 通义千问 | `^sk-[A-Za-z0-9]{20,}$` |
| Gemini | `^AI[A-Za-z0-9]{20,}$` |

## 安全特性

### 1. 认证加密 (AEAD)

使用 AES-GCM 模式提供：
- **机密性**: 数据加密存储
- **完整性**: Auth Tag 验证数据未被篡改

### 2. 密钥派生

使用 `scrypt` 算法从主密钥派生加密密钥：
- 抗暴力破解
- 可配置计算复杂度

### 3. 随机性

每次加密使用：
- 随机 IV（初始化向量）
- 随机 Salt（盐值）

确保相同明文每次加密结果不同。

### 4. 本地存储

所有敏感数据仅存储在本地：
- 不上传到云端
- 不传输到第三方

## 最佳实践

### 生产环境部署

1. **保护 .secret 文件**
   ```bash
   chmod 600 data/.secret
   ```

2. **备份密钥**
   ```bash
   # 备份加密密钥
   cp data/.secret backup/.secret.backup
   ```

3. **环境变量**（可选）
   
   可修改代码支持从环境变量读取主密钥：
   ```typescript
   const secret = process.env.ENCRYPTION_SECRET || getOrCreateSecret();
   ```

### 密钥轮换

如需轮换加密密钥：

1. 解密所有现有数据
2. 生成新的 .secret 文件
3. 使用新密钥重新加密数据

## 源码位置

```
src/utils/encryption.ts
```

## 相关文件

- `src/utils/userConfig.ts` - 用户配置管理，调用加密模块
- `src/web/routes/providers.ts` - API 路由，处理 API Key 存储
