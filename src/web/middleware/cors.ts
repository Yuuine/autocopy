import { Request, Response, NextFunction, RequestHandler } from 'express';

interface CORSOptions {
  origin?: string | string[] | boolean;
  methods?: string[];
  allowedHeaders?: string[];
  exposedHeaders?: string[];
  credentials?: boolean;
  maxAge?: number;
}

const DEFAULT_ALLOWED_HEADERS = [
  'Content-Type',
  'Authorization',
  'X-Requested-With',
  'Accept',
  'Origin',
];

const DEFAULT_METHODS = [
  'GET',
  'POST',
  'PUT',
  'DELETE',
  'OPTIONS',
  'PATCH',
];

export function cors(options: CORSOptions = {}): RequestHandler {
  const {
    origin = '*',
    methods = DEFAULT_METHODS,
    allowedHeaders = DEFAULT_ALLOWED_HEADERS,
    exposedHeaders = [],
    credentials = false,
    maxAge = 86400,
  } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    const requestOrigin = req.headers.origin;
    
    let allowOrigin: string | undefined;
    
    if (origin === '*') {
      allowOrigin = '*';
    } else if (origin === true) {
      allowOrigin = requestOrigin;
    } else if (typeof origin === 'string') {
      allowOrigin = origin;
    } else if (Array.isArray(origin)) {
      if (requestOrigin && origin.includes(requestOrigin)) {
        allowOrigin = requestOrigin;
      }
    }
    
    if (allowOrigin) {
      res.setHeader('Access-Control-Allow-Origin', allowOrigin);
    }
    
    res.setHeader('Access-Control-Allow-Methods', methods.join(', '));
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders.join(', '));
    
    if (exposedHeaders.length > 0) {
      res.setHeader('Access-Control-Expose-Headers', exposedHeaders.join(', '));
    }
    
    if (credentials) {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    
    res.setHeader('Access-Control-Max-Age', String(maxAge));
    
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    
    next();
  };
}

export const defaultCORS: RequestHandler = cors({
  origin: '*',
  methods: DEFAULT_METHODS,
  allowedHeaders: DEFAULT_ALLOWED_HEADERS,
  credentials: false,
  maxAge: 86400,
});

export const strictCORS: RequestHandler = cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 3600,
});
