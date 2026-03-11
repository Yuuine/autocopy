import { Request, Response, NextFunction, RequestHandler } from 'express';

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  message?: string;
  keyGenerator?: (req: Request) => string;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, 60000);

export function rateLimit(options: RateLimitOptions): RequestHandler {
  const {
    windowMs,
    maxRequests,
    message = '请求过于频繁，请稍后再试',
    keyGenerator = (req: Request) => req.ip ?? 'unknown',
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = keyGenerator(req);
    const now = Date.now();
    
    let entry = rateLimitStore.get(key);
    
    if (!entry || entry.resetTime < now) {
      entry = {
        count: 0,
        resetTime: now + windowMs,
      };
      rateLimitStore.set(key, entry);
    }
    
    entry.count++;
    
    const remaining = Math.max(0, maxRequests - entry.count);
    const resetTimeSeconds = Math.ceil((entry.resetTime - now) / 1000);
    
    res.setHeader('X-RateLimit-Limit', String(maxRequests));
    res.setHeader('X-RateLimit-Remaining', String(remaining));
    res.setHeader('X-RateLimit-Reset', String(resetTimeSeconds));
    
    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', String(resetTimeSeconds));
      res.status(429).json({
        success: false,
        error: message,
        retryAfter: resetTimeSeconds,
      });
      return;
    }
    
    next();
  };
}

export function createIPRateLimit(
  windowMs: number = 60000,
  maxRequests: number = 100
): RequestHandler {
  return rateLimit({
    windowMs,
    maxRequests,
    keyGenerator: (req: Request) => req.ip ?? 'unknown',
  });
}

export function createAPIRateLimit(
  windowMs: number = 60000,
  maxRequests: number = 30
): RequestHandler {
  return rateLimit({
    windowMs,
    maxRequests,
    message: 'API 请求过于频繁，请稍后再试',
    keyGenerator: (req: Request) => {
      const ip = req.ip ?? 'unknown';
      const instanceId = req.body?.instanceId ?? 'default';
      return `${ip}:${instanceId}`;
    },
  });
}

export function createGenerateRateLimit(
  windowMs: number = 60000,
  maxRequests: number = 10
): RequestHandler {
  return rateLimit({
    windowMs,
    maxRequests,
    message: '文案生成请求过于频繁，请稍后再试',
    keyGenerator: (req: Request) => {
      const ip = req.ip ?? 'unknown';
      return `generate:${ip}`;
    },
  });
}

export function clearRateLimitStore(): void {
  rateLimitStore.clear();
}
