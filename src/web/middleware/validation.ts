import { Request, Response, NextFunction, RequestHandler } from 'express';

const XSS_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi,
  /data:\s*text\/html/gi,
  /vbscript:/gi,
  /expression\s*\(/gi,
];

const SQL_INJECTION_PATTERNS = [
  /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b)/gi,
  /(--\s*$)/gm,
  /(;|\s)OR\s+\d+\s*=\s*\d+/gi,
  /(;|\s)AND\s+\d+\s*=\s*\d+/gi,
  /UNION\s+(ALL\s+)?SELECT/gi,
];

export function sanitizeInput(input: string): string {
  let sanitized = input;
  
  for (const pattern of XSS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  for (const pattern of SQL_INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }
  
  return sanitized.trim();
}

export function sanitizeObject(obj: unknown): unknown {
  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item));
  }
  
  if (obj !== null && typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[sanitizeInput(key)] = sanitizeObject(value);
    }
    return sanitized;
  }
  
  return obj;
}

export function inputValidationMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction
): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  
  if (req.query && typeof req.query === 'object') {
    for (const [key, value] of Object.entries(req.query)) {
      if (typeof value === 'string') {
        (req.query as Record<string, unknown>)[key] = sanitizeInput(value);
      }
    }
  }
  
  if (req.params && typeof req.params === 'object') {
    for (const [key, value] of Object.entries(req.params)) {
      if (typeof value === 'string') {
        req.params[key] = sanitizeInput(value);
      }
    }
  }
  
  next();
}

export function validateRequiredFields(fields: string[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const missing: string[] = [];
    
    for (const field of fields) {
      const value = req.body[field];
      if (value === undefined || value === null || value === '') {
        missing.push(field);
      }
    }
    
    if (missing.length > 0) {
      res.status(400).json({
        success: false,
        error: `缺少必填字段: ${missing.join(', ')}`,
      });
      return;
    }
    
    next();
  };
}

export function validateStringLength(
  field: string,
  minLength: number,
  maxLength: number
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[field];
    
    if (typeof value === 'string') {
      if (value.length < minLength || value.length > maxLength) {
        res.status(400).json({
          success: false,
          error: `${field} 长度必须在 ${minLength} 到 ${maxLength} 个字符之间`,
        });
        return;
      }
    }
    
    next();
  };
}

export function validateNumberRange(
  field: string,
  min: number,
  max: number
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req.body[field];
    
    if (typeof value === 'number') {
      if (value < min || value > max) {
        res.status(400).json({
          success: false,
          error: `${field} 必须在 ${min} 到 ${max} 之间`,
        });
        return;
      }
    }
    
    next();
  };
}
