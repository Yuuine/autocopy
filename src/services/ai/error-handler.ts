import type { AIProvider } from '../../types';

export class AIServiceError extends Error {
  public readonly provider: AIProvider;
  public readonly code: string;
  public readonly statusCode: number | undefined;
  public readonly retryable: boolean;

  constructor(
    message: string,
    provider: AIProvider,
    code: string,
    options?: {
      statusCode?: number;
      retryable?: boolean;
    }
  ) {
    super(message);
    this.name = 'AIServiceError';
    this.provider = provider;
    this.code = code;
    this.statusCode = options?.statusCode;
    this.retryable = options?.retryable ?? false;
  }
}

export class AIProviderNotFoundError extends AIServiceError {
  constructor(provider: string) {
    super(
      `AI provider '${provider}' is not supported`,
      'deepseek',
      'PROVIDER_NOT_FOUND',
      { retryable: false }
    );
    this.name = 'AIProviderNotFoundError';
  }
}

export class AIAuthenticationError extends AIServiceError {
  constructor(provider: AIProvider, message?: string) {
    super(
      message ?? `Authentication failed for ${provider}`,
      provider,
      'AUTHENTICATION_ERROR',
      { statusCode: 401, retryable: false }
    );
    this.name = 'AIAuthenticationError';
  }
}

export class AIRateLimitError extends AIServiceError {
  public readonly retryAfter: number | undefined;

  constructor(provider: AIProvider, retryAfter?: number) {
    super(
      `Rate limit exceeded for ${provider}`,
      provider,
      'RATE_LIMIT_ERROR',
      { statusCode: 429, retryable: true }
    );
    this.name = 'AIRateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class AIProviderError extends AIServiceError {
  constructor(
    provider: AIProvider,
    message: string,
    statusCode?: number
  ) {
    const retryable = statusCode !== undefined && statusCode >= 500;
    const options = statusCode !== undefined 
      ? { statusCode: statusCode, retryable: retryable }
      : { retryable: retryable };
    super(
      message,
      provider,
      'PROVIDER_ERROR',
      options
    );
    this.name = 'AIProviderError';
  }
}

export class AIValidationError extends AIServiceError {
  constructor(provider: AIProvider, message: string) {
    super(
      message,
      provider,
      'VALIDATION_ERROR',
      { statusCode: 400, retryable: false }
    );
    this.name = 'AIValidationError';
  }
}

export function handleAIError(error: unknown, provider: AIProvider): never {
  if (error instanceof AIServiceError) {
    throw error;
  }

  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    if (message.includes('api key') || message.includes('authentication') || message.includes('unauthorized')) {
      throw new AIAuthenticationError(provider, error.message);
    }

    if (message.includes('rate limit') || message.includes('too many requests')) {
      throw new AIRateLimitError(provider);
    }

    if (message.includes('timeout') || message.includes('network')) {
      throw new AIServiceError(
        `Network error: ${error.message}`,
        provider,
        'NETWORK_ERROR',
        { retryable: true }
      );
    }

    throw new AIProviderError(provider, error.message);
  }

  throw new AIServiceError(
    'Unknown error occurred',
    provider,
    'UNKNOWN_ERROR',
    { retryable: false }
  );
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
  } = {}
): Promise<T> {
  const { maxRetries = 3, delayMs = 1000, backoffMultiplier = 2 } = options;
  
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof AIServiceError && !error.retryable) {
        throw error;
      }
      
      if (attempt < maxRetries) {
        const delay = delayMs * Math.pow(backoffMultiplier, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}
