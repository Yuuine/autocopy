import { Request, Response, NextFunction } from 'express';

export interface ApiError {
  message: string;
  statusCode: number;
  details?: unknown;
}

export function createError(message: string, statusCode: number = 500, details?: unknown): ApiError {
  return { message, statusCode, details };
}

export function errorHandler(
  err: Error | ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error('Error:', err);

  if ('statusCode' in err) {
    res.status(err.statusCode).json({
      success: false,
      error: err.message,
      details: err.details,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
}
