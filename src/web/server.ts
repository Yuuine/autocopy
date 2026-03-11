import 'dotenv/config';
import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import { copywritingRouter, providersRouter } from './routes';
import { 
  errorHandler, 
  defaultCORS, 
  inputValidationMiddleware,
  createIPRateLimit,
  createGenerateRateLimit 
} from './middleware';
import { createLogger, logRequest } from '../utils/logger';

const logger = createLogger('Server');

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection:', reason);
  logger.debug('Promise:', promise);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
});

const app: Express = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(defaultCORS);
app.use(inputValidationMiddleware);
app.use(createIPRateLimit(60000, 200));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../../public')));

app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    logRequest(req.method, req.originalUrl, res.statusCode, duration);
  });
  
  next();
});

app.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/copywriting', createGenerateRateLimit(60000, 20), copywritingRouter);
app.use('/api/providers', providersRouter);

app.get('/', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info('🚀 AutoCopy Web UI 服务已启动');
  logger.info(`📍 访问地址: http://localhost:${PORT}`);
  logger.info(`📝 API 文档: http://localhost:${PORT}/api/health`);
  logger.debug('日志级别:', process.env['LOG_LEVEL'] || 'info');
});
