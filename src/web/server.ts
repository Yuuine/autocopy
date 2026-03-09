import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import path from 'path';
import { copywritingRouter } from './routes';
import { errorHandler } from './middleware';

const app: Express = express();
const PORT = process.env['PORT'] ?? 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, '../../public')));

app.get('/api/health', (_req: Request, res: Response): void => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/copywriting', copywritingRouter);

app.get('/', (_req: Request, res: Response): void => {
  res.sendFile(path.join(__dirname, '../../public/index.html'));
});

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`🚀 AutoCopy Web UI 服务已启动`);
  console.log(`📍 访问地址: http://localhost:${PORT}`);
  console.log(`📝 API 文档: http://localhost:${PORT}/api/health`);
});
